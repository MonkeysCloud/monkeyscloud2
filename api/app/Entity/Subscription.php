<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'subscriptions')]
class Subscription
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'integer')]
    public int $plan_id;

    #[Field(type: 'enum', enumValues: ['active', 'past_due', 'cancelled', 'trialing'], default: 'trialing')]
    public string $status = 'trialing';

    #[Field(type: 'enum', enumValues: ['monthly', 'yearly'], default: 'monthly')]
    public string $billing_period = 'monthly';

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $stripe_subscription_id = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $trial_ends_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $current_period_start = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $current_period_end = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $cancelled_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: Plan::class, inversedBy: 'subscriptions')]
    public ?Plan $plan = null;
}
