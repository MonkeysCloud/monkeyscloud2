<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'notifications')]
class Notification
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'enum', enumValues: [
        'build_failed',
        'pr_review',
        'task_assigned',
        'deploy_done',
        'invitation',
        'mention',
        'ai_alert'
    ])]
    public string $type;

    #[Field(type: 'string', length: 255)]
    public string $title;

    #[Field(type: 'text', nullable: true)]
    public ?string $body = null;

    #[Field(type: 'string', length: 50, nullable: true)]
    public ?string $entity_type = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $entity_id = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $read_at = null;

    #[Field(type: 'enum', enumValues: ['in_app', 'email', 'slack', 'webhook'], default: 'in_app')]
    public string $channel = 'in_app';

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $sent_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: User::class, inversedBy: 'notifications')]
    public ?User $user = null;

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;
}
