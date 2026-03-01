<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use App\Repository\PlanRepository;
use App\Repository\SubscriptionRepository;
use App\Repository\UsageRecordRepository;
use App\Repository\ApiKeyRepository;
use App\Repository\WebhookRepository;
use App\Repository\DomainRepository;
use App\Repository\NotificationRepository;
use App\Repository\ActivityLogRepository;
use App\Repository\AiRequestRepository;
use Psr\Http\Message\ServerRequestInterface;

final class PlatformController
{
    public function __construct(
        private PlanRepository $planRepo,
        private SubscriptionRepository $subRepo,
        private UsageRecordRepository $usageRepo,
        private ApiKeyRepository $apiKeyRepo,
        private WebhookRepository $webhookRepo,
        private DomainRepository $domainRepo,
        private NotificationRepository $notifRepo,
        private ActivityLogRepository $logRepo,
        private AiRequestRepository $aiRepo,
    ) {
    }

    // --- Plans & Billing ---

    #[Route(methods: 'GET', path: '/api/v1/plans', name: 'plans.index', summary: 'List plans', tags: ['Billing'])]
    public function plans(ServerRequestInterface $request): Response
    {
        return $this->json($this->planRepo->findAll());
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/subscription', name: 'subscription.show', summary: 'Get subscription', tags: ['Billing'])]
    public function subscription(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->subRepo->findByOrganization($orgId));
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/subscription', name: 'subscription.store', summary: 'Subscribe to plan', tags: ['Billing'])]
    public function subscribe(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json(['message' => 'Subscribed'], 201);
    }

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/subscription', name: 'subscription.update', summary: 'Change plan', tags: ['Billing'])]
    public function changePlan(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json(['message' => 'Plan changed']);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/organizations/{orgId}/subscription', name: 'subscription.cancel', summary: 'Cancel subscription', tags: ['Billing'])]
    public function cancelSubscription(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json(['message' => 'Cancelled']);
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/usage', name: 'usage.index', summary: 'Get usage', tags: ['Billing'])]
    public function usage(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->usageRepo->findByOrganization($orgId));
    }

    // --- API Keys ---

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/api-keys', name: 'apikeys.index', summary: 'List API keys', tags: ['Settings'])]
    public function apiKeys(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->apiKeyRepo->findActive($orgId));
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/api-keys', name: 'apikeys.store', summary: 'Create API key', tags: ['Settings'])]
    public function createApiKey(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json(['message' => 'Created', 'key' => 'mc_live_...'], 201);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/api-keys/{keyId}', name: 'apikeys.revoke', summary: 'Revoke API key', tags: ['Settings'])]
    public function revokeApiKey(ServerRequestInterface $request, int $keyId): Response
    {
        return $this->json(null, 204);
    }

    // --- Webhooks ---

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/webhooks', name: 'webhooks.index', summary: 'List webhooks', tags: ['Settings'])]
    public function webhooks(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json($this->webhookRepo->findByProject($projectId));
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/webhooks', name: 'webhooks.store', summary: 'Create webhook', tags: ['Settings'])]
    public function createWebhook(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json(['message' => 'Created'], 201);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/webhooks/{webhookId}', name: 'webhooks.destroy', summary: 'Delete webhook', tags: ['Settings'])]
    public function deleteWebhook(ServerRequestInterface $request, int $webhookId): Response
    {
        return $this->json(null, 204);
    }

    // --- Domains ---

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/domains', name: 'domains.index', summary: 'List domains', tags: ['Infrastructure'])]
    public function domains(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json($this->domainRepo->findByProject($projectId));
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/domains', name: 'domains.store', summary: 'Add domain', tags: ['Infrastructure'])]
    public function addDomain(ServerRequestInterface $request, int $projectId): Response
    {
        return $this->json(['message' => 'Added'], 201);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/domains/{domainId}', name: 'domains.destroy', summary: 'Remove domain', tags: ['Infrastructure'])]
    public function removeDomain(ServerRequestInterface $request, int $domainId): Response
    {
        return $this->json(null, 204);
    }

    #[Route(methods: 'POST', path: '/api/v1/domains/{domainId}/verify', name: 'domains.verify', summary: 'Verify DNS', tags: ['Infrastructure'])]
    public function verifyDomain(ServerRequestInterface $request, int $domainId): Response
    {
        return $this->json(['verified' => false]);
    }

    // --- Notifications ---

    #[Route(methods: 'GET', path: '/api/v1/me/notifications', name: 'notifications.index', summary: 'My notifications', tags: ['User'])]
    public function notifications(ServerRequestInterface $request): Response
    {
        $userId = $request->getAttribute('user_id');
        return $this->json($this->notifRepo->findByUser($userId));
    }

    #[Route(methods: 'POST', path: '/api/v1/notifications/{notifId}/read', name: 'notifications.read', summary: 'Mark read', tags: ['User'])]
    public function markRead(ServerRequestInterface $request, int $notifId): Response
    {
        return $this->json(['message' => 'Read']);
    }

    #[Route(methods: 'POST', path: '/api/v1/me/notifications/read-all', name: 'notifications.readAll', summary: 'Mark all read', tags: ['User'])]
    public function markAllRead(ServerRequestInterface $request): Response
    {
        return $this->json(['message' => 'All read']);
    }

    // --- Activity Log ---

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/activity', name: 'activity.index', summary: 'Activity log', tags: ['Settings'])]
    public function activity(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->logRepo->findByOrganization($orgId));
    }

    // --- AI ---

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/ai/usage', name: 'ai.usage', summary: 'AI usage stats', tags: ['AI'])]
    public function aiUsage(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->aiRepo->findByOrganization($orgId));
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/ai/review', name: 'ai.review', summary: 'AI code review', tags: ['AI'])]
    public function aiReview(ServerRequestInterface $request, int $projectId): Response
    {
        // TODO: call Vertex AI / OpenAI
        return $this->json(['message' => 'Review queued']);
    }

    private function json(mixed $data, int $status = 200): Response
    {
        $body = Stream::createFromString(json_encode($data));
        return new Response($body, $status, ['Content-Type' => 'application/json']);
    }
}
