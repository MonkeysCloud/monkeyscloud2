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
    public string $name; // free|starter|pro|enterprise

    #[Field(type: 'string', length: 50, unique: true)]
    public string $slug;

    #[Field(type: 'decimal', precision: 8, scale: 2)]
    public string $price_monthly;

    #[Field(type: 'decimal', precision: 8, scale: 2)]
    public string $price_yearly;

    #[Field(type: 'integer')]
    public int $max_projects;

    #[Field(type: 'integer')]
    public int $max_members;

    #[Field(type: 'integer', comment: 'Build minutes per month')]
    public int $build_minutes;

    #[Field(type: 'integer', comment: 'Storage in GB')]
    public int $storage_gb;

    #[Field(type: 'boolean', default: false)]
    public bool $custom_domain = false;

    #[Field(type: 'boolean', default: false)]
    public bool $ai_features = false;

    #[Field(type: 'json', nullable: true)]
    public ?array $features = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $stripe_price_id_monthly = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $stripe_price_id_yearly = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[OneToMany(targetEntity: Subscription::class, mappedBy: 'plan_id')]
    public array $subscriptions = [];
}
