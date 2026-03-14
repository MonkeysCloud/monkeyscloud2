<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'activity_logs')]
class ActivityLog
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $user_id = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $project_id = null;

    #[Field(type: 'string', length: 50)]
    public string $entity_type;

    #[Field(type: 'integer')]
    public int $entity_id;

    #[Field(type: 'string', length: 50)]
    public string $action;

    #[Field(type: 'json', nullable: true)]
    public ?array $changes = null;

    #[Field(type: 'string', length: 45, nullable: true)]
    public ?string $ip_address = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $user_agent = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'activityLog')]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;

    #[ManyToOne(targetEntity: Project::class)]
    public ?Project $project = null;
}
