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

    #[Field(type: 'string', length: 100)]
    public string $action; // project.created, build.started, deploy.live …

    #[Field(type: 'string', length: 100)]
    public string $entity_type; // project, build, deployment, task …

    #[Field(type: 'integer')]
    public int $entity_id;

    #[Field(type: 'json', nullable: true)]
    public ?array $changes = null;

    #[Field(type: 'ipAddress', nullable: true)]
    public ?string $ip_address = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $user_agent = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;
}
