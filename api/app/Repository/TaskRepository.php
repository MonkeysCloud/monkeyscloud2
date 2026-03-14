<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Task;
use MonkeysLegion\Repository\EntityRepository;

class TaskRepository extends EntityRepository
{
    protected string $table = 'tasks';
    protected string $entityClass = Task::class;

    public function findByBoard(int $boardId, ?string $status = null): array
    {
        $criteria = ['board_id' => $boardId];
        if ($status) {
            $criteria['status'] = $status;
        }
        return $this->findBy($criteria);
    }

    public function findBySprint(int $sprintId): array
    {
        return $this->findBy(['sprint_id' => $sprintId]);
    }

    public function findByAssignee(int $userId): array
    {
        return $this->findBy(['assignee_id' => $userId]);
    }

    public function findByKey(string $key): ?Task
    {
        return $this->findOneBy(['key' => $key]);
    }

    /** Expose PDO from the underlying query builder */
    public function getPdo(): \PDO
    {
        return $this->qb->pdo();
    }
}
