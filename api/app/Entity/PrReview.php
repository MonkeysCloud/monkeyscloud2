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

    #[Field(type: 'integer')]
    public int $reviewer_id;

    #[Field(type: 'enum', enumValues: ['approved', 'changes_requested', 'commented'])]
    public string $status;

    #[Field(type: 'text', nullable: true)]
    public ?string $body = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: PullRequest::class, inversedBy: 'reviews')]
    public ?PullRequest $pull_request = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $reviewer = null;
}
