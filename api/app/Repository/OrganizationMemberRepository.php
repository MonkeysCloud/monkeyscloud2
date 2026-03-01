<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\OrganizationMember;
use MonkeysLegion\Repository\EntityRepository;

class OrganizationMemberRepository extends EntityRepository
{
    protected string $table = 'organization_members';
    protected string $entityClass = OrganizationMember::class;

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }

    public function findByUser(int $userId): array
    {
        return $this->findBy(['user_id' => $userId]);
    }

    public function findMembership(int $orgId, int $userId): ?OrganizationMember
    {
        return $this->findOneBy(['organization_id' => $orgId, 'user_id' => $userId]);
    }
}
