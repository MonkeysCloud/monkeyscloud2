<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use App\Repository\ProjectRepository;
use App\Repository\EnvironmentRepository;
use App\Repository\EnvironmentVariableRepository;
use Psr\Http\Message\ServerRequestInterface;

final class ProjectController
{
    public function __construct(
        private ProjectRepository $projectRepo,
        private EnvironmentRepository $envRepo,
        private EnvironmentVariableRepository $envVarRepo,
    ) {
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects', name: 'projects.index', summary: 'List projects', tags: ['Projects'])]
    public function index(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->projectRepo->findByOrganization($orgId));
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects', name: 'projects.store', summary: 'Create project', tags: ['Projects'])]
    public function store(ServerRequestInterface $request, int $orgId): Response
    {
        // TODO: validate, create project + init git repo via gRPC
        return $this->json(['message' => 'Project created'], 201);
    }

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}', name: 'projects.show', summary: 'Get project', tags: ['Projects'])]
    public function show(ServerRequestInterface $request, int $projectId): Response
    {
        $project = $this->projectRepo->find($projectId);
        if (!$project)
            return $this->json(['error' => 'Not found'], 404);
        return $this->json($project);
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

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/environments', name: 'envs.index', summary: 'List environments', tags: ['Environments'])]
    public function environments(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json($this->envRepo->findByProject($projectId));
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/environments', name: 'envs.store', summary: 'Create environment', tags: ['Environments'])]
    public function createEnvironment(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json(['message' => 'Created'], 201);
    }

    #[Route(methods: 'PUT', path: '/api/v1/environments/{envId}', name: 'envs.update', summary: 'Update environment', tags: ['Environments'])]
    public function updateEnvironment(ServerRequestInterface $request, int $envId): Response
    {
        return $this->json(['message' => 'Updated']);
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

    private function json(mixed $data, int $status = 200): Response
    {
        $body = Stream::createFromString(json_encode($data));
        return new Response($body, $status, ['Content-Type' => 'application/json']);
    }
}
