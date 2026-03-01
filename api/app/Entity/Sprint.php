<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

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

    #[Field(type: 'enum', enumValues: ['planning', 'active', 'completed', 'cancelled'], default: 'planning')]
    public string $status = 'planning';

    #[Field(type: 'date')]
    public \DateTimeImmutable $start_date;

    #[Field(type: 'date')]
    public \DateTimeImmutable $end_date;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Board::class, inversedBy: 'sprints')]
    public ?Board $board = null;
}
