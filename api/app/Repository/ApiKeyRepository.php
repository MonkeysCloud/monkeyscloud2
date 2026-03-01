<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\ApiKey;
use MonkeysLegion\Repository\EntityRepository;

class ApiKeyRepository extends EntityRepository
{
    protected string $table = 'api_keys';
    protected string $entityClass = ApiKey::class;

    public function findByPrefix(string $prefix): ?ApiKey
    {
        return $this->findOneBy(['key_prefix' => $prefix]);
    }

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }

    public function findActive(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId, 'revoked_at' => null]);
    }
}
