<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\ApiKey;
use MonkeysLegion\Repository\EntityRepository;

class ApiKeyRepository extends EntityRepository
{
    protected string $table = 'api_keys';
    protected string $entityClass = ApiKey::class;

    public function findByKeyId(string $keyId): ?ApiKey
    {
        return $this->findOneBy(['key_id' => $keyId]);
    }

    public function findByUser(int $userId): array
    {
        return $this->findBy(['user_id' => $userId]);
    }
}
