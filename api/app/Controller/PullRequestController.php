<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use MonkeysLegion\Router\Attributes\Middleware;
use App\Repository\OrganizationRepository;
use App\Repository\ProjectRepository;
use App\Repository\RepositoryRepository;
use App\Repository\PullRequestRepository;
use App\Repository\PrCommentRepository;
use App\Repository\PrActivityRepository;
use App\Repository\PrReviewRepository;
use App\Repository\UserRepository;
use App\Entity\PullRequest;
use App\Entity\PrComment;
use App\Entity\PrActivity;
use App\Entity\PrReview;
use Psr\Http\Message\ServerRequestInterface;

#[Middleware('auth')]
class PullRequestController
{
    public function __construct(
        private OrganizationRepository $orgRepo,
        private ProjectRepository $projectRepo,
        private RepositoryRepository $repoRepo,
        private PullRequestRepository $prRepo,
        private PrCommentRepository $commentRepo,
        private PrActivityRepository $activityRepo,
        private PrReviewRepository $reviewRepo,
        private UserRepository $userRepo,
    ) {
    }

    // -------------------------------------------------------------------------
    // List Pull Requests
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests', name: 'pr.list', summary: 'List pull requests', tags: ['Pull Requests'])]
    public function list(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $status = $request->getQueryParams()['status'] ?? null;
        $prs = $this->prRepo->findByRepository($repo->id, $status ?: null);

        $result = [];
        foreach ($prs as $pr) {
            $result[] = $this->serializePr($pr);
        }

        return $this->json($result);
    }

    // -------------------------------------------------------------------------
    // Create Pull Request
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests', name: 'pr.create', summary: 'Create a pull request', tags: ['Pull Requests'])]
    public function create(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $body = json_decode((string) $request->getBody(), true);
        if (!$body) {
            return $this->json(['error' => 'Invalid JSON body'], 400);
        }

        $title = trim($body['title'] ?? '');
        $sourceBranch = trim($body['source_branch'] ?? '');
        $targetBranch = trim($body['target_branch'] ?? $repo->default_branch);
        $description = trim($body['description'] ?? '');

        if ($title === '' || $sourceBranch === '') {
            return $this->json(['error' => 'title and source_branch are required'], 400);
        }

        if ($sourceBranch === $targetBranch) {
            return $this->json(['error' => 'Source and target branches must be different'], 400);
        }

        // Get user from auth
        $userId = $request->getAttribute('user_id') ?? $request->getAttribute('userId') ?? 0;

        $pr = new PullRequest();
        $pr->repository_id = $repo->id;
        $pr->number = $this->prRepo->nextNumber($repo->id);
        $pr->title = $title;
        $pr->description = $description ?: null;
        $pr->source_branch = $sourceBranch;
        $pr->target_branch = $targetBranch;
        $pr->author_id = (int) $userId;
        $pr->status = !empty($body['is_draft']) ? 'draft' : 'open';
        $pr->is_draft = !empty($body['is_draft']);
        $pr->created_at = new \DateTimeImmutable();
        $pr->updated_at = new \DateTimeImmutable();

        $this->prRepo->save($pr);

        return $this->json($this->serializePr($pr), 201);
    }

    // -------------------------------------------------------------------------
    // Get Single PR
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}', name: 'pr.show', summary: 'Get a pull request', tags: ['Pull Requests'])]
    public function show(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        return $this->json($this->serializePr($pr));
    }

    // -------------------------------------------------------------------------
    // Update PR (title / description) — only when open/draft
    // -------------------------------------------------------------------------

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}', name: 'pr.update', summary: 'Update a pull request', tags: ['Pull Requests'])]
    public function update(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        if ($pr->status !== 'open' && $pr->status !== 'draft') {
            return $this->json(['error' => 'Cannot update a merged or closed pull request'], 403);
        }

        $body = json_decode((string) $request->getBody(), true) ?? [];
        $userId = $request->getAttribute('user_id') ?? $request->getAttribute('userId');
        $changed = false;

        if (isset($body['title']) && trim($body['title']) !== '' && trim($body['title']) !== $pr->title) {
            $oldTitle = $pr->title;
            $pr->title = trim($body['title']);
            $changed = true;
            $this->logActivity($pr->id, $userId ? (int) $userId : null, 'title_changed', $oldTitle, $pr->title);
        }

        if (array_key_exists('description', $body) && $body['description'] !== $pr->description) {
            $oldDesc = $pr->description;
            $pr->description = $body['description'];
            $changed = true;
            $this->logActivity($pr->id, $userId ? (int) $userId : null, 'description_changed', $oldDesc, $pr->description);
        }

        if (array_key_exists('is_draft', $body)) {
            $wantDraft = (bool) $body['is_draft'];
            if ($wantDraft !== $pr->is_draft) {
                $pr->is_draft = $wantDraft;
                $pr->status = $wantDraft ? 'draft' : 'open';
                $changed = true;
                $this->logActivity($pr->id, $userId ? (int) $userId : null, $wantDraft ? 'marked_draft' : 'marked_ready');
            }
        }

        if (!$changed) {
            return $this->json(['error' => 'No fields to update'], 422);
        }

        $pr->updated_at = new \DateTimeImmutable();
        $this->prRepo->save($pr);

        // Publish real-time event so other viewers see the change
        $project = $this->projectRepo->findOneBy(['slug' => $projectSlug, 'organization_id' => $orgId]);
        $this->publishPrEvent($project?->id, $pr->number, 'updated');

        return $this->json($this->serializePr($pr));
    }

    // -------------------------------------------------------------------------
    // List Commits (from git-server)
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/commits', name: 'pr.commits', summary: 'List PR commits', tags: ['Pull Requests'])]
    public function listCommits(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        $orgSlug = $this->resolveOrgSlug($orgId);
        $url = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/commits?branch=" . urlencode($pr->source_branch);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($body === false || $httpCode >= 400) {
            return $this->json(['error' => 'Failed to fetch commits'], 502);
        }

        $commits = json_decode($body, true);
        if (!is_array($commits)) {
            return $this->json([]);
        }

        return $this->json($commits);
    }

    // -------------------------------------------------------------------------
    // Get Diff (live from git-server)
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/diff', name: 'pr.diff', summary: 'Get PR diff', tags: ['Pull Requests'])]
    public function diff(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        // If PR is merged/closed and diff was stored, return from DB
        if (($pr->status === 'merged' || $pr->status === 'closed') && $pr->diff_text !== null) {
            $stream = Stream::createFromString($pr->diff_text);
            return new Response($stream, 200, ['Content-Type' => 'text/plain; charset=utf-8']);
        }

        // Otherwise fetch live diff from git-server
        $orgSlug = $this->resolveOrgSlug($orgId);
        $url = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/diff/{$pr->target_branch}...{$pr->source_branch}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($body === false || $httpCode >= 400) {
            return $this->json(['error' => 'Could not generate diff', 'details' => (string) $body], 502);
        }

        $stream = Stream::createFromString($body);
        return new Response($stream, 200, ['Content-Type' => 'text/plain; charset=utf-8']);
    }

    // -------------------------------------------------------------------------
    // Merge PR
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/merge', name: 'pr.merge', summary: 'Merge a pull request', tags: ['Pull Requests'])]
    public function merge(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        if ($pr->status !== 'open' && $pr->status !== 'draft') {
            return $this->json(['error' => 'Pull request is already ' . $pr->status], 400);
        }

        $body = json_decode((string) $request->getBody(), true) ?? [];
        $strategy = $body['strategy'] ?? 'merge';
        $userId = $request->getAttribute('user_id') ?? $request->getAttribute('userId') ?? 0;

        // 1. Fetch and store the diff before merge
        $orgSlug = $this->resolveOrgSlug($orgId);
        $diffUrl = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/diff/{$pr->target_branch}...{$pr->source_branch}";
        $ch = curl_init($diffUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $diffText = curl_exec($ch);
        if ($diffText !== false) {
            $pr->diff_text = $diffText;

            // Parse stats from diff
            $additions = 0;
            $deletions = 0;
            $filesChanged = [];
            foreach (explode("\n", $diffText) as $line) {
                if (str_starts_with($line, '+') && !str_starts_with($line, '+++')) {
                    $additions++;
                } elseif (str_starts_with($line, '-') && !str_starts_with($line, '---')) {
                    $deletions++;
                } elseif (str_starts_with($line, 'diff --git')) {
                    preg_match('/b\/(.+)$/', $line, $m);
                    if (isset($m[1]))
                        $filesChanged[$m[1]] = true;
                }
            }
            $pr->additions = $additions;
            $pr->deletions = $deletions;
            $pr->files_changed = count($filesChanged);
        }

        // 2. Call git-server merge
        $mergeUrl = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/merge";
        $ch = curl_init($mergeUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode([
                'source_branch' => $pr->source_branch,
                'target_branch' => $pr->target_branch,
                'strategy' => $strategy,
                'author_name' => 'MonkeysCloud',
                'author_email' => 'merge@monkeyscloud.com',
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        ]);
        $mergeBody = curl_exec($ch);
        $mergeCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($mergeBody === false || $mergeCode >= 400) {
            return $this->json([
                'error' => 'Merge failed',
                'details' => json_decode($mergeBody ?: '{}', true),
            ], 502);
        }

        $mergeResult = json_decode($mergeBody, true) ?? [];

        // 3. Update PR in database
        $pr->status = 'merged';
        $pr->merged_by = (int) $userId;
        $pr->merged_at = new \DateTimeImmutable();
        $pr->merge_strategy = $strategy;
        $pr->merge_commit_sha = $mergeResult['merge_sha'] ?? null;
        $pr->updated_at = new \DateTimeImmutable();

        $this->prRepo->save($pr);

        // Publish real-time event
        $project = $this->projectRepo->findOneBy(['slug' => $projectSlug, 'organization_id' => $orgId]);
        $this->publishPrEvent($project?->id, $pr->number, 'merged', $pr->source_branch);

        return $this->json([
            'status' => 'merged',
            'merge_sha' => $pr->merge_commit_sha,
            'strategy' => $strategy,
            'additions' => $pr->additions,
            'deletions' => $pr->deletions,
            'files_changed' => $pr->files_changed,
        ]);
    }

    // -------------------------------------------------------------------------
    // Close PR
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/close', name: 'pr.close', summary: 'Close a pull request', tags: ['Pull Requests'])]
    public function close(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        if ($pr->status !== 'open' && $pr->status !== 'draft') {
            return $this->json(['error' => 'Pull request is already ' . $pr->status], 400);
        }

        // Store diff before closing
        $orgSlug = $this->resolveOrgSlug($orgId);
        $diffUrl = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/diff/{$pr->target_branch}...{$pr->source_branch}";
        $ch = curl_init($diffUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $diffText = curl_exec($ch);
        if ($diffText !== false && curl_getinfo($ch, CURLINFO_HTTP_CODE) < 400) {
            $pr->diff_text = $diffText;
        }

        $pr->status = 'closed';
        $pr->closed_at = new \DateTimeImmutable();
        $pr->updated_at = new \DateTimeImmutable();

        $this->prRepo->save($pr);

        // Publish real-time event
        $project = $this->projectRepo->findOneBy(['slug' => $projectSlug, 'organization_id' => $orgId]);
        $this->publishPrEvent($project?->id, $pr->number, 'closed', $pr->source_branch);

        return $this->json(['status' => 'closed', 'number' => $number]);
    }

    // -------------------------------------------------------------------------
    // Comments
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/comments', name: 'pr.comments.list', summary: 'List PR comments', tags: ['Pull Requests'])]
    public function listComments(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        $comments = $this->commentRepo->findByPullRequest($pr->id);
        $result = [];
        foreach ($comments as $c) {
            $result[] = $this->serializeComment($c);
        }

        return $this->json($result);
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/comments', name: 'pr.comments.create', summary: 'Add a PR comment', tags: ['Pull Requests'])]
    public function createComment(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo) {
            return $this->json(['error' => 'Repository not found'], 404);
        }

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr) {
            return $this->json(['error' => 'Pull request not found'], 404);
        }

        $body = json_decode((string) $request->getBody(), true);
        if (!$body || empty(trim($body['body'] ?? ''))) {
            return $this->json(['error' => 'body is required'], 400);
        }

        $userId = $request->getAttribute('user_id') ?? $request->getAttribute('userId');

        $comment = new PrComment();
        $comment->pull_request_id = $pr->id;
        $comment->user_id = ($userId !== null && $userId !== '') ? (int) $userId : null;
        $comment->body = trim($body['body']);
        $comment->file_path = isset($body['file_path']) ? trim($body['file_path']) : null;
        $comment->line_number = isset($body['line_number']) ? (int) $body['line_number'] : null;
        $comment->side = in_array($body['side'] ?? '', ['left', 'right']) ? $body['side'] : null;
        $comment->parent_id = isset($body['parent_id']) ? (int) $body['parent_id'] : null;
        $comment->commit_sha = isset($body['commit_sha']) ? trim($body['commit_sha']) : null;
        $comment->comment_type = in_array($body['comment_type'] ?? '', ['comment', 'change_request']) ? $body['comment_type'] : 'comment';
        $comment->created_at = new \DateTimeImmutable();
        $comment->updated_at = new \DateTimeImmutable();

        $this->commentRepo->save($comment);

        // Update comment count on PR
        $pr->comments_count = $pr->comments_count + 1;
        $pr->updated_at = new \DateTimeImmutable();
        $this->prRepo->save($pr);

        // Publish real-time event with comment data
        $project = $this->projectRepo->findOneBy(['slug' => $projectSlug, 'organization_id' => $orgId]);
        $this->publishPrEvent($project?->id, $pr->number, 'comment', null, $this->serializeComment($comment));

        return $this->json($this->serializeComment($comment), 201);
    }

    // -------------------------------------------------------------------------
    // Resolve Comment
    // -------------------------------------------------------------------------

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/comments/{commentId}/resolve', name: 'pr.comments.resolve', summary: 'Resolve a comment', tags: ['Pull Requests'])]
    public function resolveComment(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number, int $commentId): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo)
            return $this->json(['error' => 'Repository not found'], 404);

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr)
            return $this->json(['error' => 'Pull request not found'], 404);

        $comment = $this->commentRepo->find($commentId);
        if (!$comment || $comment->pull_request_id !== $pr->id) {
            return $this->json(['error' => 'Comment not found'], 404);
        }

        $userId = $request->getAttribute('user_id') ?? $request->getAttribute('userId');
        $comment->is_resolved = true;
        $comment->resolved_by = $userId ? (int) $userId : null;
        $comment->updated_at = new \DateTimeImmutable();
        $this->commentRepo->save($comment);

        // Publish real-time event
        $project = $this->projectRepo->findOneBy(['slug' => $projectSlug, 'organization_id' => $orgId]);
        $this->publishPrEvent($project?->id, $pr->number, 'updated');

        return $this->json($this->serializeComment($comment));
    }

    // -------------------------------------------------------------------------
    // List Activities
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/activities', name: 'pr.activities.list', summary: 'List PR activities', tags: ['Pull Requests'])]
    public function listActivities(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo)
            return $this->json(['error' => 'Repository not found'], 404);

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr)
            return $this->json(['error' => 'Pull request not found'], 404);

        $activities = $this->activityRepo->findByPullRequest($pr->id);
        $result = [];
        foreach ($activities as $a) {
            $result[] = $this->serializeActivity($a);
        }

        return $this->json($result);
    }

    // -------------------------------------------------------------------------
    // Submit Review
    // -------------------------------------------------------------------------

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/reviews', name: 'pr.reviews.create', summary: 'Submit a PR review', tags: ['Pull Requests'])]
    public function submitReview(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo)
            return $this->json(['error' => 'Repository not found'], 404);

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr)
            return $this->json(['error' => 'Pull request not found'], 404);

        $body = json_decode((string) $request->getBody(), true) ?? [];
        $status = $body['status'] ?? '';
        if (!in_array($status, ['approved', 'changes_requested', 'commented'])) {
            return $this->json(['error' => 'status must be approved, changes_requested, or commented'], 400);
        }

        $userId = $request->getAttribute('user_id') ?? $request->getAttribute('userId');

        $review = new PrReview();
        $review->pull_request_id = $pr->id;
        $review->reviewer_id = $userId ? (int) $userId : null;
        $review->status = $status;
        $review->body = isset($body['body']) ? trim($body['body']) : null;
        $review->created_at = new \DateTimeImmutable();
        $this->reviewRepo->save($review);

        // Update PR counters
        $pr->review_count = $pr->review_count + 1;
        if ($status === 'approved') {
            $pr->approval_count = $pr->approval_count + 1;
        }
        $pr->updated_at = new \DateTimeImmutable();
        $this->prRepo->save($pr);

        // Log activity
        $this->logActivity($pr->id, $userId ? (int) $userId : null, 'review_submitted', null, $status);

        // Publish real-time event
        $project = $this->projectRepo->findOneBy(['slug' => $projectSlug, 'organization_id' => $orgId]);
        $this->publishPrEvent($project?->id, $pr->number, 'review_submitted');

        return $this->json($this->serializeReview($review), 201);
    }

    // -------------------------------------------------------------------------
    // List Reviews
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/pull-requests/{number}/reviews', name: 'pr.reviews.list', summary: 'List PR reviews', tags: ['Pull Requests'])]
    public function listReviews(ServerRequestInterface $request, int $orgId, string $projectSlug, int $number): Response
    {
        $repo = $this->resolveRepository($orgId, $projectSlug);
        if (!$repo)
            return $this->json(['error' => 'Repository not found'], 404);

        $pr = $this->prRepo->findByNumber($repo->id, $number);
        if (!$pr)
            return $this->json(['error' => 'Pull request not found'], 404);

        $reviews = $this->reviewRepo->findByPullRequest($pr->id);
        $result = [];
        foreach ($reviews as $r) {
            $result[] = $this->serializeReview($r);
        }

        return $this->json($result);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private function resolveRepository(int $orgId, string $projectSlug): ?\App\Entity\Repository
    {
        $project = $this->projectRepo->findOneBy(['slug' => $projectSlug, 'organization_id' => $orgId]);
        if (!$project)
            return null;

        $repos = $this->repoRepo->findByProject($project->id);
        return $repos[0] ?? null;
    }

    private function resolveOrgSlug(int $orgId): ?string
    {
        $org = $this->orgRepo->find($orgId);
        return $org?->slug;
    }

    private function gitServerUrl(): string
    {
        return rtrim(getenv('GIT_SERVER_URL') ?: 'http://localhost:3001', '/');
    }

    private function serializePr(PullRequest $pr): array
    {
        $authorName = null;
        if ($pr->author_id) {
            $user = $this->userRepo->find($pr->author_id);
            $authorName = $user?->name ?? null;
        }

        return [
            'id' => $pr->id,
            'number' => $pr->number,
            'title' => $pr->title,
            'description' => $pr->description,
            'source_branch' => $pr->source_branch,
            'target_branch' => $pr->target_branch,
            'author_id' => $pr->author_id,
            'author_name' => $authorName,
            'status' => $pr->status,
            'is_draft' => $pr->is_draft,
            'merged_by' => $pr->merged_by,
            'merged_at' => $pr->merged_at?->format('c'),
            'closed_at' => $pr->closed_at?->format('c'),
            'merge_commit_sha' => $pr->merge_commit_sha,
            'merge_strategy' => $pr->merge_strategy,
            'additions' => $pr->additions,
            'deletions' => $pr->deletions,
            'files_changed' => $pr->files_changed,
            'review_count' => $pr->review_count,
            'approval_count' => $pr->approval_count,
            'comments_count' => $pr->comments_count,
            'created_at' => $pr->created_at->format('c'),
            'updated_at' => $pr->updated_at->format('c'),
        ];
    }

    private function serializeComment(PrComment $c): array
    {
        $userName = null;
        if ($c->user_id) {
            $user = $this->userRepo->find($c->user_id);
            $userName = $user?->name ?? null;
        }

        $resolvedByName = null;
        if ($c->resolved_by) {
            $resolver = $this->userRepo->find($c->resolved_by);
            $resolvedByName = $resolver?->name ?? null;
        }

        return [
            'id' => $c->id,
            'pull_request_id' => $c->pull_request_id,
            'user_id' => $c->user_id,
            'user_name' => $userName,
            'is_ai' => $c->is_ai,
            'body' => $c->body,
            'file_path' => $c->file_path,
            'line_number' => $c->line_number,
            'side' => $c->side,
            'parent_id' => $c->parent_id,
            'commit_sha' => $c->commit_sha,
            'is_resolved' => $c->is_resolved,
            'resolved_by' => $c->resolved_by,
            'resolved_by_name' => $resolvedByName,
            'comment_type' => $c->comment_type,
            'created_at' => $c->created_at->format('c'),
            'updated_at' => $c->updated_at->format('c'),
        ];
    }

    private function logActivity(int $prId, ?int $userId, string $action, ?string $oldValue = null, ?string $newValue = null): void
    {
        $activity = new PrActivity();
        $activity->pull_request_id = $prId;
        $activity->user_id = $userId;
        $activity->action = $action;
        $activity->old_value = $oldValue;
        $activity->new_value = $newValue;
        $activity->created_at = new \DateTimeImmutable();
        $this->activityRepo->save($activity);
    }

    private function serializeActivity(PrActivity $a): array
    {
        $userName = null;
        if ($a->user_id) {
            $user = $this->userRepo->find($a->user_id);
            $userName = $user?->name ?? null;
        }

        return [
            'id' => $a->id,
            'pull_request_id' => $a->pull_request_id,
            'user_id' => $a->user_id,
            'user_name' => $userName,
            'action' => $a->action,
            'old_value' => $a->old_value,
            'new_value' => $a->new_value,
            'created_at' => $a->created_at->format('c'),
        ];
    }

    private function serializeReview(PrReview $r): array
    {
        $reviewerName = null;
        if ($r->reviewer_id) {
            $user = $this->userRepo->find($r->reviewer_id);
            $reviewerName = $user?->name ?? null;
        }

        return [
            'id' => $r->id,
            'pull_request_id' => $r->pull_request_id,
            'reviewer_id' => $r->reviewer_id,
            'reviewer_name' => $reviewerName,
            'status' => $r->status,
            'body' => $r->body,
            'is_ai' => $r->is_ai,
            'created_at' => $r->created_at->format('c'),
        ];
    }

    private function publishPrEvent(?int $projectId, int $prNumber, string $action, ?string $branch = null, ?array $comment = null): void
    {
        try {
            $redis = $this->getRedis();
            if (!$redis)
                return;

            $payload = [
                'projectId' => $projectId,
                'prNumber' => $prNumber,
                'action' => $action,
            ];
            if ($branch)
                $payload['branch'] = $branch;
            if ($comment)
                $payload['comment'] = $comment;

            $redis->publish('ws:pr', json_encode($payload));
        } catch (\Throwable) {
            // Silently fail — WebSocket is best-effort
        }
    }

    private function getRedis(): ?\Redis
    {
        try {
            $redis = new \Redis();
            $redis->connect(
                getenv('REDIS_HOST') ?: 'redis',
                (int) (getenv('REDIS_PORT') ?: 6379)
            );
            return $redis;
        } catch (\Throwable) {
            return null;
        }
    }

    private function json(mixed $data, int $status = 200): Response
    {
        $stream = Stream::createFromString(json_encode($data, JSON_UNESCAPED_SLASHES));
        return new Response($stream, $status, ['Content-Type' => 'application/json']);
    }
}
