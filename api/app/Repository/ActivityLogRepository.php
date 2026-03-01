<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\ActivityLog;
use MonkeysLegion\Repository\EntityRepository;

class ActivityLogRepository extends EntityRepository
{
    protected string $table = 'activity_logs';
    protected string $entityClass = ActivityLog::class;

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }

    public function findByEntity(string $entityType, int $entityId): array
    {
        return $this->findBy(['entity_type' => $entityType, 'entity_id' => $entityId]);
    }
}
