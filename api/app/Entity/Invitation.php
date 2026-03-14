<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'invitations')]
class Invitation
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'string', length: 255)]
    public string $email;

    #[Field(type: 'enum', enumValues: ['owner', 'admin', 'developer', 'viewer'])]
    public string $role;

    #[Field(type: 'string', length: 64, unique: true)]
    public string $token;

    #[Field(type: 'integer')]
    public int $invited_by;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $expires_at;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $accepted_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $deleted_at = null;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'invitations')]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $inviter = null;
}
