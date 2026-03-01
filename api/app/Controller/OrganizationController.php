<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use App\Repository\OrganizationRepository;
use App\Repository\OrganizationMemberRepository;
use App\Repository\InvitationRepository;
use Psr\Http\Message\ServerRequestInterface;

final class OrganizationController
{
    public function __construct(
        private OrganizationRepository $orgRepo,
        private OrganizationMemberRepository $memberRepo,
        private InvitationRepository $inviteRepo,
    ) {
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations', name: 'orgs.index', summary: 'List user organizations', tags: ['Organizations'])]
    public function index(ServerRequestInterface $request): Response
    {
        $userId = $request->getAttribute('user_id');
        $memberships = $this->memberRepo->findByUser($userId);
        $orgs = array_map(fn($m) => $this->orgRepo->find($m->organization_id), $memberships);
        return $this->json($orgs);
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations', name: 'orgs.store', summary: 'Create organization', tags: ['Organizations'])]
    public function store(ServerRequestInterface $request): Response
    {
        $data = json_decode((string) $request->getBody(), true);
        // TODO: validate, create org + owner membership
        return $this->json(['message' => 'Organization created'], 201);
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
        return $this->json($this->memberRepo->findByOrganization($orgId));
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

    private function json(mixed $data, int $status = 200): Response
    {
        $body = Stream::createFromString(json_encode($data));
        return new Response($body, $status, ['Content-Type' => 'application/json']);
    }
}
