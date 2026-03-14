<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'pr_comments')]
class PrComment
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $pull_request_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $user_id = null;

    #[Field(type: 'boolean', default: false)]
    public bool $is_ai = false;

    #[Field(type: 'text')]
    public string $body;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $file_path = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $line_number = null;

    #[Field(type: 'enum', enumValues: ['left', 'right'], nullable: true)]
    public ?string $side = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $parent_id = null;

    #[Field(type: 'char', length: 40, nullable: true)]
    public ?string $commit_sha = null;

    #[Field(type: 'boolean', default: false)]
    public bool $is_resolved = false;

    #[Field(type: 'integer', nullable: true)]
    public ?int $resolved_by = null;

    #[Field(type: 'enum', enumValues: ['comment', 'change_request'], default: 'comment')]
    public string $comment_type = 'comment';

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: PullRequest::class, inversedBy: 'comments')]
    public ?PullRequest $pullRequest = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;

    #[ManyToOne(targetEntity: PrComment::class)]
    public ?PrComment $parent = null;

    #[OneToMany(targetEntity: PrComment::class, mappedBy: 'parent_id')]
    public array $replies = [];
}
