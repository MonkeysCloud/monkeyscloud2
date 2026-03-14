<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'branches')]
class Branch
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $repository_id;

    #[Field(type: 'string', length: 255)]
    public string $name;

    #[Field(type: 'char', length: 40)]
    public string $head_commit_sha;

    #[Field(type: 'boolean', default: false)]
    public bool $is_default = false;

    #[Field(type: 'boolean', default: false)]
    public bool $is_protected = false;

    #[Field(type: 'json', nullable: true)]
    public ?array $protection_rules = null;

    #[Field(type: 'integer', default: 0)]
    public int $behind_count = 0;

    #[Field(type: 'integer', default: 0)]
    public int $ahead_count = 0;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Repository::class, inversedBy: 'branches')]
    public ?Repository $repository = null;
}
