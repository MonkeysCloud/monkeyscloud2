<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Router\Attributes\Middleware;
use App\Repository\ProjectRepository;
use App\Repository\EnvironmentRepository;
use App\Repository\EnvironmentVariableRepository;
use App\Repository\OrganizationMemberRepository;
use App\Repository\OrganizationRepository;
use App\Repository\RepositoryRepository;
use App\Repository\StackConfigRepository;
use Psr\Http\Message\ServerRequestInterface;

#[Middleware('auth')]
final class ProjectController extends AbstractController
{
    public function __construct(
        private ProjectRepository $projectRepo,
        private EnvironmentRepository $envRepo,
        private EnvironmentVariableRepository $envVarRepo,
        private OrganizationMemberRepository $memberRepo,
        private OrganizationRepository $orgRepo,
        private RepositoryRepository $repoRepo,
        private StackConfigRepository $stackConfigRepo,
    ) {
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects', name: 'projects.index', summary: 'List projects', tags: ['Projects'])]
    public function index(ServerRequestInterface $request, int $orgId): Response
    {
        $userId = $this->userId($request);
        if (!$userId) {
            return $this->json(['error' => 'Authentication required.'], 401);
        }

        try {
            // Raw SQL to avoid ORM overhead (information_schema queries)
            $pdo = $this->projectRepo->qb->pdo();
            $stmt = $pdo->prepare('
                SELECT id, name, slug, stack, status, repo_source, created_at
                  FROM projects
                 WHERE organization_id = :oid
                 ORDER BY name
            ');
            $stmt->execute(['oid' => $orgId]);
            $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

            $data = array_map(fn($r) => [
                'id'          => (int) $r['id'],
                'name'        => $r['name'],
                'slug'        => $r['slug'],
                'stack'       => $r['stack'],
                'status'      => $r['status'] ?? 'active',
                'repo_source' => $r['repo_source'] ?? 'internal',
                'created_at'  => $r['created_at'],
            ], $rows);

            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('PROJECT_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/check-slug', name: 'projects.checkSlug', summary: 'Check project slug availability', tags: ['Projects'])]
    public function checkSlug(ServerRequestInterface $request, int $orgId): Response
    {
        $params = $request->getQueryParams();
        $slug = isset($params['slug']) ? trim((string) $params['slug']) : '';

        if ($slug === '' || strlen($slug) < 3) {
            return $this->json(['available' => false, 'error' => 'Slug must be at least 3 characters.']);
        }

        $existing = $this->projectRepo->findBySlug($orgId, $slug);
        return $this->json(['available' => ($existing === null)]);
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects', name: 'projects.store', summary: 'Create project', tags: ['Projects'])]
    public function store(ServerRequestInterface $request, int $orgId): Response
    {
        $userId = $this->userId($request);
        if (!$userId) {
            return $this->json(['error' => 'Authentication required.'], 401);
        }

        try {
            // Verify user is a member of the org
            $memberships = $this->memberRepo->findByUser((int) $userId);
            $isMember = false;
            foreach ($memberships as $m) {
                if ($m->organization_id === $orgId) {
                    $isMember = true;
                    break;
                }
            }
            if (!$isMember) {
                return $this->json(['error' => 'You are not a member of this organization.'], 403);
            }

            $data = json_decode((string) $request->getBody(), true);

            $name = trim($data['name'] ?? '');
            $slug = trim($data['slug'] ?? '');
            $stack = trim($data['stack'] ?? '');

            // Validate required fields
            if ($name === '') {
                return $this->json(['error' => 'Project name is required.'], 422);
            }
            if ($slug === '' || strlen($slug) < 3) {
                return $this->json(['error' => 'Slug must be at least 3 characters.'], 422);
            }

            // Validate stack against database
            $stackConfig = $this->stackConfigRepo->findByName($stack);
            if (!$stackConfig || !$stackConfig->enabled) {
                return $this->json(['error' => 'Invalid or disabled stack: ' . $stack], 422);
            }

            // Check slug uniqueness within org
            $existing = $this->projectRepo->findBySlug($orgId, $slug);
            if ($existing !== null) {
                return $this->json(['error' => 'This slug is already taken in this organization.'], 409);
            }

            // Task prefix (unique per org)
            $taskPrefix = strtoupper(trim($data['task_prefix'] ?? ''));
            if ($taskPrefix !== '' && (strlen($taskPrefix) < 2 || strlen($taskPrefix) > 10 || !preg_match('/^[A-Z0-9]+$/', $taskPrefix))) {
                return $this->json(['error' => 'Task prefix must be 2-10 uppercase alphanumeric characters.'], 422);
            }
            if ($taskPrefix !== '') {
                // Check prefix uniqueness within the org
                $existingWithPrefix = $this->projectRepo->findOneBy(['organization_id' => $orgId, 'task_prefix' => $taskPrefix]);
                if ($existingWithPrefix) {
                    return $this->json(['error' => 'This task prefix is already used by another project in this organization.'], 409);
                }
            }

            $now = new \DateTimeImmutable();

            $project = new \App\Entity\Project();
            $project->organization_id = $orgId;
            $project->name = $name;
            $project->slug = $slug;
            $project->stack = $stack;
            $project->description = isset($data['description']) ? trim($data['description']) : null;
            $project->logo_url = isset($data['logo_url']) ? trim($data['logo_url']) : null;

            // Optional fields
            $project->repo_source = $data['repo_source'] ?? 'internal';
            $project->repo_url = isset($data['repo_url']) ? trim($data['repo_url']) : null;
            $project->default_branch = $data['default_branch'] ?? 'main';
            $project->root_directory = $data['root_directory'] ?? '/';
            $project->auto_deploy = $data['auto_deploy'] ?? true;

            // Build commands
            $project->build_command = isset($data['build_command']) ? trim($data['build_command']) : null;
            $project->start_command = isset($data['start_command']) ? trim($data['start_command']) : null;
            $project->install_command = isset($data['install_command']) ? trim($data['install_command']) : null;
            $project->output_directory = isset($data['output_directory']) ? trim($data['output_directory']) : null;

            // Version fields
            $project->php_version = isset($data['php_version']) ? trim($data['php_version']) : null;
            $project->node_version = isset($data['node_version']) ? trim($data['node_version']) : null;
            $project->python_version = isset($data['python_version']) ? trim($data['python_version']) : null;
            $project->ruby_version = isset($data['ruby_version']) ? trim($data['ruby_version']) : null;
            $project->go_version = isset($data['go_version']) ? trim($data['go_version']) : null;

            $project->status = 'active';

            // Auto-generate prefix from project name if not provided
            if ($taskPrefix === '') {
                $words = preg_split('/[\s\-_]+/', $name);
                $generated = '';
                foreach ($words as $w) {
                    if ($w !== '') {
                        $generated .= strtoupper(mb_substr($w, 0, 1));
                    }
                    if (strlen($generated) >= 3)
                        break;
                }
                if (strlen($generated) < 2) {
                    $generated = strtoupper(substr($name, 0, 3));
                }
                // Ensure uniqueness within org
                $candidate = $generated;
                $suffix = 1;
                while (true) {
                    $check = $this->projectRepo->findOneBy(['organization_id' => $orgId, 'task_prefix' => $candidate]);
                    if (!$check)
                        break;
                    $candidate = $generated . $suffix;
                    $suffix++;
                }
                $taskPrefix = $candidate;
            }

            $project->task_prefix = $taskPrefix;
            $project->task_counter = 0;
            $project->created_at = $now;
            $project->updated_at = $now;

            $this->projectRepo->save($project);

            // --- Auto-create internal Git repository ---
            if (($project->repo_source ?? 'internal') === 'internal') {
                try {
                    $orgSlug = $this->orgRepo->findSlugById($orgId) ?? (string) $orgId;

                    $gitServerUrl = rtrim($_ENV['GIT_SERVER_URL'] ?? getenv('GIT_SERVER_URL') ?: 'http://localhost:3001', '/');

                    $ch = curl_init($gitServerUrl . '/api/repos/');
                    curl_setopt_array($ch, [
                        CURLOPT_POST => true,
                        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                        CURLOPT_POSTFIELDS => json_encode([
                            'org' => $orgSlug,
                            'project' => $slug,
                            'stack' => $stack,
                            'docker_image' => $stackConfig->docker_image,
                            'scaffold_command' => $stackConfig->scaffold_command,
                            'gitignore' => $stackConfig->gitignore_template,
                        ]),
                        CURLOPT_RETURNTRANSFER => true,
                        CURLOPT_TIMEOUT => 120,
                        CURLOPT_CONNECTTIMEOUT => 5,
                    ]);
                    $response = curl_exec($ch);
                    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                    $curlErr = curl_error($ch);

                    if ($httpCode >= 200 && $httpCode < 300) {
                        // Save Repository record in DB
                        $repo = new \App\Entity\Repository();
                        $repo->project_id = $project->id;
                        $repo->organization_id = $orgId;
                        $repo->name = $slug;
                        $repo->default_branch = $project->default_branch ?? 'main';
                        $repo->storage_path = '/' . $orgSlug . '/' . $slug . '.git';
                        $repo->source = 'internal';
                        $repo->created_at = $now;
                        $repo->updated_at = $now;
                        $this->repoRepo->save($repo);

                        error_log('GIT_REPO_CREATED: ' . $orgSlug . '/' . $slug);
                    } else {
                        error_log('GIT_REPO_CREATE_WARN: HTTP ' . $httpCode . ' — ' . ($curlErr ?: $response));
                    }
                } catch (\Throwable $gitErr) {
                    error_log('GIT_REPO_CREATE_WARN: ' . $gitErr->getMessage());
                }
            }

            // NOTE: Environments are no longer auto-created here.
            // Users create them manually via the Environments page.

            return $this->json([
                'data' => [
                    'id' => $project->id,
                    'name' => $project->name,
                    'slug' => $project->slug,
                    'stack' => $project->stack,
                    'task_prefix' => $project->task_prefix,
                ],
            ], 201);
        } catch (\Throwable $e) {
            error_log('PROJECT_STORE ERROR: ' . $e->getMessage());
            error_log('PROJECT_STORE TRACE: ' . $e->getTraceAsString());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}', name: 'projects.show', summary: 'Get project', tags: ['Projects'])]
    public function show(ServerRequestInterface $request, int $projectId): Response
    {
        $project = $this->projectRepo->find($projectId);
        if (!$project) {
            return $this->json(['error' => 'Not found'], 404);
        }
        return $this->json([
            'data' => [
                'id' => $project->id,
                'name' => $project->name,
                'slug' => $project->slug,
                'stack' => $project->stack,
                'description' => $project->description,
                'status' => $project->status ?? 'active',
                'repo_source' => $project->repo_source ?? 'internal',
                'repo_url' => $project->repo_url,
                'default_branch' => $project->default_branch ?? 'main',
                'auto_deploy' => $project->auto_deploy ?? true,
                'build_command' => $project->build_command,
                'start_command' => $project->start_command,
                'install_command' => $project->install_command,
                'output_directory' => $project->output_directory,
                'root_directory' => $project->root_directory ?? '/',
                'created_at' => $project->created_at instanceof \DateTimeInterface ? $project->created_at->format('c') : $project->created_at,
            ],
        ]);
    }

    #[Route(methods: 'PUT', path: '/api/v1/projects/{projectId}', name: 'projects.update', summary: 'Update project', tags: ['Projects'])]
    public function update(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json(['message' => 'Updated']);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/projects/{projectId}', name: 'projects.destroy', summary: 'Delete project', tags: ['Projects'])]
    public function destroy(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json(null, 204);
    }

    // --- Environments ---

    /** Resolve project by org-id + slug */
    private function resolveProject(int $orgId, string $slug): ?\App\Entity\Project
    {
        return $this->projectRepo->findBySlug($orgId, $slug);
    }

    // Org+slug based route (used by frontend)
    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments', name: 'envs.index.bySlug', summary: 'List environments by slug', tags: ['Environments'])]
    public function environmentsBySlug(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $project = $this->resolveProject($orgId, $projectSlug);
        if (!$project)
            return $this->json(['error' => 'Project not found.'], 404);
        return $this->environmentsForProject($project->id);
    }

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/environments', name: 'envs.index', summary: 'List environments', tags: ['Environments'])]
    public function environments(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->environmentsForProject($projectId);
    }

    private function environmentsForProject(int $projectId): Response
    {
        $envs = $this->envRepo->findByProject($projectId);
        $data = array_map(fn($e) => [
            'id' => $e->id,
            'name' => $e->name,
            'slug' => $e->slug,
            'type' => $e->type,
            'url' => $e->url,
            'branch' => $e->branch,
            'region' => $e->region,
            'machine_type' => $e->machine_type,
            'disk_size_gb' => $e->disk_size_gb,
            'ip_address' => $e->ip_address,
            'internal_ip' => $e->internal_ip,
            'instance_id' => $e->instance_id,
            'ssh_user' => $e->ssh_user,
            'stack_status' => $e->stack_status,
            'status' => $e->status,
            'is_production' => $e->is_production,
            'auto_deploy' => $e->auto_deploy,
            'created_at' => $e->created_at instanceof \DateTimeInterface ? $e->created_at->format('c') : $e->created_at,
        ], $envs);

        return $this->json([
            'data' => $data,
            'machine_types' => [
                ['id' => 'e2-micro', 'vcpus' => 0.25, 'ram_gb' => 1, 'monthly_usd' => 6],
                ['id' => 'e2-small', 'vcpus' => 0.5, 'ram_gb' => 2, 'monthly_usd' => 12],
                ['id' => 'e2-medium', 'vcpus' => 1, 'ram_gb' => 4, 'monthly_usd' => 24],
                ['id' => 'e2-standard-2', 'vcpus' => 2, 'ram_gb' => 8, 'monthly_usd' => 48],
                ['id' => 'e2-standard-4', 'vcpus' => 4, 'ram_gb' => 16, 'monthly_usd' => 96],
                ['id' => 'e2-standard-8', 'vcpus' => 8, 'ram_gb' => 32, 'monthly_usd' => 192],
            ],
            'regions' => [
                ['id' => 'us-central1-a', 'label' => 'Iowa, US'],
                ['id' => 'us-east1-b', 'label' => 'South Carolina, US'],
                ['id' => 'us-west1-a', 'label' => 'Oregon, US'],
                ['id' => 'europe-west1-b', 'label' => 'Belgium, EU'],
                ['id' => 'europe-west4-a', 'label' => 'Netherlands, EU'],
                ['id' => 'asia-east1-a', 'label' => 'Taiwan, Asia'],
                ['id' => 'southamerica-east1-a', 'label' => 'São Paulo, SA'],
            ],
        ]);
    }

    // Org+slug based route (used by frontend)
    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments', name: 'envs.store.bySlug', summary: 'Create environment by slug', tags: ['Environments'])]
    public function createEnvironmentBySlug(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $project = $this->resolveProject($orgId, $projectSlug);
        if (!$project)
            return $this->json(['error' => 'Project not found.'], 404);
        return $this->doCreateEnvironment($request, $project->id, $orgId);
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/environments', name: 'envs.store', summary: 'Create environment', tags: ['Environments'])]
    public function createEnvironment(ServerRequestInterface $request, int $projectId): Response
    {
        // Lookup org from project
        $project = $this->projectRepo->find($projectId);
        if (!$project)
            return $this->json(['error' => 'Project not found.'], 404);
        return $this->doCreateEnvironment($request, $projectId, $project->organization_id);
    }

    private function doCreateEnvironment(ServerRequestInterface $request, int $projectId, int $orgId): Response
    {
        $data = json_decode((string) $request->getBody(), true);

        $name = trim($data['name'] ?? '');
        if ($name === '') {
            return $this->json(['error' => 'Name is required.'], 422);
        }

        $slug = strtolower(preg_replace('/[^a-z0-9\-]/', '-', strtolower($name)));
        $slug = trim($slug, '-');
        if ($slug === '')
            $slug = 'env';

        $type = $data['type'] ?? 'development';
        $validTypes = ['production', 'staging', 'preview', 'development', 'testing', 'custom'];
        if (!in_array($type, $validTypes, true))
            $type = 'development';

        $region = $data['region'] ?? 'us-central1-a';
        $machineType = $data['machine_type'] ?? 'e2-small';
        $branch = isset($data['branch']) && trim($data['branch']) !== '' ? trim($data['branch']) : 'main';

        // Look up org slug for URL generation
        $org = $this->orgRepo->find($orgId);
        $orgSlug = $org ? $org->slug : (string) $orgId;

        $project = $this->projectRepo->find($projectId);
        $projectSlug = $project ? $project->slug : (string) $projectId;

        // Generate SSH password
        $sshPasswordPlain = bin2hex(random_bytes(12));

        $now = new \DateTimeImmutable();

        $env = new \App\Entity\Environment();
        $env->project_id = $projectId;
        $env->name = $name;
        $env->slug = $slug;
        $env->type = $type;
        $env->branch = $branch;
        $env->region = $region;
        $env->machine_type = $machineType;
        $env->disk_size_gb = (int) ($data['disk_size_gb'] ?? 20);
        $env->is_production = ($type === 'production');
        $env->auto_deploy = (bool) ($data['auto_deploy'] ?? true);
        $env->ssh_user = 'deploy';
        $env->ssh_password_hash = password_hash($sshPasswordPlain, PASSWORD_BCRYPT);
        $env->url = "https://{$slug}.{$projectSlug}.{$orgSlug}.monkeys.cloud";
        $env->status = 'pending';
        $env->stack_status = 'pending';
        $env->created_at = $now;
        $env->updated_at = $now;

        $this->envRepo->save($env);

        return $this->json([
            'data' => [
                'id' => $env->id,
                'name' => $env->name,
                'slug' => $env->slug,
                'type' => $env->type,
                'url' => $env->url,
                'branch' => $env->branch,
                'region' => $env->region,
                'machine_type' => $env->machine_type,
                'disk_size_gb' => $env->disk_size_gb,
                'status' => $env->status,
                'is_production' => $env->is_production,
                'auto_deploy' => $env->auto_deploy,
                'created_at' => $env->created_at->format('c'),
            ],
            'ssh_password' => $sshPasswordPlain,
        ], 201);
    }

    // Delete environment (org+slug route used by frontend)
    #[Route(methods: 'DELETE', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/environments/{envId}', name: 'envs.destroy.bySlug', summary: 'Delete environment by slug', tags: ['Environments'])]
    public function deleteEnvironmentBySlug(ServerRequestInterface $request, int $orgId, string $projectSlug, int $envId): Response
    {
        return $this->doDeleteEnvironment($envId);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/environments/{envId}', name: 'envs.destroy', summary: 'Delete environment', tags: ['Environments'])]
    public function deleteEnvironment(ServerRequestInterface $request, int $envId): Response
    {
        return $this->doDeleteEnvironment($envId);
    }

    private function doDeleteEnvironment(int $envId): Response
    {
        $env = $this->envRepo->find($envId);
        if (!$env)
            return $this->json(['error' => 'Environment not found.'], 404);

        $this->envRepo->delete($env);
        return $this->json(null, 204);
    }

    // --- Environment Variables ---

    #[Route(methods: 'GET', path: '/api/v1/environments/{envId}/variables', name: 'envvars.index', summary: 'List variables', tags: ['Environments'])]
    public function variables(ServerRequestInterface $request, int $envId): Response
    {
        return $this->json($this->envVarRepo->findByEnvironment($envId));
    }

    #[Route(methods: 'POST', path: '/api/v1/environments/{envId}/variables', name: 'envvars.store', summary: 'Set variable', tags: ['Environments'])]
    public function setVariable(ServerRequestInterface $request, int $envId): Response
    {
        return $this->json(['message' => 'Set'], 201);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/environments/{envId}/variables/{varId}', name: 'envvars.destroy', summary: 'Delete variable', tags: ['Environments'])]
    public function deleteVariable(ServerRequestInterface $request, int $envId, int $varId): Response
    {
        return $this->json(null, 204);
    }
}
