<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\TaskLabel;
use MonkeysLegion\Repository\EntityRepository;

class TaskLabelRepository extends EntityRepository
{
    protected string $table = 'task_labels';
    protected string $entityClass = TaskLabel::class;

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }
}
