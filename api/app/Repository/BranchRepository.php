<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Branch;
use MonkeysLegion\Repository\EntityRepository;

class BranchRepository extends EntityRepository
{
    protected string $table = 'branches';
    protected string $entityClass = Branch::class;

    public function findByRepository(int $repositoryId): array
    {
        return $this->findBy(['repository_id' => $repositoryId]);
    }
}
