<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'time_entries')]
class TimeEntry
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $task_id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'integer')]
    public int $duration_minutes;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $description = null;

    #[Field(type: 'date')]
    public \DateTimeImmutable $logged_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Task::class, inversedBy: 'timeEntries')]
    public ?Task $task = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
