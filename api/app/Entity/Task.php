<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;
use MonkeysLegion\Entity\Attributes\ManyToMany;
use MonkeysLegion\Entity\Attributes\JoinTable;

#[Entity(table: 'tasks')]
class Task
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $board_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $sprint_id = null;

    #[Field(type: 'string', length: 20)]
    public string $key; // e.g. MC-42

    #[Field(type: 'string', length: 255)]
    public string $title;

    #[Field(type: 'text', nullable: true)]
    public ?string $description = null;

    #[Field(type: 'enum', enumValues: ['backlog', 'todo', 'in_progress', 'in_review', 'done', 'cancelled'], default: 'backlog')]
    public string $status = 'backlog';

    #[Field(type: 'enum', enumValues: ['low', 'medium', 'high', 'critical'], default: 'medium')]
    public string $priority = 'medium';

    #[Field(type: 'enum', enumValues: ['task', 'bug', 'feature', 'epic', 'story'], default: 'task')]
    public string $type = 'task';

    #[Field(type: 'integer')]
    public int $reporter_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $assignee_id = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $parent_id = null;

    #[Field(type: 'integer', default: 0)]
    public int $story_points = 0;

    #[Field(type: 'integer', default: 0)]
    public int $sort_order = 0;

    #[Field(type: 'date', nullable: true)]
    public ?\DateTimeImmutable $due_date = null;

    #[Field(type: 'integer', nullable: true, comment: 'Linked PR')]
    public ?int $pull_request_id = null;

    #[Field(type: 'char', length: 40, nullable: true, comment: 'Linked commit')]
    public ?string $linked_commit_sha = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_suggestion = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Board::class, inversedBy: 'tasks')]
    public ?Board $board = null;

    #[ManyToOne(targetEntity: Sprint::class)]
    public ?Sprint $sprint = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $reporter = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $assignee = null;

    #[ManyToMany(targetEntity: TaskLabel::class, inversedBy: 'tasks')]
    #[JoinTable(name: 'task_label', joinColumn: 'task_id', inverseJoinColumn: 'label_id')]
    public array $labels = [];

    #[OneToMany(targetEntity: TaskComment::class, mappedBy: 'task_id')]
    public array $comments = [];

    #[OneToMany(targetEntity: TimeEntry::class, mappedBy: 'task_id')]
    public array $time_entries = [];
}
