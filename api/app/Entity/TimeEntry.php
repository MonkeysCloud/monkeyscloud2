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

    #[Field(type: 'integer', comment: 'Duration in minutes')]
    public int $minutes;

    #[Field(type: 'text', nullable: true)]
    public ?string $note = null;

    #[Field(type: 'date')]
    public \DateTimeImmutable $logged_date;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: Task::class, inversedBy: 'time_entries')]
    public ?Task $task = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
