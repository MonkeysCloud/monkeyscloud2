<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'api_keys')]
class ApiKey
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'string', length: 255)]
    public string $key_hash;

    #[Field(type: 'string', length: 8)]
    public string $key_prefix;

    #[Field(type: 'json')]
    public array $scopes;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $last_used_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $expires_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $revoked_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
