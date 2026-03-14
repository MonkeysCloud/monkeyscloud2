<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use Psr\Http\Message\ServerRequestInterface;
use App\Repository\EnvironmentRepository;
use App\Repository\ProjectRepository;
use App\Repository\OrganizationRepository;
use App\Entity\Environment;
use App\Service\TerraformService;

class EnvironmentController extends AbstractController
{
    public function __construct(
        private readonly EnvironmentRepository $envRepo,
        private readonly ProjectRepository $projectRepo,
        private readonly OrganizationRepository $orgRepo,
        private readonly TerraformService $terraform,
    ) {
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function findProject(int $orgId, string $slug): ?\App\Entity\Project
    {
        return $this->projectRepo->findBySlug($orgId, $slug);
    }

    private function envToArray(Environment $e): array
    {
        return [
            'id' => $e->id,
            'project_id' => $e->project_id,
            'name' => $e->name,
            'slug' => $e->slug,
            'type' => $e->type,
            'url' => $e->url,
            'branch' => $e->branch,
            'auto_deploy' => $e->auto_deploy,
            'is_production' => $e->is_production,
            'region' => $e->region,
            'machine_type' => $e->machine_type,
            'disk_size_gb' => $e->disk_size_gb,
            'ip_address' => $e->ip_address,
            'internal_ip' => $e->internal_ip,
            'instance_id' => $e->instance_id,
            'ssh_user' => $e->ssh_user,
            'stack_status' => $e->stack_status,
            'status' => $e->status,
            'replicas' => $e->replicas,
            'created_at' => $e->created_at->format('c'),
            'updated_at' => $e->updated_at->format('c'),
        ];
    }

    // -------------------------------------------------------------------------
    // Machine types & regions (for frontend dropdowns)
    // -------------------------------------------------------------------------

    public static function machineTypes(): array
    {
        return [
            ['id' => 'e2-micro', 'vcpus' => 0.25, 'ram_gb' => 1, 'monthly_usd' => 7],
            ['id' => 'e2-small', 'vcpus' => 0.5, 'ram_gb' => 2, 'monthly_usd' => 14],
            ['id' => 'e2-medium', 'vcpus' => 1, 'ram_gb' => 4, 'monthly_usd' => 27],
            ['id' => 'e2-standard-2', 'vcpus' => 2, 'ram_gb' => 8, 'monthly_usd' => 54],
            ['id' => 'e2-standard-4', 'vcpus' => 4, 'ram_gb' => 16, 'monthly_usd' => 107],
            ['id' => 'e2-standard-8', 'vcpus' => 8, 'ram_gb' => 32, 'monthly_usd' => 215],
            ['id' => 'n2-standard-2', 'vcpus' => 2, 'ram_gb' => 8, 'monthly_usd' => 63],
            ['id' => 'n2-standard-4', 'vcpus' => 4, 'ram_gb' => 16, 'monthly_usd' => 126],
            ['id' => 'n2-standard-8', 'vcpus' => 8, 'ram_gb' => 32, 'monthly_usd' => 252],
        ];
    }

    public static function regions(): array
    {
        return [
            ['id' => 'us-central1-a', 'label' => 'Iowa (us-central1)'],
            ['id' => 'us-east1-b', 'label' => 'South Carolina (us-east1)'],
            ['id' => 'us-west1-a', 'label' => 'Oregon (us-west1)'],
            ['id' => 'europe-west1-b', 'label' => 'Belgium (europe-west1)'],
            ['id' => 'europe-west4-a', 'label' => 'Netherlands (europe-west4)'],
            ['id' => 'asia-east1-a', 'label' => 'Taiwan (asia-east1)'],
            ['id' => 'southamerica-east1-a', 'label' => 'São Paulo (southamerica-east1)'],
        ];
    }

    // -------------------------------------------------------------------------
    // List environments
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments', name: 'environments.list', summary: 'List environments', tags: ['Environments'])]
    public function index(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $envs = $this->envRepo->findByProject($project->id);
        $data = array_map(fn(Environment $e) => $this->envToArray($e), $envs);

        return $this->json(['data' => $data, 'machine_types' => self::machineTypes(), 'regions' => self::regions()]);
    }

    // -------------------------------------------------------------------------
    // Get one environment
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}', name: 'environments.show', summary: 'Get environment', tags: ['Environments'])]
    public function show(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        return $this->json(['data' => $this->envToArray($env)]);
    }

    // -------------------------------------------------------------------------
    // Create environment
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments', name: 'environments.create', summary: 'Create environment', tags: ['Environments'])]
    public function create(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $data = json_decode((string) $request->getBody(), true) ?? [];

        $name = trim($data['name'] ?? '');
        $slug = strtolower(trim($data['slug'] ?? preg_replace('/[^a-z0-9-]/', '-', strtolower($name))));
        $type = $data['type'] ?? 'custom';
        $region = $data['region'] ?? 'us-central1-a';
        $machineType = $data['machine_type'] ?? 'e2-small';
        $diskSizeGb = (int) ($data['disk_size_gb'] ?? 20);
        $branch = $data['branch'] ?? null;

        if ($name === '') {
            return $this->json(['error' => 'Name is required'], 422);
        }

        // Validate machine type
        $validTypes = array_column(self::machineTypes(), 'id');
        if (!in_array($machineType, $validTypes, true)) {
            return $this->json(['error' => 'Invalid machine type'], 422);
        }

        // Validate region
        $validRegions = array_column(self::regions(), 'id');
        if (!in_array($region, $validRegions, true)) {
            return $this->json(['error' => 'Invalid region'], 422);
        }

        // Check slug uniqueness within project
        $existing = $this->envRepo->findOneBy(['project_id' => $project->id, 'slug' => $slug]);
        if ($existing) {
            return $this->json(['error' => 'An environment with this slug already exists'], 409);
        }

        $now = new \DateTimeImmutable();

        // Generate URL
        $org = $this->orgRepo->find($orgId);
        $orgSlug = $org ? $org->slug : (string) $orgId;
        $url = "https://{$slug}-{$projectSlug}-{$orgSlug}.monkeys.cloud";

        // Generate SSH user
        $sshUser = 'deploy';
        $sshPassword = bin2hex(random_bytes(12)); // 24 char random password

        $env = new Environment();
        $env->project_id = $project->id;
        $env->name = $name;
        $env->slug = $slug;
        $env->type = $type;
        $env->url = $url;
        $env->branch = $branch;
        $env->region = $region;
        $env->machine_type = $machineType;
        $env->disk_size_gb = $diskSizeGb;
        $env->is_production = ($type === 'production');
        $env->auto_deploy = (bool) ($data['auto_deploy'] ?? true);
        $env->ssh_user = $sshUser;
        $env->ssh_password_hash = password_hash($sshPassword, PASSWORD_BCRYPT);
        $env->status = 'pending';
        $env->stack_status = 'pending';
        $env->created_at = $now;
        $env->updated_at = $now;

        $this->envRepo->save($env);

        return $this->json([
            'data' => $this->envToArray($env),
            'ssh_password' => $sshPassword, // Only returned once on creation
        ], 201);
    }

    // -------------------------------------------------------------------------
    // Update environment
    // -------------------------------------------------------------------------

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}', name: 'environments.update', summary: 'Update environment', tags: ['Environments'])]
    public function update(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        $data = json_decode((string) $request->getBody(), true) ?? [];

        if (isset($data['name']))
            $env->name = trim($data['name']);
        if (isset($data['machine_type'])) {
            $validTypes = array_column(self::machineTypes(), 'id');
            if (in_array($data['machine_type'], $validTypes, true)) {
                $env->machine_type = $data['machine_type'];
            }
        }
        if (isset($data['disk_size_gb']))
            $env->disk_size_gb = (int) $data['disk_size_gb'];
        if (isset($data['branch']))
            $env->branch = $data['branch'];
        if (isset($data['auto_deploy']))
            $env->auto_deploy = (bool) $data['auto_deploy'];
        $env->updated_at = new \DateTimeImmutable();

        $this->envRepo->save($env);

        return $this->json(['data' => $this->envToArray($env)]);
    }

    // -------------------------------------------------------------------------
    // Delete environment
    // -------------------------------------------------------------------------

    #[Route(methods: 'DELETE', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}', name: 'environments.delete', summary: 'Delete environment', tags: ['Environments'])]
    public function delete(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        // Trigger Terraform destroy if instance exists
        if ($env->instance_id) {
            try {
                $this->terraform->destroy($env);
            } catch (\Throwable $e) {
                error_log("TERRAFORM_DESTROY_WARN: " . $e->getMessage());
            }
        }

        $this->envRepo->delete($env);

        return $this->json(['status' => 'deleted']);
    }

    // -------------------------------------------------------------------------
    // Provision environment (trigger Terraform)
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}/provision', name: 'environments.provision', summary: 'Provision environment', tags: ['Environments'])]
    public function provision(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        if ($env->status === 'provisioning') {
            return $this->json(['error' => 'Already provisioning'], 409);
        }

        $result = $this->terraform->provision($env);

        if ($result['success']) {
            return $this->json([
                'data' => $this->envToArray($this->envRepo->find($envId)),
                'message' => 'Provisioning started',
            ]);
        }

        return $this->json(['error' => $result['error'] ?? 'Provisioning failed'], 500);
    }

    // -------------------------------------------------------------------------
    // Destroy environment infrastructure
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}/destroy', name: 'environments.destroy', summary: 'Destroy environment infra', tags: ['Environments'])]
    public function destroyInfra(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        $result = $this->terraform->destroy($env);

        return $this->json([
            'data' => $this->envToArray($this->envRepo->find($envId)),
            'success' => $result['success'],
        ]);
    }

    // -------------------------------------------------------------------------
    // Resize environment
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}/resize', name: 'environments.resize', summary: 'Resize environment', tags: ['Environments'])]
    public function resize(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        $data = json_decode((string) $request->getBody(), true) ?? [];
        $newMachineType = $data['machine_type'] ?? '';

        $validTypes = array_column(self::machineTypes(), 'id');
        if (!in_array($newMachineType, $validTypes, true)) {
            return $this->json(['error' => 'Invalid machine type'], 422);
        }

        if (!$env->instance_id) {
            // Not provisioned yet — just update the DB
            $env->machine_type = $newMachineType;
            $env->updated_at = new \DateTimeImmutable();
            $this->envRepo->save($env);
            return $this->json(['data' => $this->envToArray($env)]);
        }

        $result = $this->terraform->resize($env, $newMachineType);

        return $this->json([
            'data' => $this->envToArray($this->envRepo->find($envId)),
            'success' => $result['success'],
        ]);
    }

    // -------------------------------------------------------------------------
    // SSH Key upload
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}/ssh-keys', name: 'environments.sshKeys', summary: 'Upload SSH key', tags: ['Environments'])]
    public function uploadSshKey(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        $data = json_decode((string) $request->getBody(), true) ?? [];
        $publicKey = trim($data['public_key'] ?? '');

        if ($publicKey === '' || !str_starts_with($publicKey, 'ssh-')) {
            return $this->json(['error' => 'Invalid SSH public key'], 422);
        }

        $env->ssh_public_key = $publicKey;
        $env->updated_at = new \DateTimeImmutable();
        $this->envRepo->save($env);

        // TODO: Push public key to VM authorized_keys

        return $this->json(['status' => 'key_saved']);
    }

    // -------------------------------------------------------------------------
    // SSH Credentials
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}/ssh-credentials', name: 'environments.sshCredentials', summary: 'Get SSH credentials', tags: ['Environments'])]
    public function sshCredentials(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        $host = $env->ip_address ?? $env->url ?? 'pending';
        $org = $this->orgRepo->find($orgId);
        $orgSlug = $org ? $org->slug : (string) $orgId;

        return $this->json([
            'data' => [
                'host' => $host,
                'hostname' => "{$env->slug}-{$projectSlug}-{$orgSlug}.monkeys.cloud",
                'user' => $env->ssh_user ?? 'deploy',
                'port' => 22,
                'has_key' => $env->ssh_public_key !== null,
                'connection' => "ssh {$env->ssh_user}@{$env->slug}-{$projectSlug}-{$orgSlug}.monkeys.cloud",
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    // Reset SSH Password
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}/ssh-reset', name: 'environments.sshReset', summary: 'Reset SSH password', tags: ['Environments'])]
    public function resetSshPassword(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        $project = $this->findProject($orgId, $projectSlug);
        if (!$project) {
            return $this->json(['error' => 'Project not found'], 404);
        }

        $env = $this->envRepo->find($envId);
        if (!$env || $env->project_id !== $project->id) {
            return $this->json(['error' => 'Environment not found'], 404);
        }

        $newPassword = bin2hex(random_bytes(12));
        $env->ssh_password_hash = password_hash($newPassword, PASSWORD_BCRYPT);
        $env->updated_at = new \DateTimeImmutable();
        $this->envRepo->save($env);

        // TODO: Push new password to VM

        return $this->json(['ssh_password' => $newPassword]);
    }
}
