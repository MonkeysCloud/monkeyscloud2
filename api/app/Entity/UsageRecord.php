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

    #[Field(type: 'enum', enumValues: ['build_minutes', 'storage_bytes', 'bandwidth_bytes', 'ai_tokens'])]
    public string $metric;

    #[Field(type: 'bigInt')]
    public int $quantity;

    #[Field(type: 'date')]
    public \DateTimeImmutable $recorded_date;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;
}
