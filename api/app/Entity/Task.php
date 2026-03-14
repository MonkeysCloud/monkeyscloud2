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

    #[Field(type: 'integer')]
    public int $number;

    #[Field(type: 'string', length: 255)]
    public string $title;

    #[Field(type: 'text', nullable: true)]
    public ?string $description = null;

    #[Field(type: 'enum', enumValues: ['task', 'bug', 'feature', 'improvement', 'epic', 'story'], default: 'task')]
    public string $type = 'task';

    #[Field(type: 'string', length: 50, default: 'backlog')]
    public string $status = 'backlog';

    #[Field(type: 'enum', enumValues: ['urgent', 'high', 'medium', 'low', 'none'], default: 'medium')]
    public string $priority = 'medium';

    #[Field(type: 'decimal', precision: 4, scale: 1, nullable: true)]
    public ?string $story_points = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $assignee_id = null;

    #[Field(type: 'integer')]
    public int $reporter_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $parent_id = null;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $branch_name = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $pull_request_id = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $deployment_id = null;

    #[Field(type: 'date', nullable: true)]
    public ?\DateTimeImmutable $due_date = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $started_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $completed_at = null;

    #[Field(type: 'integer', default: 0)]
    public int $position = 0;

    #[Field(type: 'boolean', default: false)]
    public bool $ai_generated = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $deleted_at = null;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Board::class, inversedBy: 'tasks')]
    public ?Board $board = null;

    #[ManyToOne(targetEntity: Sprint::class, inversedBy: 'tasks')]
    public ?Sprint $sprint = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $assignee = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $reporter = null;

    #[ManyToOne(targetEntity: Task::class)]
    public ?Task $parent = null;

    #[OneToMany(targetEntity: Task::class, mappedBy: 'parent_id')]
    public array $children = [];

    #[ManyToOne(targetEntity: PullRequest::class)]
    public ?PullRequest $pullRequest = null;

    #[ManyToOne(targetEntity: Deployment::class)]
    public ?Deployment $deployment = null;

    #[ManyToMany(targetEntity: TaskLabel::class, inversedBy: 'tasks')]
    #[JoinTable(name: 'task_label', joinColumn: 'task_id', inverseJoinColumn: 'label_id')]
    public array $labels = [];

    #[OneToMany(targetEntity: TaskComment::class, mappedBy: 'task_id')]
    public array $comments = [];

    #[OneToMany(targetEntity: TimeEntry::class, mappedBy: 'task_id')]
    public array $timeEntries = [];
}
