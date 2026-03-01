<?php
declare(strict_types=1);

namespace App\Service\Ai;

use App\Entity\AiRequest;
use App\Repository\AiRequestRepository;

/**
 * Client for Google Vertex AI (Gemini) API.
 * Also supports OpenAI-compatible endpoints as fallback.
 */
final class VertexAiClient
{
    private string $endpoint;
    private string $apiKey;
    private string $model;
    private string $projectId;
    private string $region;

    public function __construct(
        private AiRequestRepository $aiRepo,
    ) {
        $this->endpoint = getenv('VERTEX_AI_ENDPOINT') ?: 'https://generativelanguage.googleapis.com/v1beta';
        $this->apiKey = getenv('VERTEX_AI_API_KEY') ?: getenv('GEMINI_API_KEY') ?: '';
        $this->model = getenv('VERTEX_AI_MODEL') ?: 'gemini-2.0-flash';
        $this->projectId = getenv('GCP_PROJECT_ID') ?: '';
        $this->region = getenv('GCP_REGION') ?: 'us-central1';
    }

    /**
     * Send a prompt to the AI model and return the response.
     *
     * @param string $systemPrompt  System instructions
     * @param string $userPrompt    User prompt / input content
     * @param int    $orgId         Organization ID (for billing)
     * @param int    $userId        User who triggered the request
     * @param string $type          AiRequest type enum value
     * @param int|null $projectId   Optional project ID
     * @param float  $temperature   Response creativity (0.0 - 1.0)
     * @param int    $maxTokens     Max output tokens
     * @return array{content: string, request: AiRequest}
     */
    public function generate(
        string $systemPrompt,
        string $userPrompt,
        int $orgId,
        int $userId,
        string $type,
        ?int $projectId = null,
        float $temperature = 0.3,
        int $maxTokens = 4096,
    ): array {
        $startTime = hrtime(true);

        $payload = [
            'contents' => [
                ['role' => 'user', 'parts' => [['text' => $userPrompt]]],
            ],
            'systemInstruction' => [
                'parts' => [['text' => $systemPrompt]],
            ],
            'generationConfig' => [
                'temperature' => $temperature,
                'maxOutputTokens' => $maxTokens,
                'topP' => 0.95,
            ],
        ];

        $url = "{$this->endpoint}/models/{$this->model}:generateContent?key={$this->apiKey}";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        $latency = (int) ((hrtime(true) - $startTime) / 1e6); // ms

        if ($httpCode !== 200 || $error) {
            $aiRequest = $this->logRequest($orgId, $userId, $projectId, $type, 0, 0, 0, $latency, false);
            throw new \RuntimeException("Vertex AI error (HTTP {$httpCode}): {$error} — {$response}");
        }

        $data = json_decode($response, true);

        // Extract generated text
        $content = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';

        // Extract token counts
        $usage = $data['usageMetadata'] ?? [];
        $inputTokens = $usage['promptTokenCount'] ?? $this->estimateTokens($systemPrompt . $userPrompt);
        $outputTokens = $usage['candidatesTokenCount'] ?? $this->estimateTokens($content);

        // Calculate cost (Gemini 2.0 Flash pricing)
        $cost = $this->calculateCost($inputTokens, $outputTokens);

        $aiRequest = $this->logRequest($orgId, $userId, $projectId, $type, $inputTokens, $outputTokens, $cost, $latency, true);

        return ['content' => $content, 'request' => $aiRequest];
    }

    /**
     * Log the AI request for billing and analytics.
     */
    private function logRequest(
        int $orgId,
        int $userId,
        ?int $projectId,
        string $type,
        int $inputTokens,
        int $outputTokens,
        float $cost,
        int $latencyMs,
        bool $success,
    ): AiRequest {
        $req = new AiRequest();
        $req->organization_id = $orgId;
        $req->user_id = $userId;
        $req->project_id = $projectId;
        $req->type = $type;
        $req->model = $this->model;
        $req->input_tokens = $inputTokens;
        $req->output_tokens = $outputTokens;
        $req->cost_usd = number_format($cost, 6, '.', '');
        $req->latency_ms = $latencyMs;
        $req->success = $success;
        $req->created_at = new \DateTimeImmutable();
        // TODO: $this->aiRepo->save($req);

        return $req;
    }

    private function calculateCost(int $inputTokens, int $outputTokens): float
    {
        // Gemini 2.0 Flash pricing (per million tokens)
        $inputRate = 0.10 / 1_000_000;   // $0.10 per 1M input tokens
        $outputRate = 0.40 / 1_000_000;   // $0.40 per 1M output tokens
        return ($inputTokens * $inputRate) + ($outputTokens * $outputRate);
    }

    private function estimateTokens(string $text): int
    {
        // Rough estimate: ~4 chars per token
        return (int) ceil(strlen($text) / 4);
    }
}
