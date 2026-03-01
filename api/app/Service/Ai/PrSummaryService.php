<?php
declare(strict_types=1);

namespace App\Service\Ai;

/**
 * Auto-generates pull request descriptions and summaries.
 */
final class PrSummaryService
{
    public function __construct(
        private VertexAiClient $ai,
    ) {
    }

    /**
     * Generate a PR summary from a diff.
     *
     * @param string $diff       Unified diff content
     * @param string $branch     Source branch name
     * @param array  $commits    Array of commit messages
     * @param int    $orgId      Organization for billing
     * @param int    $userId     User who requested
     * @param int    $projectId  Project ID
     * @return array{title: string, description: string, changelog: array, breaking_changes: array}
     */
    public function summarize(
        string $diff,
        string $branch,
        array $commits,
        int $orgId,
        int $userId,
        int $projectId,
    ): array {
        $commitList = implode("\n", array_map(fn($c) => "- {$c}", $commits));

        $systemPrompt = <<<PROMPT
You are a technical writer for a developer platform. Generate a clear, concise pull request description.

Your response MUST be valid JSON with this exact structure:
{
  "title": "Concise PR title (imperative mood, max 72 chars)",
  "description": "Markdown description explaining what changed and why (2-4 paragraphs)",
  "changelog": [
    "Human-readable change entry for release notes"
  ],
  "breaking_changes": [
    "Any breaking change with migration instructions (empty array if none)"
  ]
}

Guidelines:
- Use clear, professional language
- Focus on "what" and "why", not "how"
- Group related changes together
- Highlight any user-facing or API-breaking changes
- Use conventional commit style for the title
PROMPT;

        $userPrompt = <<<PROMPT
**Branch:** {$branch}

**Commits:**
{$commitList}

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
            type: 'pr_summary',
            projectId: $projectId,
            temperature: 0.3,
            maxTokens: 2048,
        );

        $parsed = json_decode($result['content'], true);
        if (!$parsed) {
            return [
                'title' => $branch,
                'description' => $result['content'],
                'changelog' => [],
                'breaking_changes' => [],
            ];
        }

        return $parsed;
    }
}
