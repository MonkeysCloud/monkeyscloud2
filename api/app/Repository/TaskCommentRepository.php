<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\TaskComment;
use MonkeysLegion\Repository\EntityRepository;

class TaskCommentRepository extends EntityRepository
{
    protected string $table = 'task_comments';
    protected string $entityClass = TaskComment::class;

    public function findByTask(int $taskId): array
    {
        return $this->findBy(['task_id' => $taskId]);
    }
}
