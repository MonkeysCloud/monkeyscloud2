<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'organization_members')]
class OrganizationMember
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'enum', enumValues: ['owner', 'admin', 'developer', 'viewer'])]
    public string $role;

    #[Field(type: 'integer', nullable: true)]
    public ?int $invited_by = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $accepted_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'members')]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: User::class, inversedBy: 'memberships')]
    public ?User $user = null;
}
