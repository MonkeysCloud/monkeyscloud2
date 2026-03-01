<?php
declare(strict_types=1);

namespace App\Job;

use App\Service\Ai\CodeReviewService;
use App\Service\Ai\PrSummaryService;
use App\Service\Ai\BuildAnalysisService;
use App\Service\Ai\DeployRiskService;

/**
 * Queue job for async AI operations.
 * Consumed via `php ml queue:work --queue=ai`.
 */
final class AiJob
{
    public function __construct(
        private CodeReviewService $codeReview,
        private PrSummaryService $prSummary,
        private BuildAnalysisService $buildAnalysis,
        private DeployRiskService $deployRisk,
    ) {
    }

    /**
     * @param array $payload {type, orgId, userId, projectId, ...typeSpecificFields}
     */
    public function handle(array $payload): array
    {
        return match ($payload['type']) {
            'code_review' => $this->handleCodeReview($payload),
            'pr_summary' => $this->handlePrSummary($payload),
            'build_analysis' => $this->handleBuildAnalysis($payload),
            'deploy_risk' => $this->handleDeployRisk($payload),
            default => throw new \InvalidArgumentException("Unknown AI job type: {$payload['type']}"),
        };
    }

    private function handleCodeReview(array $p): array
    {
        return $this->codeReview->review(
            diff: $p['diff'],
            prTitle: $p['prTitle'] ?? '',
            prBody: $p['prBody'] ?? '',
            language: $p['language'] ?? 'unknown',
            orgId: $p['orgId'],
            userId: $p['userId'],
            projectId: $p['projectId'],
        );
    }

    private function handlePrSummary(array $p): array
    {
        return $this->prSummary->summarize(
            diff: $p['diff'],
            branch: $p['branch'] ?? 'main',
            commits: $p['commits'] ?? [],
            orgId: $p['orgId'],
            userId: $p['userId'],
            projectId: $p['projectId'],
        );
    }

    private function handleBuildAnalysis(array $p): array
    {
        return $this->buildAnalysis->analyze(
            buildLog: $p['buildLog'],
            failedStep: $p['failedStep'] ?? 'Unknown',
            stack: $p['stack'] ?? 'unknown',
            exitCode: $p['exitCode'] ?? '1',
            orgId: $p['orgId'],
            userId: $p['userId'],
            projectId: $p['projectId'],
        );
    }

    private function handleDeployRisk(array $p): array
    {
        return $this->deployRisk->assess(
            diff: $p['diff'],
            environment: $p['environment'] ?? 'staging',
            stack: $p['stack'] ?? 'unknown',
            recentDeploys: $p['recentDeploys'] ?? [],
            affectedFiles: $p['affectedFiles'] ?? [],
            orgId: $p['orgId'],
            userId: $p['userId'],
            projectId: $p['projectId'],
        );
    }
}
