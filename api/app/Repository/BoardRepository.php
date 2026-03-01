<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Board;
use MonkeysLegion\Repository\EntityRepository;

class BoardRepository extends EntityRepository
{
    protected string $table = 'boards';
    protected string $entityClass = Board::class;

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }

    public function findByProject(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId]);
    }
}
