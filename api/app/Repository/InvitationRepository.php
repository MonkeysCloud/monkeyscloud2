<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Invitation;
use MonkeysLegion\Repository\EntityRepository;

class InvitationRepository extends EntityRepository
{
    protected string $table = 'invitations';
    protected string $entityClass = Invitation::class;

    public function findByToken(string $token): ?Invitation
    {
        return $this->findOneBy(['token' => $token]);
    }

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }

    public function findPending(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId, 'accepted_at' => null]);
    }
}
