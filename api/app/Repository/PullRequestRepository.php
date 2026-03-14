<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\PullRequest;
use MonkeysLegion\Repository\EntityRepository;

class PullRequestRepository extends EntityRepository
{
    protected string $table = 'pull_requests';
    protected string $entityClass = PullRequest::class;

    public function findByRepository(int $repositoryId, ?string $status = null): array
    {
        if ($status === 'open') {
            // Include draft PRs alongside open ones
            $open = $this->findBy(['repository_id' => $repositoryId, 'status' => 'open'], ['created_at' => 'DESC']);
            $draft = $this->findBy(['repository_id' => $repositoryId, 'status' => 'draft'], ['created_at' => 'DESC']);
            $all = array_merge($open, $draft);
            usort($all, fn($a, $b) => $b->created_at <=> $a->created_at);
            return $all;
        }
        $criteria = ['repository_id' => $repositoryId];
        if ($status) {
            $criteria['status'] = $status;
        }
        return $this->findBy($criteria, ['created_at' => 'DESC']);
    }

    public function findByNumber(int $repositoryId, int $number): ?PullRequest
    {
        return $this->findOneBy(['repository_id' => $repositoryId, 'number' => $number]);
    }

    public function nextNumber(int $repositoryId): int
    {
        $result = $this->findBy(['repository_id' => $repositoryId]);
        return count($result) + 1;
    }
}
