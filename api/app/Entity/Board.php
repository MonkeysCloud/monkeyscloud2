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

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $project_id = null;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'text', nullable: true)]
    public ?string $description = null;

    #[Field(type: 'json', nullable: true, comment: 'Column definitions: [{name,order,limit}]')]
    public ?array $columns = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'boards')]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: Project::class)]
    public ?Project $project = null;

    #[OneToMany(targetEntity: Sprint::class, mappedBy: 'board_id')]
    public array $sprints = [];

    #[OneToMany(targetEntity: Task::class, mappedBy: 'board_id')]
    public array $tasks = [];
}
