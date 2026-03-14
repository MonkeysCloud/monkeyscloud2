<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;

#[Entity(table: 'task_custom_field_values')]
class TaskCustomFieldValue
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $task_id;

    #[Field(type: 'integer')]
    public int $field_config_id;

    #[Field(type: 'text', nullable: true)]
    public ?string $value = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;
}
