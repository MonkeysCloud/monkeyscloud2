<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'commits')]
class Commit
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $repository_id;

    #[Field(type: 'char', length: 40)]
    public string $sha;

    #[Field(type: 'text')]
    public string $message;

    #[Field(type: 'string', length: 100)]
    public string $author_name;

    #[Field(type: 'string', length: 255)]
    public string $author_email;

    #[Field(type: 'integer', nullable: true)]
    public ?int $user_id = null;

    #[Field(type: 'string', length: 255)]
    public string $branch;

    #[Field(type: 'integer', default: 0)]
    public int $files_changed = 0;

    #[Field(type: 'integer', default: 0)]
    public int $additions = 0;

    #[Field(type: 'integer', default: 0)]
    public int $deletions = 0;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $committed_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Repository::class, inversedBy: 'commits')]
    public ?Repository $repository = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
