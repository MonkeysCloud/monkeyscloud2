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
    public int $repository_id;

    #[Field(type: 'integer')]
    public int $number;

    #[Field(type: 'string', length: 255)]
    public string $title;

    #[Field(type: 'text', nullable: true)]
    public ?string $description = null;

    #[Field(type: 'string', length: 255)]
    public string $source_branch;

    #[Field(type: 'string', length: 255)]
    public string $target_branch;

    #[Field(type: 'integer')]
    public int $author_id;

    #[Field(type: 'enum', enumValues: ['open', 'merged', 'closed', 'draft'], default: 'open')]
    public string $status = 'open';

    #[Field(type: 'boolean', default: false)]
    public bool $is_draft = false;

    #[Field(type: 'integer', nullable: true)]
    public ?int $merged_by = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $merged_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $closed_at = null;

    #[Field(type: 'char', length: 40, nullable: true)]
    public ?string $merge_commit_sha = null;

    #[Field(type: 'enum', enumValues: ['merge', 'squash', 'rebase'], nullable: true)]
    public ?string $merge_strategy = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $diff_text = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_summary = null;

    #[Field(type: 'enum', enumValues: ['low', 'medium', 'high'], nullable: true)]
    public ?string $ai_risk_score = null;

    #[Field(type: 'integer', default: 0)]
    public int $review_count = 0;

    #[Field(type: 'integer', default: 0)]
    public int $approval_count = 0;

    #[Field(type: 'integer', default: 0)]
    public int $comments_count = 0;

    #[Field(type: 'integer', nullable: true)]
    public ?int $additions = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $deletions = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $files_changed = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $deleted_at = null;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Repository::class, inversedBy: 'pullRequests')]
    public ?Repository $repository = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $author = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $merger = null;

    #[OneToMany(targetEntity: PrReview::class, mappedBy: 'pull_request_id')]
    public array $reviews = [];

    #[OneToMany(targetEntity: PrComment::class, mappedBy: 'pull_request_id')]
    public array $comments = [];
}
