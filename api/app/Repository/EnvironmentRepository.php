<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Environment;
use MonkeysLegion\Repository\EntityRepository;

class EnvironmentRepository extends EntityRepository
{
    protected string $table = 'environments';
    protected string $entityClass = Environment::class;

    public function findByProject(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId]);
    }
}
