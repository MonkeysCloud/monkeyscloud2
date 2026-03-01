<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use App\Repository\BuildRepository;
use App\Repository\BuildStepRepository;
use App\Repository\DeploymentRepository;
use Psr\Http\Message\ServerRequestInterface;

final class BuildController
{
    public function __construct(
        private BuildRepository $buildRepo,
        private BuildStepRepository $stepRepo,
        private DeploymentRepository $deployRepo,
    ) {
    }

    // --- Builds ---

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/builds', name: 'builds.index', summary: 'List builds', tags: ['Builds'])]
    public function index(ServerRequestInterface $request, int $projectId): Response
    {
        $status = $request->getQueryParams()['status'] ?? null;
        return $this->json($this->buildRepo->findByProject($projectId, $status));
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/builds', name: 'builds.trigger', summary: 'Trigger build', tags: ['Builds'])]
    public function trigger(ServerRequestInterface $request, int $projectId): Response
    {
        // TODO: queue build job in Redis
        return $this->json(['message' => 'Build queued'], 201);
    }

    #[Route(methods: 'GET', path: '/api/v1/builds/{buildId}', name: 'builds.show', summary: 'Get build', tags: ['Builds'])]
    public function show(ServerRequestInterface $request, int $buildId): Response
    {
        $build = $this->buildRepo->find($buildId);
        if (!$build)
            return $this->json(['error' => 'Not found'], 404);
        return $this->json($build);
    }

    #[Route(methods: 'POST', path: '/api/v1/builds/{buildId}/cancel', name: 'builds.cancel', summary: 'Cancel build', tags: ['Builds'])]
    public function cancel(ServerRequestInterface $request, int $buildId): Response
    {
        return $this->json(['message' => 'Cancelled']);
    }

    #[Route(methods: 'POST', path: '/api/v1/builds/{buildId}/retry', name: 'builds.retry', summary: 'Retry build', tags: ['Builds'])]
    public function retry(ServerRequestInterface $request, int $buildId): Response
    {
        return $this->json(['message' => 'Retrying'], 201);
    }

    #[Route(methods: 'GET', path: '/api/v1/builds/{buildId}/log', name: 'builds.log', summary: 'Stream build log', tags: ['Builds'])]
    public function log(ServerRequestInterface $request, int $buildId): Response
    {
        $build = $this->buildRepo->find($buildId);
        $body = Stream::createFromString($build?->log ?? '');
        return new Response($body, 200, ['Content-Type' => 'text/plain']);
    }

    #[Route(methods: 'GET', path: '/api/v1/builds/{buildId}/steps', name: 'builds.steps', summary: 'List build steps', tags: ['Builds'])]
    public function steps(ServerRequestInterface $request, int $buildId): Response
    {
        return $this->json($this->stepRepo->findByBuild($buildId));
    }

    // --- Deployments ---

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/deployments', name: 'deploys.index', summary: 'List deployments', tags: ['Deployments'])]
    public function deployments(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json($this->deployRepo->findByProject($projectId));
    }

    #[Route(methods: 'POST', path: '/api/v1/builds/{buildId}/deploy', name: 'deploys.store', summary: 'Deploy build', tags: ['Deployments'])]
    public function deploy(ServerRequestInterface $request, int $buildId): Response
    {
        return $this->json(['message' => 'Deploying'], 201);
    }

    #[Route(methods: 'GET', path: '/api/v1/deployments/{deployId}', name: 'deploys.show', summary: 'Get deployment', tags: ['Deployments'])]
    public function showDeployment(ServerRequestInterface $request, int $deployId): Response
    {
        $deploy = $this->deployRepo->find($deployId);
        if (!$deploy)
            return $this->json(['error' => 'Not found'], 404);
        return $this->json($deploy);
    }

    #[Route(methods: 'POST', path: '/api/v1/deployments/{deployId}/rollback', name: 'deploys.rollback', summary: 'Rollback deployment', tags: ['Deployments'])]
    public function rollback(ServerRequestInterface $request, int $deployId): Response
    {
        return $this->json(['message' => 'Rolling back'], 201);
    }

    private function json(mixed $data, int $status = 200): Response
    {
        $body = Stream::createFromString(json_encode($data));
        return new Response($body, $status, ['Content-Type' => 'application/json']);
    }
}
