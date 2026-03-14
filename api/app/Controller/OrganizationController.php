<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Router\Attributes\Middleware;
use App\Repository\OrganizationRepository;
use App\Repository\OrganizationMemberRepository;
use App\Repository\InvitationRepository;
use App\Repository\UserRepository;
use Psr\Http\Message\ServerRequestInterface;

#[Middleware('auth')]
final class OrganizationController extends AbstractController
{
    public function __construct(
        private OrganizationRepository $orgRepo,
        private OrganizationMemberRepository $memberRepo,
        private InvitationRepository $inviteRepo,
        private UserRepository $userRepo,
    ) {
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations', name: 'orgs.index', summary: 'List user organizations', tags: ['Organizations'])]
    public function index(ServerRequestInterface $request): Response
    {
        $userId = $this->userId($request);
        if (!$userId) {
            return $this->json(['error' => 'Authentication required.'], 401);
        }

        try {
            $memberships = $this->memberRepo->findByUser((int) $userId);
            $orgs = [];
            foreach ($memberships as $m) {
                $org = $this->orgRepo->find($m->organization_id);
                if ($org) {
                    $orgs[] = [
                        'id' => $org->id,
                        'name' => $org->name,
                        'slug' => $org->slug,
                        'owner_id' => $org->owner_id,
                        'avatar_url' => $org->avatar_url ?? null,
                        'created_at' => $org->created_at instanceof \DateTimeInterface ? $org->created_at->format('c') : $org->created_at,
                        'role' => $m->role ?? 'member',
                    ];
                }
            }
            return $this->json(['data' => $orgs]);
        } catch (\Throwable $e) {
            error_log('ORG_INDEX ERROR: ' . $e->getMessage());
            error_log('ORG_INDEX TRACE: ' . $e->getTraceAsString());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/check-slug', name: 'orgs.checkSlug', summary: 'Check if slug is available', tags: ['Organizations'])]
    public function checkSlug(ServerRequestInterface $request): Response
    {
        $params = $request->getQueryParams();
        $slug = isset($params['slug']) ? trim((string) $params['slug']) : '';

        if ($slug === '' || strlen($slug) < 3) {
            return $this->json(['available' => false, 'error' => 'Slug must be at least 3 characters.']);
        }

        $existing = $this->orgRepo->findBySlug($slug);

        return $this->json(['available' => ($existing === null)]);
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations', name: 'orgs.store', summary: 'Create organization', tags: ['Organizations'])]
    public function store(ServerRequestInterface $request): Response
    {
        error_log('store');
        $userId = $this->userId($request);
        error_log('userId: ' . $userId);
        if (!$userId) {
            return $this->json(['error' => 'Authentication required.'], 401);
        }

        try {
            $data = json_decode((string) $request->getBody(), true);

            $name = trim($data['name'] ?? '');
            $slug = trim($data['slug'] ?? '');

            if ($name === '') {
                return $this->json(['error' => 'Organization name is required.'], 422);
            }
            if ($slug === '' || strlen($slug) < 3) {
                return $this->json(['error' => 'Slug must be at least 3 characters.'], 422);
            }

            // Check slug uniqueness
            $existing = $this->orgRepo->findBySlug($slug);
            if ($existing !== null) {
                return $this->json(['error' => 'This slug is already taken. Please choose a different one.'], 409);
            }

            $now = new \DateTimeImmutable();

            $org = new \App\Entity\Organization();
            $org->name = $name;
            $org->slug = $slug;
            $org->owner_id = (int) $userId;
            $org->avatar_url = isset($data['avatar_url']) ? trim($data['avatar_url']) : null;
            $org->created_at = $now;
            $org->updated_at = $now;
            $this->orgRepo->save($org);

            // Create owner membership
            $member = new \App\Entity\OrganizationMember();
            $member->organization_id = $org->id;
            $member->user_id = (int) $userId;
            $member->role = 'owner';
            $member->accepted_at = $now;
            $member->created_at = $now;
            $member->updated_at = $now;
            $this->memberRepo->save($member);

            return $this->json([
                'data' => [
                    'id' => $org->id,
                    'name' => $org->name,
                    'slug' => $org->slug,
                ],
            ], 201);
        } catch (\Throwable $e) {
            error_log('ORG_STORE ERROR: ' . $e->getMessage());
            error_log('ORG_STORE TRACE: ' . $e->getTraceAsString());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}', name: 'orgs.show', summary: 'Get organization', tags: ['Organizations'])]
    public function show(ServerRequestInterface $request, int $orgId): Response
    {
        $org = $this->orgRepo->find($orgId);
        if (!$org) {
            return $this->json(['error' => 'Not found'], 404);
        }
        return $this->json($org);
    }

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}', name: 'orgs.update', summary: 'Update organization', tags: ['Organizations'])]
    public function update(ServerRequestInterface $request, int $orgId): Response
    {
        // TODO: validate, update
        return $this->json(['message' => 'Updated']);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/organizations/{orgId}', name: 'orgs.destroy', summary: 'Delete organization', tags: ['Organizations'])]
    public function destroy(ServerRequestInterface $request, int $orgId): Response
    {
        // TODO: soft delete
        return $this->json(null, 204);
    }

    // --- Members ---

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/members', name: 'orgs.members.index', summary: 'List members', tags: ['Organizations'])]
    public function members(ServerRequestInterface $request, int $orgId): Response
    {
        $members = $this->memberRepo->findByOrganization($orgId);
        $data = [];
        foreach ($members as $m) {
            $entry = [
                'id' => $m->id,
                'user_id' => $m->user_id,
                'role' => $m->role,
            ];
            // Try to get user info
            if ($m->user) {
                $entry['name'] = $m->user->name;
                $entry['email'] = $m->user->email;
                $entry['avatar_url'] = $m->user->avatar_url;
            } else {
                try {
                    $user = $this->userRepo->find($m->user_id);
                    if ($user) {
                        $entry['name'] = $user->name;
                        $entry['email'] = $user->email;
                        $entry['avatar_url'] = $user->avatar_url;
                    }
                } catch (\Throwable $e) {
                }
            }
            $data[] = $entry;
        }
        return $this->json(['data' => $data]);
    }

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/members/{userId}', name: 'orgs.members.update', summary: 'Update member role', tags: ['Organizations'])]
    public function updateMember(ServerRequestInterface $request, int $orgId, int $userId): Response
    {
        // TODO: update role
        return $this->json(['message' => 'Updated']);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/organizations/{orgId}/members/{userId}', name: 'orgs.members.destroy', summary: 'Remove member', tags: ['Organizations'])]
    public function removeMember(ServerRequestInterface $request, int $orgId, int $userId): Response
    {
        // TODO: remove
        return $this->json(null, 204);
    }

    // --- Invitations ---

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/invitations', name: 'orgs.invitations.store', summary: 'Send invitation', tags: ['Organizations'])]
    public function invite(ServerRequestInterface $request, int $orgId): Response
    {
        // TODO: create invitation, send email
        return $this->json(['message' => 'Invitation sent'], 201);
    }

    #[Route(methods: 'POST', path: '/api/v1/invitations/{token}/accept', name: 'invitations.accept', summary: 'Accept invitation', tags: ['Organizations'])]
    public function acceptInvitation(ServerRequestInterface $request, string $token): Response
    {
        // TODO: validate token, create membership
        return $this->json(['message' => 'Accepted']);
    }
}
