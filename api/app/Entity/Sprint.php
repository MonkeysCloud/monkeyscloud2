<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'sprints')]
class Sprint
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $board_id;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'text', nullable: true)]
    public ?string $goal = null;

    #[Field(type: 'date')]
    public \DateTimeImmutable $starts_at;

    #[Field(type: 'date')]
    public \DateTimeImmutable $ends_at;

    #[Field(type: 'enum', enumValues: ['planning', 'active', 'completed', 'cancelled'], default: 'planning')]
    public string $status = 'planning';

    #[Field(type: 'decimal', precision: 6, scale: 1, nullable: true)]
    public ?string $velocity = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_retrospective = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Board::class, inversedBy: 'sprints')]
    public ?Board $board = null;

    #[OneToMany(targetEntity: Task::class, mappedBy: 'sprint_id')]
    public array $tasks = [];
}
