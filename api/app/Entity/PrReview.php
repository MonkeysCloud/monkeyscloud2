<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'pr_reviews')]
class PrReview
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $pull_request_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $reviewer_id = null;

    #[Field(type: 'enum', enumValues: ['approved', 'changes_requested', 'commented'])]
    public string $status;

    #[Field(type: 'text', nullable: true)]
    public ?string $body = null;

    #[Field(type: 'boolean', default: false)]
    public bool $is_ai = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: PullRequest::class, inversedBy: 'reviews')]
    public ?PullRequest $pullRequest = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $reviewer = null;
}
