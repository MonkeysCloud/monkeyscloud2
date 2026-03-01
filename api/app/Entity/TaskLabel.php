<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToMany;

#[Entity(table: 'task_labels')]
class TaskLabel
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'string', length: 50)]
    public string $name;

    #[Field(type: 'string', length: 7)]
    public string $color; // #hex

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToMany(targetEntity: Task::class, mappedBy: 'labels')]
    public array $tasks = [];
}
