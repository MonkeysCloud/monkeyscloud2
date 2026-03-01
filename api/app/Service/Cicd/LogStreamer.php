<?php
declare(strict_types=1);

namespace App\Service\Cicd;

/**
 * Streams build logs via Redis pub/sub for real-time SSE delivery.
 */
final class LogStreamer
{
    private ?\Redis $redis = null;

    public function __construct()
    {
        // Redis connection is lazy-initialized
    }

    /**
     * Append a log line to the build's log stream.
     */
    public function append(int $buildId, string $line): void
    {
        $channel = $this->channel($buildId);
        $payload = json_encode([
            'type' => 'log',
            'line' => $line,
            'ts' => microtime(true),
        ]);

        $this->getRedis()->publish($channel, $payload);

        // Also append to a Redis list for log history
        $this->getRedis()->rPush("build:{$buildId}:log", $line);
        $this->getRedis()->expire("build:{$buildId}:log", 86400); // 24h TTL
    }

    /**
     * Send an info-level message.
     */
    public function info(int $buildId, string $message): void
    {
        $this->append($buildId, "[INFO] {$message}");
    }

    /**
     * Send an error-level message.
     */
    public function error(int $buildId, string $message): void
    {
        $this->append($buildId, "[ERROR] {$message}");
    }

    /**
     * Send a build-complete event so SSE clients can close.
     */
    public function complete(int $buildId, string $status): void
    {
        $channel = $this->channel($buildId);
        $payload = json_encode([
            'type' => 'complete',
            'status' => $status,
            'ts' => microtime(true),
        ]);

        $this->getRedis()->publish($channel, $payload);
    }

    /**
     * Get full log history for a build (from Redis list).
     *
     * @return string[]
     */
    public function history(int $buildId): array
    {
        return $this->getRedis()->lRange("build:{$buildId}:log", 0, -1) ?: [];
    }

    /**
     * Subscribe to a build's log channel (blocking, used by SSE endpoint).
     *
     * @param int      $buildId
     * @param callable $callback  fn(string $line): bool — return false to stop
     */
    public function subscribe(int $buildId, callable $callback): void
    {
        $redis = new \Redis();
        $redis->connect(getenv('REDIS_HOST') ?: 'redis', (int) (getenv('REDIS_PORT') ?: 6379));
        $channel = $this->channel($buildId);

        $redis->subscribe([$channel], function ($redis, $chan, $message) use ($callback) {
            $data = json_decode($message, true);

            if ($data['type'] === 'complete') {
                $callback($message);
                $redis->close();
                return;
            }

            $continue = $callback($message);
            if ($continue === false) {
                $redis->close();
            }
        });
    }

    private function channel(int $buildId): string
    {
        return "build:{$buildId}:stream";
    }

    private function getRedis(): \Redis
    {
        if ($this->redis === null) {
            $this->redis = new \Redis();
            $this->redis->connect(
                getenv('REDIS_HOST') ?: 'redis',
                (int) (getenv('REDIS_PORT') ?: 6379)
            );
        }
        return $this->redis;
    }
}
