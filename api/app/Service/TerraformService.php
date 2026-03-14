<?php
declare(strict_types=1);

namespace App\Service;

use App\Entity\Environment;
use App\Repository\EnvironmentRepository;
use App\Repository\ProjectRepository;
use App\Repository\OrganizationRepository;

/**
 * TerraformService — Orchestrates VM provisioning via Terraform.
 *
 * Workflow:
 *   1. Generates a workspace directory with terraform.tfvars
 *   2. Runs `terraform init && apply` via shell exec
 *   3. Parses outputs (IP, instance name)
 *   4. Updates the Environment entity
 */
class TerraformService
{
    private string $basePath;
    private string $modulePath;

    public function __construct(
        private readonly EnvironmentRepository $envRepo,
        private readonly ProjectRepository $projectRepo,
        private readonly OrganizationRepository $orgRepo,
    ) {
        // Infrastructure paths — relative to API root
        $this->basePath = dirname(__DIR__, 2) . '/../infrastructure';
        $this->modulePath = $this->basePath . '/terraform/modules/vm-instance';

        // Fallback: if running in Docker, use absolute path
        if (!is_dir($this->modulePath)) {
            $this->modulePath = '/var/www/infrastructure/terraform/modules/vm-instance';
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Provision
    // ─────────────────────────────────────────────────────────────

    public function provision(Environment $env): array
    {
        $project = $this->projectRepo->find($env->project_id);
        if (!$project) {
            throw new \RuntimeException("Project not found for env #{$env->id}");
        }

        $org = $this->orgRepo->find($project->organization_id);
        $orgSlug = $org ? $org->slug : (string) $project->organization_id;

        // Update status
        $env->status = 'provisioning';
        $env->updated_at = new \DateTimeImmutable();
        $this->envRepo->save($env);

        // Generate workspace
        $workspaceDir = $this->createWorkspace($env, $orgSlug, $project->slug, $project->stack, $env->branch ?? 'main');

        try {
            // Run terraform
            $output = $this->runTerraform($workspaceDir, 'apply');

            // Parse outputs
            $outputs = $this->parseTerraformOutputs($workspaceDir);

            // Update environment with results
            $env->ip_address = $outputs['external_ip'] ?? null;
            $env->internal_ip = $outputs['internal_ip'] ?? null;
            $env->instance_id = $outputs['instance_name'] ?? null;
            $env->status = 'active';
            $env->stack_status = 'installing'; // Startup script is running
            $env->updated_at = new \DateTimeImmutable();
            $this->envRepo->save($env);

            return [
                'success' => true,
                'ip_address' => $env->ip_address,
                'instance_id' => $env->instance_id,
                'output' => $output,
            ];
        } catch (\Throwable $e) {
            $env->status = 'error';
            $env->stack_status = 'error';
            $env->updated_at = new \DateTimeImmutable();
            $this->envRepo->save($env);

            error_log("TERRAFORM_ERROR [{$env->slug}]: " . $e->getMessage());

            return [
                'success' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Destroy
    // ─────────────────────────────────────────────────────────────

    public function destroy(Environment $env): array
    {
        $project = $this->projectRepo->find($env->project_id);
        $org = $project ? $this->orgRepo->find($project->organization_id) : null;
        $orgSlug = $org ? $org->slug : 'unknown';

        $workspaceDir = $this->getWorkspaceDir($orgSlug, $project?->slug ?? 'unknown', $env->slug);

        if (!is_dir($workspaceDir)) {
            return ['success' => true, 'message' => 'No infrastructure to destroy'];
        }

        try {
            $output = $this->runTerraform($workspaceDir, 'destroy');

            // Cleanup
            $env->ip_address = null;
            $env->internal_ip = null;
            $env->instance_id = null;
            $env->status = 'stopped';
            $env->stack_status = null;
            $env->updated_at = new \DateTimeImmutable();
            $this->envRepo->save($env);

            return ['success' => true, 'output' => $output];
        } catch (\Throwable $e) {
            error_log("TERRAFORM_DESTROY_ERROR [{$env->slug}]: " . $e->getMessage());
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Resize (change machine type)
    // ─────────────────────────────────────────────────────────────

    public function resize(Environment $env, string $newMachineType): array
    {
        $project = $this->projectRepo->find($env->project_id);
        $org = $project ? $this->orgRepo->find($project->organization_id) : null;
        $orgSlug = $org ? $org->slug : 'unknown';

        $workspaceDir = $this->getWorkspaceDir($orgSlug, $project?->slug ?? 'unknown', $env->slug);

        if (!is_dir($workspaceDir)) {
            throw new \RuntimeException("Workspace not found — provision first");
        }

        // Update tfvars with new machine type
        $tfvars = file_get_contents($workspaceDir . '/terraform.tfvars');
        $tfvars = preg_replace('/machine_type\s*=\s*"[^"]*"/', "machine_type = \"{$newMachineType}\"", $tfvars);
        file_put_contents($workspaceDir . '/terraform.tfvars', $tfvars);

        $env->machine_type = $newMachineType;
        $env->status = 'provisioning';
        $env->updated_at = new \DateTimeImmutable();
        $this->envRepo->save($env);

        return $this->provision($env);
    }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────

    private function getWorkspaceDir(string $orgSlug, string $projectSlug, string $envSlug): string
    {
        return sys_get_temp_dir() . "/monkeyscloud-tf/{$orgSlug}/{$projectSlug}/{$envSlug}";
    }

    private function createWorkspace(Environment $env, string $orgSlug, string $projectSlug, string $stack, string $branch = 'main'): string
    {
        $workspaceDir = $this->getWorkspaceDir($orgSlug, $projectSlug, $env->slug);

        if (!is_dir($workspaceDir)) {
            mkdir($workspaceDir, 0755, true);
        }

        // Generate SSH password for the VM
        $sshPassword = bin2hex(random_bytes(12));
        $env->ssh_password_hash = password_hash($sshPassword, PASSWORD_BCRYPT);

        // Generate hostname: env-project-org.monkeys.cloud
        $hostname = "{$env->slug}-{$projectSlug}-{$orgSlug}.monkeys.cloud";

        // Git clone URL — use the public git server URL
        $gitServerUrl = rtrim($_ENV['GIT_SERVER_PUBLIC_URL'] ?? getenv('GIT_SERVER_PUBLIC_URL') ?: ($_ENV['GIT_SERVER_URL'] ?? getenv('GIT_SERVER_URL') ?: 'http://localhost:3001'), '/');
        $gitRepoUrl = "{$gitServerUrl}/{$orgSlug}/{$projectSlug}.git";

        // Write main.tf that references the module
        $mainTf = <<<TF
module "vm" {
  source = "{$this->modulePath}"

  project_id    = var.project_id
  org_slug      = var.org_slug
  project_slug  = var.project_slug
  env_slug      = var.env_slug
  env_id        = var.env_id
  region        = var.region
  machine_type  = var.machine_type
  disk_size_gb  = var.disk_size_gb
  stack         = var.stack
  ssh_user      = var.ssh_user
  ssh_password  = var.ssh_password
  hostname      = var.hostname
  git_repo_url  = var.git_repo_url
  git_branch    = var.git_branch
  dns_zone_name = var.dns_zone_name
}

variable "project_id" {}
variable "org_slug" {}
variable "project_slug" {}
variable "env_slug" {}
variable "env_id" { type = number }
variable "region" {}
variable "machine_type" {}
variable "disk_size_gb" { type = number }
variable "stack" {}
variable "ssh_user" {}
variable "ssh_password" { sensitive = true }
variable "hostname" {}
variable "git_repo_url" {}
variable "git_branch" {}
variable "dns_zone_name" {}

output "external_ip"   { value = module.vm.external_ip }
output "internal_ip"   { value = module.vm.internal_ip }
output "instance_name" { value = module.vm.instance_name }
output "domain"        { value = module.vm.domain }
TF;
        file_put_contents($workspaceDir . '/main.tf', $mainTf);

        // Write terraform.tfvars
        $tfvars = <<<TFVARS
project_id    = "monkeyscloud2"
org_slug      = "{$orgSlug}"
project_slug  = "{$projectSlug}"
env_slug      = "{$env->slug}"
env_id        = {$env->id}
region        = "{$env->region}"
machine_type  = "{$env->machine_type}"
disk_size_gb  = {$env->disk_size_gb}
stack         = "{$stack}"
ssh_user      = "{$env->ssh_user}"
ssh_password  = "{$sshPassword}"
hostname      = "{$hostname}"
git_repo_url  = "{$gitRepoUrl}"
git_branch    = "{$branch}"
dns_zone_name = "monkeys-cloud"
TFVARS;
        file_put_contents($workspaceDir . '/terraform.tfvars', $tfvars);

        return $workspaceDir;
    }

    private function runTerraform(string $workspaceDir, string $action): string
    {
        $cmd = match ($action) {
            'apply' => "cd {$workspaceDir} && terraform init -input=false -no-color 2>&1 && terraform apply -input=false -no-color -auto-approve 2>&1",
            'destroy' => "cd {$workspaceDir} && terraform init -input=false -no-color 2>&1 && terraform destroy -input=false -no-color -auto-approve 2>&1",
            default => throw new \InvalidArgumentException("Unknown action: {$action}"),
        };

        $output = '';
        $returnCode = 0;
        exec($cmd, $lines, $returnCode);
        $output = implode("\n", $lines);

        if ($returnCode !== 0) {
            throw new \RuntimeException("Terraform {$action} failed (exit {$returnCode}): {$output}");
        }

        return $output;
    }

    private function parseTerraformOutputs(string $workspaceDir): array
    {
        $cmd = "cd {$workspaceDir} && terraform output -json 2>&1";
        $output = shell_exec($cmd);

        if (!$output) {
            return [];
        }

        $data = json_decode($output, true);
        if (!is_array($data)) {
            return [];
        }

        $result = [];
        foreach ($data as $key => $val) {
            $result[$key] = $val['value'] ?? null;
        }

        return $result;
    }
}
