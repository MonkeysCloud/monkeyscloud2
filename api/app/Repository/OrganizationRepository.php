<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Organization;
use MonkeysLegion\Repository\EntityRepository;

class OrganizationRepository extends EntityRepository
{
    protected string $table = 'organizations';
    protected string $entityClass = Organization::class;

    public function findBySlug(string $slug): ?Organization
    {
        return $this->findOneBy(['slug' => $slug]);
    }

    public function findByOwner(int $ownerId): array
    {
        return $this->findBy(['owner_id' => $ownerId]);
    }
}
