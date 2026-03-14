<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\DatabaseBackup;
use MonkeysLegion\Repository\EntityRepository;

class DatabaseBackupRepository extends EntityRepository
{
    protected string $table = 'database_backups';
    protected string $entityClass = DatabaseBackup::class;

    public function findByInstance(int $instanceId): array
    {
        return $this->findBy(['database_instance_id' => $instanceId]);
    }
}
