<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'task_comments')]
class TaskComment
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $task_id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'text')]
    public string $body;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Task::class, inversedBy: 'comments')]
    public ?Task $task = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
