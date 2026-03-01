<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'pr_comments')]
class PrComment
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $pull_request_id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'text')]
    public string $body;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $file_path = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $line_number = null;

    #[Field(type: 'char', length: 40, nullable: true)]
    public ?string $commit_sha = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $parent_id = null;

    #[Field(type: 'boolean', default: false)]
    public bool $resolved = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: PullRequest::class, inversedBy: 'comments')]
    public ?PullRequest $pull_request = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
