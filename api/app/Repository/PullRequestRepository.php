<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\PullRequest;
use MonkeysLegion\Repository\EntityRepository;

class PullRequestRepository extends EntityRepository
{
    protected string $table = 'pull_requests';
    protected string $entityClass = PullRequest::class;

    public function findByProject(int $projectId, ?string $status = null): array
    {
        $criteria = ['project_id' => $projectId];
        if ($status) {
            $criteria['status'] = $status;
        }
        return $this->findBy($criteria);
    }

    public function findByNumber(int $projectId, int $number): ?PullRequest
    {
        return $this->findOneBy(['project_id' => $projectId, 'number' => $number]);
    }

    public function nextNumber(int $projectId): int
    {
        $result = $this->findBy(['project_id' => $projectId]);
        return count($result) + 1;
    }
}
