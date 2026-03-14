<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'plans')]
class Plan
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'string', length: 50)]
    public string $name;

    #[Field(type: 'string', length: 50, unique: true)]
    public string $slug;

    #[Field(type: 'integer', default: 0)]
    public int $price_monthly_cents = 0;

    #[Field(type: 'integer', default: 0)]
    public int $price_yearly_cents = 0;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $stripe_price_id_monthly = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $stripe_price_id_yearly = null;

    #[Field(type: 'json')]
    public array $limits = [];

    #[Field(type: 'json')]
    public array $features = [];

    #[Field(type: 'boolean', default: true)]
    public bool $is_active = true;

    #[Field(type: 'integer', default: 0)]
    public int $sort_order = 0;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[OneToMany(targetEntity: Subscription::class, mappedBy: 'plan_id')]
    public array $subscriptions = [];
}
