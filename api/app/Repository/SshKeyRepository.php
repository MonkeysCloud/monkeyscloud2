<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\SshKey;
use MonkeysLegion\Repository\EntityRepository;

class SshKeyRepository extends EntityRepository
{
    protected string $table = 'ssh_keys';
    protected string $entityClass = SshKey::class;

    public function findByUser(int $userId): array
    {
        return $this->findBy(['user_id' => $userId]);
    }

    public function findByFingerprint(string $fingerprint): ?SshKey
    {
        return $this->findOneBy(['fingerprint' => $fingerprint]);
    }
}
