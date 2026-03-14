<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\TaskCustomFieldValue;
use MonkeysLegion\Repository\EntityRepository;

class TaskCustomFieldValueRepository extends EntityRepository
{
    protected string $table = 'task_custom_field_values';
    protected string $entityClass = TaskCustomFieldValue::class;

    public function findByTask(int $taskId): array
    {
        return $this->findBy(['task_id' => $taskId]);
    }

    public function findByTaskAndField(int $taskId, int $fieldConfigId): ?TaskCustomFieldValue
    {
        $results = $this->findBy(['task_id' => $taskId, 'field_config_id' => $fieldConfigId]);
        return $results[0] ?? null;
    }
}
