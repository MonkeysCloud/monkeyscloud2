<?php
declare(strict_types=1);

namespace App\Service\Ai;

/**
 * Pre-deploy risk assessment using AI.
 * Analyzes changes and deployment context to predict risk level.
 */
final class DeployRiskService
{
    public function __construct(
        private VertexAiClient $ai,
    ) {
    }

    /**
     * Assess deployment risk for a build.
     *
     * @param string $diff           Changes being deployed
     * @param string $environment    Target environment (staging, production)
     * @param string $stack          Project stack
     * @param array  $recentDeploys  Last 5 deploy statuses [{status, date}]
     * @param array  $affectedFiles  List of changed files
     * @param int    $orgId
     * @param int    $userId
     * @param int    $projectId
     * @return array{risk_level: string, score: int, factors: array, recommendations: array, safe_to_deploy: bool}
     */
    public function assess(
        string $diff,
        string $environment,
        string $stack,
        array $recentDeploys,
        array $affectedFiles,
        int $orgId,
        int $userId,
        int $projectId,
    ): array {
        $files = implode("\n", array_map(fn($f) => "- {$f}", $affectedFiles));
        $deploys = implode("\n", array_map(fn($d) => "- {$d['status']} ({$d['date']})", $recentDeploys));

        // Truncate diff to 300 lines
        $diffLines = explode("\n", $diff);
        $truncated = implode("\n", array_slice($diffLines, 0, 300));

        $systemPrompt = <<<PROMPT
You are a deployment risk analyst for a cloud platform. Assess the risk of deploying this change.

Your response MUST be valid JSON with this exact structure:
{
  "risk_level": "low|medium|high|critical",
  "score": 25,
  "factors": [
    {
      "factor": "Risk factor name",
      "impact": "low|medium|high",
      "description": "Why this is a risk"
    }
  ],
  "recommendations": [
    "Actionable recommendation before deploying"
  ],
  "safe_to_deploy": true
}

Risk factors to evaluate:
- Database migrations (schema changes, data migrations)
- Configuration changes (env vars, secrets, feature flags)
- Infrastructure changes (networking, DNS, certs)
- Dependency updates (major version bumps)
- High-traffic components (auth, payments, API gateways)
- Size of change (large diffs = higher risk)
- Recent deploy stability (recent failures increase risk)
- Environment sensitivity (production > staging > dev)

Score 0-100 where 0 is zero risk and 100 is extremely dangerous.
PROMPT;

        $userPrompt = <<<PROMPT
**Target Environment:** {$environment}
**Stack:** {$stack}

**Recent Deploy History:**
{$deploys}

**Affected Files ({count($affectedFiles)}):**
{$files}

**Diff (first 300 lines):**
```diff
{$truncated}
```
PROMPT;

        $result = $this->ai->generate(
            systemPrompt: $systemPrompt,
            userPrompt: $userPrompt,
            orgId: $orgId,
            userId: $userId,
            type: 'deploy_risk',
            projectId: $projectId,
            temperature: 0.1,
            maxTokens: 2048,
        );

        $parsed = json_decode($result['content'], true);
        if (!$parsed) {
            return [
                'risk_level' => 'medium',
                'score' => 50,
                'factors' => [],
                'recommendations' => ['Manual review recommended — AI analysis unavailable'],
                'safe_to_deploy' => false,
            ];
        }

        return $parsed;
    }
}
