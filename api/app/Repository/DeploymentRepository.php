<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Deployment;
use MonkeysLegion\Repository\EntityRepository;

class DeploymentRepository extends EntityRepository
{
    protected string $table = 'deployments';
    protected string $entityClass = Deployment::class;

    public function findByProject(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId]);
    }

    public function findByEnvironment(int $envId): array
    {
        return $this->findBy(['environment_id' => $envId]);
    }

    public function findLive(int $envId): ?Deployment
    {
        return $this->findOneBy(['environment_id' => $envId, 'status' => 'live']);
    }
}
