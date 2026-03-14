<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use MonkeysLegion\Router\Attributes\Middleware;
use App\Repository\OrganizationRepository;
use App\Repository\ProjectRepository;
use Psr\Http\Message\ServerRequestInterface;

#[Middleware('auth')]
final class CodeController extends AbstractController
{
    public function __construct(
        private OrganizationRepository $orgRepo,
        private ProjectRepository $projectRepo,
    ) {
    }

    // -------------------------------------------------------------------------
    // Branches
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/branches', name: 'code.branches', summary: 'List branches', tags: ['Code'])]
    public function branches(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        return $this->proxyGitServer($orgId, $projectSlug, 'branches');
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/branches/detailed', name: 'code.branches.detailed', summary: 'List branches with ahead/behind', tags: ['Code'])]
    public function branchesDetailed(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        return $this->proxyGitServer($orgId, $projectSlug, 'branches/detailed');
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/branches', name: 'code.branches.create', summary: 'Create a branch', tags: ['Code'])]
    public function createBranch(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $body = (string) $request->getBody();
        return $this->proxyGitServerPost($orgId, $projectSlug, 'branches', $body);
    }

    // -------------------------------------------------------------------------
    // Commits
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/commits', name: 'code.commits', summary: 'List commits', tags: ['Code'])]
    public function commits(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $branch = $request->getQueryParams()['branch'] ?? 'main';
        $limit = (int) ($request->getQueryParams()['limit'] ?? 20);
        $offset = (int) ($request->getQueryParams()['offset'] ?? 0);
        return $this->proxyGitServer($orgId, $projectSlug, "commits?branch=" . urlencode($branch) . "&limit={$limit}&offset={$offset}");
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/commits/{sha}', name: 'code.commit.detail', summary: 'Get commit detail with diff', tags: ['Code'])]
    public function commitDetail(ServerRequestInterface $request, int $orgId, string $projectSlug, string $sha): Response
    {
        return $this->proxyGitServer($orgId, $projectSlug, "commits/{$sha}");
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/tree-commits', name: 'code.tree-commits', summary: 'Last commit per tree entry', tags: ['Code'])]
    public function treeCommits(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $ref = $request->getQueryParams()['ref'] ?? 'main';
        $path = $request->getQueryParams()['path'] ?? '';
        return $this->proxyGitServer($orgId, $projectSlug, "tree-commits?ref=" . urlencode($ref) . "&path=" . urlencode($path));
    }

    // -------------------------------------------------------------------------
    // Tags
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/tags', name: 'code.tags.list', summary: 'List tags', tags: ['Code'])]
    public function listTags(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        return $this->proxyGitServer($orgId, $projectSlug, "tags");
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/tags', name: 'code.tags.create', summary: 'Create tag', tags: ['Code'])]
    public function createTag(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $body = (string) $request->getBody();
        return $this->proxyGitServerPost($orgId, $projectSlug, "tags", $body);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/tags', name: 'code.tags.delete', summary: 'Delete tag', tags: ['Code'])]
    public function deleteTag(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $orgSlug = $this->resolveOrgSlug($orgId);
        if ($orgSlug === null) {
            return $this->json(['error' => 'Organization not found'], 404);
        }

        $url = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/tags";
        $jsonBody = (string) $request->getBody();

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_CUSTOMREQUEST => 'DELETE',
            CURLOPT_POSTFIELDS => $jsonBody,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if ($body === false || $httpCode === 0) {
            return $this->json(['error' => 'Git server unreachable'], 502);
        }
        if ($httpCode >= 400) {
            return $this->json(['error' => trim($body)], $httpCode);
        }

        $stream = Stream::createFromString($body);
        return new Response($stream, $httpCode, ['Content-Type' => 'application/json']);
    }

    // -------------------------------------------------------------------------
    // Diff
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/diff/{base}...{head}', name: 'code.diff', summary: 'Diff between refs', tags: ['Code'])]
    public function diff(ServerRequestInterface $request, int $orgId, string $projectSlug, string $base, string $head): Response
    {
        return $this->proxyGitServerRaw($orgId, $projectSlug, "diff/{$base}...{$head}");
    }

    // -------------------------------------------------------------------------
    // Compare (commits + diff + files between two branches)
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/compare', name: 'code.compare', summary: 'Compare branches', tags: ['Code'])]
    public function compare(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $params = $request->getQueryParams();
        $base = $params['base'] ?? '';
        $head = $params['head'] ?? '';

        if ($base === '' || $head === '') {
            return $this->json(['error' => 'base and head query params are required'], 400);
        }

        $orgSlug = $this->resolveOrgSlug($orgId);
        if ($orgSlug === null) {
            return $this->json(['error' => 'Organization not found'], 404);
        }

        $gitUrl = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}";

        // 1. Fetch commits on head branch (to extract commit messages)
        $commitsUrl = "{$gitUrl}/commits?branch=" . urlencode($head) . "&limit=50";
        $ch = curl_init($commitsUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $commitsBody = curl_exec($ch);
        $commitsCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $commits = [];
        if ($commitsBody !== false && $commitsCode < 400) {
            $parsed = json_decode($commitsBody, true);
            $commits = is_array($parsed) ? $parsed : [];
        }

        // Also fetch commits on base branch to find divergence point
        $baseCommitsUrl = "{$gitUrl}/commits?branch=" . urlencode($base) . "&limit=50";
        $ch2 = curl_init($baseCommitsUrl);
        curl_setopt_array($ch2, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $baseBody = curl_exec($ch2);
        $baseCode = curl_getinfo($ch2, CURLINFO_HTTP_CODE);
        $baseCommits = [];
        if ($baseBody !== false && $baseCode < 400) {
            $parsed = json_decode($baseBody, true);
            $baseCommits = is_array($parsed) ? $parsed : [];
        }

        // Find commits unique to head (not in base)
        $baseShas = array_column($baseCommits, 'sha');
        $uniqueCommits = [];
        foreach ($commits as $c) {
            if (!in_array($c['sha'] ?? '', $baseShas, true)) {
                $uniqueCommits[] = $c;
            }
        }

        // 2. Fetch diff
        $diffUrl = "{$gitUrl}/diff/{$base}...{$head}";
        $ch3 = curl_init($diffUrl);
        curl_setopt_array($ch3, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $diffText = curl_exec($ch3);
        $diffCode = curl_getinfo($ch3, CURLINFO_HTTP_CODE);
        if ($diffText === false || $diffCode >= 400) {
            $diffText = '';
        }

        // 3. Parse diff to extract files and stats
        $files = [];
        $totalAdditions = 0;
        $totalDeletions = 0;
        $currentFile = null;

        foreach (explode("\n", $diffText) as $line) {
            if (str_starts_with($line, 'diff --git')) {
                // Save previous file
                if ($currentFile !== null) {
                    $files[] = $currentFile;
                }
                // Extract filename
                preg_match('/b\/(.+)$/', $line, $m);
                $currentFile = [
                    'path' => $m[1] ?? 'unknown',
                    'additions' => 0,
                    'deletions' => 0,
                    'status' => 'modified',
                ];
            } elseif ($currentFile !== null) {
                if (str_starts_with($line, 'new file')) {
                    $currentFile['status'] = 'added';
                } elseif (str_starts_with($line, 'deleted file')) {
                    $currentFile['status'] = 'deleted';
                } elseif (str_starts_with($line, 'rename from')) {
                    $currentFile['status'] = 'renamed';
                } elseif (str_starts_with($line, '+') && !str_starts_with($line, '+++')) {
                    $currentFile['additions']++;
                    $totalAdditions++;
                } elseif (str_starts_with($line, '-') && !str_starts_with($line, '---')) {
                    $currentFile['deletions']++;
                    $totalDeletions++;
                }
            }
        }
        if ($currentFile !== null) {
            $files[] = $currentFile;
        }

        // 4. Generate suggested title and description
        $suggestedTitle = '';
        $suggestedDescription = '';

        if (count($uniqueCommits) === 1) {
            // Single commit — use its message as title
            $msg = $uniqueCommits[0]['message'] ?? '';
            $parts = explode("\n", $msg, 2);
            $suggestedTitle = trim($parts[0]);
            $suggestedDescription = trim($parts[1] ?? '');
        } elseif (count($uniqueCommits) > 1) {
            // Multiple commits — use branch name as title, list commits in description
            $cleanBranch = preg_replace('/^(feature|fix|hotfix|bugfix|chore|refactor)\//', '', $head);
            $suggestedTitle = ucfirst(str_replace(['-', '_'], ' ', $cleanBranch));
            $lines = [];
            foreach (array_slice($uniqueCommits, 0, 20) as $c) {
                $shortSha = substr($c['sha'] ?? '', 0, 7);
                $firstLine = explode("\n", $c['message'] ?? '')[0];
                $lines[] = "- {$shortSha} {$firstLine}";
            }
            if (count($uniqueCommits) > 20) {
                $lines[] = "- ... and " . (count($uniqueCommits) - 20) . " more commits";
            }
            $suggestedDescription = implode("\n", $lines);
        }

        return $this->json([
            'commits' => $uniqueCommits,
            'commit_count' => count($uniqueCommits),
            'files' => $files,
            'file_count' => count($files),
            'additions' => $totalAdditions,
            'deletions' => $totalDeletions,
            'diff' => $diffText,
            'suggested_title' => $suggestedTitle,
            'suggested_description' => $suggestedDescription,
        ]);
    }

    // -------------------------------------------------------------------------
    // File Tree
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/tree', name: 'code.tree', summary: 'File tree listing', tags: ['Code'])]
    public function tree(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $params = $request->getQueryParams();
        $ref = $params['ref'] ?? 'main';
        $path = $params['path'] ?? '';

        $qs = http_build_query(['ref' => $ref, 'path' => $path]);
        return $this->proxyGitServer($orgId, $projectSlug, "tree?{$qs}");
    }

    // -------------------------------------------------------------------------
    // File Content (blob)
    // -------------------------------------------------------------------------

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectSlug}/code/blob', name: 'code.blob', summary: 'File content', tags: ['Code'])]
    public function blob(ServerRequestInterface $request, int $orgId, string $projectSlug): Response
    {
        $params = $request->getQueryParams();
        $ref = $params['ref'] ?? 'main';
        $path = $params['path'] ?? '';

        if ($path === '') {
            return $this->json(['error' => 'path is required'], 400);
        }

        $qs = http_build_query(['ref' => $ref, 'path' => $path]);
        return $this->proxyGitServerRaw($orgId, $projectSlug, "blob?{$qs}");
    }

    // -------------------------------------------------------------------------
    // Proxy helpers
    // -------------------------------------------------------------------------

    /**
     * Proxy a JSON response from the git-server.
     */
    private function proxyGitServer(int $orgId, string $projectSlug, string $endpoint): Response
    {
        $orgSlug = $this->resolveOrgSlug($orgId);
        if ($orgSlug === null) {
            return $this->json(['error' => 'Organization not found'], 404);
        }

        $url = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/{$endpoint}";

        error_log("CODE_PROXY: GET {$url}");

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => ['Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);

        if ($body === false || $httpCode === 0) {
            error_log("CODE_PROXY_ERROR: {$curlErr}");
            return $this->json(['error' => 'Git server unreachable: ' . $curlErr], 502);
        }

        if ($httpCode >= 400) {
            error_log("CODE_PROXY_WARN: HTTP {$httpCode} — {$body}");
            // Empty repo / no refs — return empty array instead of error
            return $this->json([]);
        }

        $stream = Stream::createFromString($body);
        return new Response($stream, 200, ['Content-Type' => 'application/json']);
    }

    /**
     * Proxy a raw text response from the git-server (for file content).
     */
    private function proxyGitServerRaw(int $orgId, string $projectSlug, string $endpoint): Response
    {
        $orgSlug = $this->resolveOrgSlug($orgId);
        if ($orgSlug === null) {
            return $this->json(['error' => 'Organization not found'], 404);
        }

        $url = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/{$endpoint}";

        error_log("CODE_PROXY_RAW: GET {$url}");

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 5,
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);

        if ($body === false || $httpCode === 0) {
            error_log("CODE_PROXY_RAW_ERROR: {$curlErr}");
            return $this->json(['error' => 'Git server unreachable: ' . $curlErr], 502);
        }

        if ($httpCode >= 400) {
            error_log("CODE_PROXY_RAW_ERROR: HTTP {$httpCode} — {$body}");
            return $this->json(['error' => 'Git server error', 'details' => $body], $httpCode >= 500 ? 502 : $httpCode);
        }

        $stream = Stream::createFromString($body);
        return new Response($stream, 200, [
            'Content-Type' => 'text/plain; charset=utf-8',
            'Content-Length' => (string) strlen($body),
        ]);
    }

    /**
     * Proxy a POST JSON request to the git-server.
     */
    private function proxyGitServerPost(int $orgId, string $projectSlug, string $endpoint, string $jsonBody): Response
    {
        $orgSlug = $this->resolveOrgSlug($orgId);
        if ($orgSlug === null) {
            return $this->json(['error' => 'Organization not found'], 404);
        }

        $url = $this->gitServerUrl() . "/api/code/{$orgSlug}/{$projectSlug}/{$endpoint}";

        error_log("CODE_PROXY_POST: POST {$url}");

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $jsonBody,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Accept: application/json'],
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);

        if ($body === false || $httpCode === 0) {
            error_log("CODE_PROXY_POST_ERROR: {$curlErr}");
            return $this->json(['error' => 'Git server unreachable: ' . $curlErr], 502);
        }

        if ($httpCode >= 400) {
            error_log("CODE_PROXY_POST_ERROR: HTTP {$httpCode} — {$body}");
            return $this->json(['error' => trim($body)], $httpCode);
        }

        $stream = Stream::createFromString($body);
        return new Response($stream, $httpCode, ['Content-Type' => 'application/json']);
    }

    private function resolveOrgSlug(int $orgId): ?string
    {
        return $this->orgRepo->findSlugById($orgId);
    }

    private function gitServerUrl(): string
    {
        return rtrim($_ENV['GIT_SERVER_URL'] ?? getenv('GIT_SERVER_URL') ?: 'http://localhost:3001', '/');
    }
}
