<?php
declare(strict_types=1);

namespace App\Job;

use App\Repository\WebhookRepository;

/**
 * Delivers outgoing webhook payloads to customer URLs.
 * Consumed via `php ml queue:work --queue=webhooks`.
 */
final class WebhookDeliveryJob
{
    public function __construct(
        private WebhookRepository $webhookRepo,
    ) {
    }

    /**
     * @param array $payload {organizationId, event, data}
     */
    public function handle(array $payload): void
    {
        $orgId = $payload['organizationId'];
        $event = $payload['event'];
        $data = $payload['data'];

        // Find all active webhooks for this org that subscribe to this event
        $webhooks = $this->webhookRepo->findActiveByOrganization($orgId);

        foreach ($webhooks as $webhook) {
            // Check event filter
            $events = json_decode($webhook->events ?? '[]', true);
            if (!empty($events) && !in_array($event, $events, true)) {
                continue;
            }

            $this->deliver($webhook, $event, $data);
        }
    }

    private function deliver(object $webhook, string $event, array $data): void
    {
        $body = json_encode([
            'event' => $event,
            'timestamp' => (new \DateTimeImmutable())->format(\DateTimeInterface::RFC3339),
            'data' => $data,
        ]);

        // Sign payload with webhook secret
        $signature = hash_hmac('sha256', $body, $webhook->secret ?? '');

        $ch = curl_init($webhook->url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                "X-MonkeysCloud-Event: {$event}",
                "X-MonkeysCloud-Signature: sha256={$signature}",
                'User-Agent: MonkeysCloud-Webhook/1.0',
            ],
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        // Update webhook last delivery status
        $webhook->last_triggered_at = new \DateTimeImmutable();
        $webhook->updated_at = new \DateTimeImmutable();
        // TODO: $this->webhookRepo->save($webhook);

        // Log delivery failure for retries
        if ($httpCode < 200 || $httpCode >= 300) {
            // TODO: schedule retry with exponential backoff
            error_log("Webhook delivery failed — URL: {$webhook->url}, HTTP {$httpCode}, Error: {$error}");
        }
    }
}
