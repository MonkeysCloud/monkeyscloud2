<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'usage_records')]
class UsageRecord
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'enum', enumValues: ['build_minutes', 'storage_gb', 'bandwidth_gb', 'ai_tokens', 'db_hours'])]
    public string $metric;

    #[Field(type: 'decimal', precision: 12, scale: 4)]
    public string $quantity;

    #[Field(type: 'date')]
    public \DateTimeImmutable $period_start;

    #[Field(type: 'date')]
    public \DateTimeImmutable $period_end;

    #[Field(type: 'integer', nullable: true)]
    public ?int $unit_price_cents = null;

    #[Field(type: 'boolean', default: false)]
    public bool $reported_to_stripe = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'usageRecords')]
    public ?Organization $organization = null;
}
