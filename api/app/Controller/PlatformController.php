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
use App\Repository\SshKeyRepository;
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
        private SshKeyRepository $sshKeyRepo,
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

    // --- API Keys (user-scoped, works for all orgs) ---

    #[Route(methods: 'GET', path: '/api/v1/me/api-keys', name: 'apikeys.mine', summary: 'List my API keys', tags: ['Settings'])]
    public function myApiKeys(ServerRequestInterface $request): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        return $this->json($this->apiKeyRepo->findByUser($userId));
    }

    #[Route(methods: 'POST', path: '/api/v1/me/api-keys', name: 'apikeys.store', summary: 'Create API key', tags: ['Settings'])]
    public function createApiKey(ServerRequestInterface $request): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = json_decode((string) $request->getBody(), true) ?: [];

        $name = trim($body['name'] ?? '');
        $scopes = $body['scopes'] ?? ['read', 'write'];

        if ($name === '') {
            return $this->json(['error' => 'name is required'], 422);
        }

        // Generate token: mc_ + 40 hex chars (43 chars total)
        $rawToken = 'mc_' . bin2hex(random_bytes(20));
        $keyId = substr(bin2hex(random_bytes(16)), 0, 32);

        $key = new \App\Entity\ApiKey();
        $key->user_id = $userId;
        $key->name = $name;
        $key->key_id = $keyId;
        $key->key_hash = password_hash($rawToken, PASSWORD_BCRYPT);
        $key->scopes = $scopes;
        $key->created_at = new \DateTimeImmutable();

        $this->apiKeyRepo->save($key);

        return $this->json([
            'id' => $key->id,
            'name' => $key->name,
            'key_id' => $key->key_id,
            'scopes' => $key->scopes,
            'token' => $rawToken, // Only returned once!
            'created_at' => $key->created_at->format('c'),
        ], 201);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/api-keys/{keyId}', name: 'apikeys.delete', summary: 'Delete API key', tags: ['Settings'])]
    public function deleteApiKey(ServerRequestInterface $request, int $keyId): Response
    {
        $key = $this->apiKeyRepo->find($keyId);
        if (!$key) {
            return $this->json(['error' => 'Key not found'], 404);
        }
        $this->apiKeyRepo->delete($key);
        return $this->json(null, 204);
    }

    #[Route(methods: 'POST', path: '/api/v1/internal/validate-token', name: 'apikeys.validate', summary: 'Validate API token (internal)', tags: ['Internal'])]
    public function validateToken(ServerRequestInterface $request): Response
    {
        $body = json_decode((string) $request->getBody(), true) ?: [];
        $token = $body['token'] ?? '';

        if ($token === '') {
            return $this->json(['valid' => false, 'error' => 'Token required'], 401);
        }

        // Find all keys and verify hash (we can't look up by prefix since key_id != token prefix)
        // For better performance, we iterate active keys
        $allKeys = $this->apiKeyRepo->findAll();
        $matchedKey = null;
        foreach ($allKeys as $k) {
            if (password_verify($token, $k->key_hash)) {
                $matchedKey = $k;
                break;
            }
        }

        if (!$matchedKey) {
            return $this->json(['valid' => false, 'error' => 'Invalid token'], 401);
        }

        // Check expired
        if ($matchedKey->expires_at !== null && $matchedKey->expires_at < new \DateTimeImmutable()) {
            return $this->json(['valid' => false, 'error' => 'Token expired'], 401);
        }

        // Update last_used_at
        $matchedKey->last_used_at = new \DateTimeImmutable();
        $this->apiKeyRepo->save($matchedKey);

        return $this->json([
            'valid' => true,
            'user_id' => $matchedKey->user_id,
            'scopes' => $matchedKey->scopes,
        ]);
    }

    #[Route(methods: 'POST', path: '/api/v1/internal/validate-ssh-key', name: 'sshkeys.validate', summary: 'Validate SSH key (internal)', tags: ['Internal'])]
    public function validateSshKey(ServerRequestInterface $request): Response
    {
        $body = json_decode((string) $request->getBody(), true) ?: [];
        $publicKey = $body['public_key'] ?? '';

        if ($publicKey === '') {
            return $this->json(['valid' => false, 'error' => 'Public key required'], 400);
        }

        $parts = explode(' ', trim($publicKey));
        if (count($parts) < 2) {
            return $this->json(['valid' => false, 'error' => 'Invalid public key format'], 400);
        }
        // Match Type and Base64 Payload, ignoring the comment part
        $searchType = $parts[0];
        $searchPayload = $parts[1];

        $allKeys = $this->sshKeyRepo->findAll();
        $matchedKey = null;
        foreach ($allKeys as $k) {
            $kParts = explode(' ', trim($k->public_key));
            if (count($kParts) >= 2 && $kParts[0] === $searchType && $kParts[1] === $searchPayload) {
                $matchedKey = $k;
                break;
            }
        }

        if (!$matchedKey) {
            return $this->json(['valid' => false, 'error' => 'Key not found'], 401);
        }

        $matchedKey->last_used_at = new \DateTimeImmutable();
        $this->sshKeyRepo->save($matchedKey);

        return $this->json([
            'valid' => true,
            'user_id' => $matchedKey->user_id,
            'scopes' => ['read', 'write'], // SSH keys grant full Git access to authorized user
        ]);
    }

    // --- SSH Keys ---

    #[Route(methods: 'GET', path: '/api/v1/me/ssh-keys', name: 'sshkeys.mine', summary: 'List my SSH keys', tags: ['Settings'])]
    public function mySshKeys(ServerRequestInterface $request): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        return $this->json($this->sshKeyRepo->findByUser($userId));
    }

    #[Route(methods: 'POST', path: '/api/v1/me/ssh-keys', name: 'sshkeys.store', summary: 'Upload SSH public key', tags: ['Settings'])]
    public function uploadSshKey(ServerRequestInterface $request): Response
    {
        $userId = (int) $request->getAttribute('user_id');
        $body = json_decode((string) $request->getBody(), true) ?: [];

        $name = trim($body['name'] ?? '');
        $publicKey = trim($body['public_key'] ?? '');

        if ($name === '' || $publicKey === '') {
            return $this->json(['error' => 'name and public_key are required'], 422);
        }

        // Validate SSH key format
        if (!preg_match('/^ssh-(rsa|ed25519|ecdsa)\s+\S+/', $publicKey)) {
            return $this->json(['error' => 'Invalid SSH public key format. Must start with ssh-rsa, ssh-ed25519, or ssh-ecdsa'], 422);
        }

        // Calculate fingerprint (SHA256 of the base64-decoded key data)
        $parts = explode(' ', $publicKey);
        if (count($parts) < 2) {
            return $this->json(['error' => 'Invalid SSH key format'], 422);
        }
        $keyData = base64_decode($parts[1], true);
        if ($keyData === false) {
            return $this->json(['error' => 'Invalid SSH key data'], 422);
        }
        $fingerprint = 'SHA256:' . rtrim(base64_encode(hash('sha256', $keyData, true)), '=');

        // Check if fingerprint already exists
        $existing = $this->sshKeyRepo->findByFingerprint($fingerprint);
        if ($existing) {
            return $this->json(['error' => 'This SSH key is already registered'], 409);
        }

        $sshKey = new \App\Entity\SshKey();
        $sshKey->user_id = $userId;
        $sshKey->name = $name;
        $sshKey->public_key = $publicKey;
        $sshKey->fingerprint = $fingerprint;
        $sshKey->created_at = new \DateTimeImmutable();

        $this->sshKeyRepo->save($sshKey);

        return $this->json([
            'id' => $sshKey->id,
            'name' => $sshKey->name,
            'fingerprint' => $sshKey->fingerprint,
            'created_at' => $sshKey->created_at->format('c'),
        ], 201);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/ssh-keys/{sshKeyId}', name: 'sshkeys.delete', summary: 'Delete SSH key', tags: ['Settings'])]
    public function deleteSshKey(ServerRequestInterface $request, int $sshKeyId): Response
    {
        $sshKey = $this->sshKeyRepo->find($sshKeyId);
        if (!$sshKey) {
            return $this->json(['error' => 'SSH key not found'], 404);
        }
        $this->sshKeyRepo->delete($sshKey);
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
