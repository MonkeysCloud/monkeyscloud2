<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'task_comments')]
class TaskComment
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $task_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $user_id = null;

    #[Field(type: 'boolean', default: false)]
    public bool $is_ai = false;

    #[Field(type: 'text')]
    public string $body;

    #[Field(type: 'integer', nullable: true)]
    public ?int $parent_id = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Task::class, inversedBy: 'comments')]
    public ?Task $task = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;

    #[ManyToOne(targetEntity: TaskComment::class)]
    public ?TaskComment $parent = null;

    #[OneToMany(targetEntity: TaskComment::class, mappedBy: 'parent_id')]
    public array $replies = [];
}
