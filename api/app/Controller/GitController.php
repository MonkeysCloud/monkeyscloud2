<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use App\Repository\PullRequestRepository;
use App\Repository\PrReviewRepository;
use App\Repository\PrCommentRepository;
use App\Repository\CommitRepository;
use Psr\Http\Message\ServerRequestInterface;

final class GitController
{
    public function __construct(
        private PullRequestRepository $prRepo,
        private PrReviewRepository $reviewRepo,
        private PrCommentRepository $commentRepo,
        private CommitRepository $commitRepo,
    ) {
    }

    // --- Commits ---

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/commits', name: 'commits.index', summary: 'List commits', tags: ['Git'])]
    public function commits(ServerRequestInterface $request, int $projectId): Response
    {
        $branch = $request->getQueryParams()['branch'] ?? null;
        return $this->json($this->commitRepo->findByProject($projectId, $branch));
    }

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/commits/{sha}', name: 'commits.show', summary: 'Get commit', tags: ['Git'])]
    public function showCommit(ServerRequestInterface $request, int $projectId, string $sha): Response
    {
        $commit = $this->commitRepo->findBySha($projectId, $sha);
        if (!$commit)
            return $this->json(['error' => 'Not found'], 404);
        return $this->json($commit);
    }

    // --- Pull Requests ---

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/pull-requests', name: 'prs.index', summary: 'List PRs', tags: ['Git'])]
    public function pullRequests(ServerRequestInterface $request, int $projectId): Response
    {
        $status = $request->getQueryParams()['status'] ?? null;
        return $this->json($this->prRepo->findByProject($projectId, $status));
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/pull-requests', name: 'prs.store', summary: 'Create PR', tags: ['Git'])]
    public function createPR(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json(['message' => 'PR created'], 201);
    }

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/pull-requests/{prNumber}', name: 'prs.show', summary: 'Get PR', tags: ['Git'])]
    public function showPR(ServerRequestInterface $request, int $projectId, int $prNumber): Response
    {
        $pr = $this->prRepo->findByNumber($projectId, $prNumber);
        if (!$pr)
            return $this->json(['error' => 'Not found'], 404);
        return $this->json($pr);
    }

    #[Route(methods: 'PUT', path: '/api/v1/projects/{projectId}/pull-requests/{prNumber}', name: 'prs.update', summary: 'Update PR', tags: ['Git'])]
    public function updatePR(ServerRequestInterface $request, int $projectId, int $prNumber): Response
    {
        return $this->json(['message' => 'Updated']);
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/pull-requests/{prNumber}/merge', name: 'prs.merge', summary: 'Merge PR', tags: ['Git'])]
    public function mergePR(ServerRequestInterface $request, int $projectId, int $prNumber): Response
    {
        // TODO: Call Go Git server gRPC → merge, update PR status
        return $this->json(['message' => 'Merged']);
    }

    // --- PR Reviews ---

    #[Route(methods: 'GET', path: '/api/v1/pull-requests/{prId}/reviews', name: 'prs.reviews.index', summary: 'List reviews', tags: ['Git'])]
    public function reviews(ServerRequestInterface $request, int $prId): Response
    {
        return $this->json($this->reviewRepo->findByPullRequest($prId));
    }

    #[Route(methods: 'POST', path: '/api/v1/pull-requests/{prId}/reviews', name: 'prs.reviews.store', summary: 'Submit review', tags: ['Git'])]
    public function submitReview(ServerRequestInterface $request, int $prId): Response
    {
        return $this->json(['message' => 'Review submitted'], 201);
    }

    // --- PR Comments ---

    #[Route(methods: 'GET', path: '/api/v1/pull-requests/{prId}/comments', name: 'prs.comments.index', summary: 'List comments', tags: ['Git'])]
    public function prComments(ServerRequestInterface $request, int $prId): Response
    {
        return $this->json($this->commentRepo->findByPullRequest($prId));
    }

    #[Route(methods: 'POST', path: '/api/v1/pull-requests/{prId}/comments', name: 'prs.comments.store', summary: 'Add comment', tags: ['Git'])]
    public function addPRComment(ServerRequestInterface $request, int $prId): Response
    {
        return $this->json(['message' => 'Comment added'], 201);
    }

    // --- Internal Git webhooks (called by Go Git server) ---

    #[Route(methods: 'POST', path: '/internal/git/pre-receive', name: 'git.preReceive', summary: 'Pre-receive hook', tags: ['Internal'])]
    public function preReceive(ServerRequestInterface $request): Response
    {
        // TODO: validate branch protection
        return $this->json(['allowed' => true]);
    }

    #[Route(methods: 'POST', path: '/internal/git/post-receive', name: 'git.postReceive', summary: 'Post-receive hook', tags: ['Internal'])]
    public function postReceive(ServerRequestInterface $request): Response
    {
        // TODO: create commit records, link tasks, fire webhooks
        return $this->json(['received' => true]);
    }

    #[Route(methods: 'POST', path: '/internal/git/webhook', name: 'git.webhook', summary: 'Fire outgoing webhooks', tags: ['Internal'])]
    public function fireWebhooks(ServerRequestInterface $request): Response
    {
        // TODO: dispatch webhook delivery jobs
        return $this->json(['queued' => true]);
    }

    private function json(mixed $data, int $status = 200): Response
    {
        $body = Stream::createFromString(json_encode($data));
        return new Response($body, $status, ['Content-Type' => 'application/json']);
    }
}
