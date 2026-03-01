<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'pull_requests')]
class PullRequest
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'integer')]
    public int $number;

    #[Field(type: 'string', length: 255)]
    public string $title;

    #[Field(type: 'text', nullable: true)]
    public ?string $description = null;

    #[Field(type: 'enum', enumValues: ['open', 'merged', 'closed', 'draft'], default: 'open')]
    public string $status = 'open';

    #[Field(type: 'string', length: 100)]
    public string $source_branch;

    #[Field(type: 'string', length: 100)]
    public string $target_branch;

    #[Field(type: 'integer')]
    public int $author_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $reviewer_id = null;

    #[Field(type: 'enum', enumValues: ['merge', 'squash', 'rebase'], default: 'merge')]
    public string $merge_strategy = 'merge';

    #[Field(type: 'char', length: 40, nullable: true)]
    public ?string $merge_sha = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $merged_by = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $merged_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $closed_at = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_summary = null;

    #[Field(type: 'json', nullable: true)]
    public ?array $labels = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'pull_requests')]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $author = null;

    #[OneToMany(targetEntity: PrReview::class, mappedBy: 'pull_request_id')]
    public array $reviews = [];

    #[OneToMany(targetEntity: PrComment::class, mappedBy: 'pull_request_id')]
    public array $comments = [];
}
