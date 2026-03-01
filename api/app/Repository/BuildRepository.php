<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Build;
use MonkeysLegion\Repository\EntityRepository;

class BuildRepository extends EntityRepository
{
    protected string $table = 'builds';
    protected string $entityClass = Build::class;

    public function findByProject(int $projectId, ?string $status = null): array
    {
        $criteria = ['project_id' => $projectId];
        if ($status) {
            $criteria['status'] = $status;
        }
        return $this->findBy($criteria);
    }

    public function findByEnvironment(int $envId): array
    {
        return $this->findBy(['environment_id' => $envId]);
    }

    public function nextNumber(int $projectId): int
    {
        $result = $this->findBy(['project_id' => $projectId]);
        return count($result) + 1;
    }
}
