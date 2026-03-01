<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\UsageRecord;
use MonkeysLegion\Repository\EntityRepository;

class UsageRecordRepository extends EntityRepository
{
    protected string $table = 'usage_records';
    protected string $entityClass = UsageRecord::class;

    public function findByOrganization(int $orgId, ?string $metric = null): array
    {
        $criteria = ['organization_id' => $orgId];
        if ($metric) {
            $criteria['metric'] = $metric;
        }
        return $this->findBy($criteria);
    }
}
