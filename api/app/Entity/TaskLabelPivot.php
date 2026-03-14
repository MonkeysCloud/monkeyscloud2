<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;

/**
 * Pivot table for many-to-many: tasks <-> task_labels.
 *
 * NOTE: The composite primary key (task_id, label_id) was created manually
 * because the schema updater only supports a single primaryKey field.
 * Do NOT run schema:update on this entity without verifying the constraint
 * remains PRIMARY KEY (task_id, label_id).
 */
#[Entity(table: 'task_label')]
class TaskLabelPivot
{
    #[Field(type: 'integer')]
    public int $task_id;

    #[Field(type: 'integer')]
    public int $label_id;
}
