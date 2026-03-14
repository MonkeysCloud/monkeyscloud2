<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'boards')]
class Board
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $organization_id = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $project_id = null;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'enum', enumValues: ['kanban', 'scrum'], default: 'kanban')]
    public string $type = 'kanban';

    #[Field(type: 'json', nullable: true)]
    public ?array $columns = null;

    #[Field(type: 'json', nullable: true)]
    public ?array $done_columns = null;

    #[Field(type: 'string', length: 10)]
    public string $prefix;

    #[Field(type: 'integer', default: 0)]
    public int $task_counter = 0;

    #[Field(type: 'boolean', default: false)]
    public bool $is_default = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'boards')]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'boards')]
    public ?Project $project = null;

    #[OneToMany(targetEntity: Sprint::class, mappedBy: 'board_id')]
    public array $sprints = [];

    #[OneToMany(targetEntity: Task::class, mappedBy: 'board_id')]
    public array $tasks = [];
}
