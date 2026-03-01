<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\Ai\CodeReviewService;
use App\Service\Ai\PrSummaryService;
use App\Service\Ai\BuildAnalysisService;
use App\Service\Ai\DeployRiskService;
use App\Repository\AiRequestRepository;
use MonkeysLegion\Router\Attribute\Route;
use Psr\Http\Message\ServerRequestInterface;

/**
 * AI endpoints for code review, PR summaries, build analysis, and deploy risk.
 */
final class AiController
{
    public function __construct(
        private CodeReviewService $codeReview,
        private PrSummaryService $prSummary,
        private BuildAnalysisService $buildAnalysis,
        private DeployRiskService $deployRisk,
        private AiRequestRepository $aiRepo,
    ) {
    }

    // ── Usage & History ─────────────────────────────────────

    #[Route('GET', '/api/v1/organizations/{orgId}/ai/usage', name: 'ai.usage')]
    public function usage(ServerRequestInterface $request, int $orgId): array
    {
        $requests = $this->aiRepo->findByOrganization($orgId);

        $totalCost = 0;
        $totalTokens = 0;
        $byType = [];

        foreach ($requests as $req) {
            $totalCost += (float) $req->cost_usd;
            $totalTokens += $req->input_tokens + $req->output_tokens;
            $type = $req->type;
            $byType[$type] = ($byType[$type] ?? 0) + 1;
        }

        return [
            'total_requests' => count($requests),
            'total_cost_usd' => round($totalCost, 4),
            'total_tokens' => $totalTokens,
            'by_type' => $byType,
            'model' => getenv('VERTEX_AI_MODEL') ?: 'gemini-2.0-flash',
        ];
    }

    #[Route('GET', '/api/v1/organizations/{orgId}/ai/history', name: 'ai.history')]
    public function history(ServerRequestInterface $request, int $orgId): array
    {
        $page = (int) ($request->getQueryParams()['page'] ?? 1);
        $limit = min((int) ($request->getQueryParams()['limit'] ?? 20), 100);

        return $this->aiRepo->findByOrganizationPaginated($orgId, $page, $limit);
    }

    // ── Code Review ─────────────────────────────────────────

    #[Route('POST', '/api/v1/projects/{projectId}/ai/review', name: 'ai.review')]
    public function review(ServerRequestInterface $request, int $projectId): array
    {
        $body = $request->getParsedBody();

        return $this->codeReview->review(
            diff: $body['diff'] ?? '',
            prTitle: $body['pr_title'] ?? '',
            prBody: $body['pr_body'] ?? '',
            language: $body['language'] ?? 'unknown',
            orgId: $body['organization_id'] ?? 0,
            userId: $body['user_id'] ?? 0,
            projectId: $projectId,
        );
    }

    // ── PR Summary ──────────────────────────────────────────

    #[Route('POST', '/api/v1/projects/{projectId}/ai/pr-summary', name: 'ai.prSummary')]
    public function prSummary(ServerRequestInterface $request, int $projectId): array
    {
        $body = $request->getParsedBody();

        return $this->prSummary->summarize(
            diff: $body['diff'] ?? '',
            branch: $body['branch'] ?? 'main',
            commits: $body['commits'] ?? [],
            orgId: $body['organization_id'] ?? 0,
            userId: $body['user_id'] ?? 0,
            projectId: $projectId,
        );
    }

    // ── Build Analysis ──────────────────────────────────────

    #[Route('POST', '/api/v1/builds/{buildId}/ai/analyze', name: 'ai.buildAnalysis')]
    public function buildAnalysis(ServerRequestInterface $request, int $buildId): array
    {
        $body = $request->getParsedBody();

        return $this->buildAnalysis->analyze(
            buildLog: $body['build_log'] ?? '',
            failedStep: $body['failed_step'] ?? 'Unknown',
            stack: $body['stack'] ?? 'unknown',
            exitCode: $body['exit_code'] ?? '1',
            orgId: $body['organization_id'] ?? 0,
            userId: $body['user_id'] ?? 0,
            projectId: $body['project_id'] ?? 0,
        );
    }

    // ── Deploy Risk ─────────────────────────────────────────

    #[Route('POST', '/api/v1/deployments/{deploymentId}/ai/risk', name: 'ai.deployRisk')]
    public function deployRisk(ServerRequestInterface $request, int $deploymentId): array
    {
        $body = $request->getParsedBody();

        return $this->deployRisk->assess(
            diff: $body['diff'] ?? '',
            environment: $body['environment'] ?? 'staging',
            stack: $body['stack'] ?? 'unknown',
            recentDeploys: $body['recent_deploys'] ?? [],
            affectedFiles: $body['affected_files'] ?? [],
            orgId: $body['organization_id'] ?? 0,
            userId: $body['user_id'] ?? 0,
            projectId: $body['project_id'] ?? 0,
        );
    }
}
