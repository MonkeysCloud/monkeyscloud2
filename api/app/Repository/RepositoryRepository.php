<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Repository;
use MonkeysLegion\Repository\EntityRepository;

class RepositoryRepository extends EntityRepository
{
    protected string $table = 'repositories';
    protected string $entityClass = Repository::class;

    public function findByProject(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId]);
    }

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }
}
