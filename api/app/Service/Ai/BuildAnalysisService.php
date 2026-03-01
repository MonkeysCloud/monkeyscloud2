<?php
declare(strict_types=1);

namespace App\Service\Ai;

/**
 * AI root-cause analysis for failed builds.
 */
final class BuildAnalysisService
{
    public function __construct(
        private VertexAiClient $ai,
    ) {
    }

    /**
     * Analyze a failed build to identify root cause and suggest fixes.
     *
     * @param string $buildLog     Full build log output
     * @param string $failedStep   Name of the step that failed
     * @param string $stack        Project stack (laravel, nextjs, etc.)
     * @param string $exitCode     Exit code of the failed step
     * @param int    $orgId
     * @param int    $userId
     * @param int    $projectId
     * @return array{root_cause: string, explanation: string, fixes: array, related_docs: array, confidence: int}
     */
    public function analyze(
        string $buildLog,
        string $failedStep,
        string $stack,
        string $exitCode,
        int $orgId,
        int $userId,
        int $projectId,
    ): array {
        // Truncate log to last 500 lines for context window
        $logLines = explode("\n", $buildLog);
        $truncated = implode("\n", array_slice($logLines, -500));

        $systemPrompt = <<<PROMPT
You are a DevOps expert specializing in CI/CD build failures. Analyze the build log and identify the root cause.

Your response MUST be valid JSON with this exact structure:
{
  "root_cause": "One-line root cause summary",
  "explanation": "Detailed technical explanation of what went wrong (markdown)",
  "fixes": [
    {
      "title": "Fix title",
      "description": "Step-by-step fix instructions (markdown)",
      "confidence": 95,
      "code_snippet": "Optional code to fix the issue"
    }
  ],
  "related_docs": [
    {
      "title": "Relevant documentation page",
      "url": "https://..."
    }
  ],
  "confidence": 90
}

Common failure categories:
- Dependency resolution (version conflicts, missing packages)
- Compilation errors (syntax, type mismatches)
- Test failures (assertion errors, timeouts)
- Environment issues (missing env vars, wrong runtime version)
- Docker build issues (missing files, permission errors)
- Resource limits (OOM, disk space)

Provide specific, actionable fixes ranked by likelihood. Confidence 0-100.
PROMPT;

        $userPrompt = <<<PROMPT
**Stack:** {$stack}
**Failed Step:** {$failedStep}
**Exit Code:** {$exitCode}

**Build Log (last 500 lines):**
```
{$truncated}
```
PROMPT;

        $result = $this->ai->generate(
            systemPrompt: $systemPrompt,
            userPrompt: $userPrompt,
            orgId: $orgId,
            userId: $userId,
            type: 'build_analysis',
            projectId: $projectId,
            temperature: 0.1,
            maxTokens: 3072,
        );

        $parsed = json_decode($result['content'], true);
        if (!$parsed) {
            return [
                'root_cause' => 'Unable to determine root cause',
                'explanation' => $result['content'],
                'fixes' => [],
                'related_docs' => [],
                'confidence' => 0,
            ];
        }

        return $parsed;
    }
}
