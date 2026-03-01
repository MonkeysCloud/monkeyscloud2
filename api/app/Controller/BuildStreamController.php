<?php
declare(strict_types=1);

namespace App\Controller;

use App\Service\Cicd\LogStreamer;
use App\Repository\BuildRepository;
use MonkeysLegion\Router\Attribute\Route;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

/**
 * SSE endpoint for real-time build log streaming.
 */
final class BuildStreamController
{
    public function __construct(
        private LogStreamer $logs,
        private BuildRepository $buildRepo,
    ) {
    }

    /**
     * Stream build logs via Server-Sent Events.
     *
     * GET /api/v1/builds/{buildId}/stream
     */
    #[Route('GET', '/api/v1/builds/{buildId}/stream')]
    public function stream(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $buildId = (int) $request->getAttribute('buildId');
        $build = $this->buildRepo->find($buildId);

        if (!$build) {
            $body = $response->getBody();
            $body->write(json_encode(['error' => 'Build not found']));
            return $response
                ->withStatus(404)
                ->withHeader('Content-Type', 'application/json');
        }

        // Set SSE headers
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        header('X-Accel-Buffering: no'); // Disable nginx buffering

        // Disable output buffering
        if (ob_get_level())
            ob_end_clean();

        // 1. Send log history first (catch-up)
        $history = $this->logs->history($buildId);
        foreach ($history as $line) {
            echo "data: " . json_encode(['type' => 'log', 'line' => $line]) . "\n\n";
        }
        flush();

        // 2. If build is already finished, send complete event and close
        if (in_array($build->status, ['passed', 'failed', 'cancelled'], true)) {
            echo "data: " . json_encode(['type' => 'complete', 'status' => $build->status]) . "\n\n";
            flush();
            return $response;
        }

        // 3. Subscribe to live stream
        $this->logs->subscribe($buildId, function (string $message) {
            $data = json_decode($message, true);
            echo "data: {$message}\n\n";
            flush();

            // Stop if build is complete
            return ($data['type'] ?? '') !== 'complete';
        });

        return $response;
    }

    /**
     * Get full build log as plain text (non-streaming).
     *
     * GET /api/v1/builds/{buildId}/logs
     */
    #[Route('GET', '/api/v1/builds/{buildId}/logs')]
    public function logs(ServerRequestInterface $request, ResponseInterface $response): ResponseInterface
    {
        $buildId = (int) $request->getAttribute('buildId');
        $history = $this->logs->history($buildId);

        $body = $response->getBody();
        $body->write(implode("\n", $history));

        return $response
            ->withStatus(200)
            ->withHeader('Content-Type', 'text/plain');
    }
}
