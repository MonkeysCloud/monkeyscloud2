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

    #[Field(type: 'enum', enumValues: ['admin', 'developer', 'viewer'])]
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

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;
}
