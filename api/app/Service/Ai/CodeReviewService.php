<?php
declare(strict_types=1);

namespace App\Service\Ai;

/**
 * AI-powered code review for pull requests.
 * Analyzes diffs and provides actionable feedback.
 */
final class CodeReviewService
{
    public function __construct(
        private VertexAiClient $ai,
    ) {
    }

    /**
     * Review a pull request diff.
     *
     * @param string $diff       Unified diff content
     * @param string $prTitle    PR title
     * @param string $prBody     PR description
     * @param string $language   Primary language of the changes
     * @param int    $orgId      Organization for billing
     * @param int    $userId     User who requested
     * @param int    $projectId  Project ID
     * @return array{summary: string, issues: array, suggestions: array, score: int}
     */
    public function review(
        string $diff,
        string $prTitle,
        string $prBody,
        string $language,
        int $orgId,
        int $userId,
        int $projectId,
    ): array {
        $systemPrompt = <<<PROMPT
You are an expert code reviewer for a cloud hosting platform. Analyze the provided pull request diff and provide a thorough review.

Your response MUST be valid JSON with this exact structure:
{
  "summary": "Brief summary of the changes (2-3 sentences)",
  "issues": [
    {
      "severity": "critical|warning|info",
      "file": "filename",
      "line": 42,
      "title": "Short issue title",
      "description": "Detailed explanation",
      "suggestion": "Suggested fix or improvement"
    }
  ],
  "suggestions": [
    {
      "category": "security|performance|readability|testing|architecture",
      "description": "Improvement suggestion"
    }
  ],
  "score": 85
}

Focus on:
- Security vulnerabilities (SQL injection, XSS, auth bypass, secret leaks)
- Performance issues (N+1 queries, memory leaks, unnecessary allocations)
- Bug risks (null refs, race conditions, edge cases)
- Code quality (naming, duplication, complexity)
- Testing gaps

Score from 0-100 where 100 is flawless. Be constructive and specific.
PROMPT;

        $userPrompt = <<<PROMPT
**PR Title:** {$prTitle}
**PR Description:** {$prBody}
**Primary Language:** {$language}

**Diff:**
```diff
{$diff}
```
PROMPT;

        $result = $this->ai->generate(
            systemPrompt: $systemPrompt,
            userPrompt: $userPrompt,
            orgId: $orgId,
            userId: $userId,
            type: 'code_review',
            projectId: $projectId,
            temperature: 0.2,
            maxTokens: 4096,
        );

        $parsed = json_decode($result['content'], true);
        if (!$parsed) {
            return [
                'summary' => $result['content'],
                'issues' => [],
                'suggestions' => [],
                'score' => 0,
            ];
        }

        return $parsed;
    }
}
