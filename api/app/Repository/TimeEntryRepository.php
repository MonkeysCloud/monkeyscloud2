<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\TimeEntry;
use MonkeysLegion\Repository\EntityRepository;

class TimeEntryRepository extends EntityRepository
{
    protected string $table = 'time_entries';
    protected string $entityClass = TimeEntry::class;

    public function findByTask(int $taskId): array
    {
        return $this->findBy(['task_id' => $taskId]);
    }

    public function findByUser(int $userId): array
    {
        return $this->findBy(['user_id' => $userId]);
    }
}
