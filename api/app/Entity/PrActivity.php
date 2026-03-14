<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'pr_activities')]
class PrActivity
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $pull_request_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $user_id = null;

    #[Field(type: 'enum', enumValues: ['title_changed', 'description_changed', 'marked_draft', 'marked_ready', 'reopened', 'review_submitted', 'status_changed'])]
    public string $action;

    #[Field(type: 'text', nullable: true)]
    public ?string $old_value = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $new_value = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: PullRequest::class)]
    public ?PullRequest $pullRequest = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
