<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'webhooks')]
class Webhook
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'string', length: 500)]
    public string $url;

    #[Field(type: 'string', length: 255)]
    public string $secret;

    #[Field(type: 'json')]
    public array $events;

    #[Field(type: 'boolean', default: true)]
    public bool $is_active = true;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $last_delivery_at = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $last_status = null;

    #[Field(type: 'integer', default: 0)]
    public int $failure_count = 0;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'webhooks')]
    public ?Project $project = null;
}
