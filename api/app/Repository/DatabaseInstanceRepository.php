<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\DatabaseInstance;
use MonkeysLegion\Repository\EntityRepository;

class DatabaseInstanceRepository extends EntityRepository
{
    protected string $table = 'database_instances';
    protected string $entityClass = DatabaseInstance::class;

    public function findByProject(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId]);
    }
}
