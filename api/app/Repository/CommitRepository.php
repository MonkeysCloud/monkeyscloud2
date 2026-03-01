<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Commit;
use MonkeysLegion\Repository\EntityRepository;

class CommitRepository extends EntityRepository
{
    protected string $table = 'commits';
    protected string $entityClass = Commit::class;

    public function findByProject(int $projectId, ?string $branch = null): array
    {
        $criteria = ['project_id' => $projectId];
        if ($branch) {
            $criteria['branch'] = $branch;
        }
        return $this->findBy($criteria);
    }

    public function findBySha(int $projectId, string $sha): ?Commit
    {
        return $this->findOneBy(['project_id' => $projectId, 'sha' => $sha]);
    }
}
