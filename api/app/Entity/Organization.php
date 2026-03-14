<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;
use MonkeysLegion\Entity\Attributes\OneToOne;

#[Entity(table: 'organizations')]
class Organization
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'string', length: 100, unique: true)]
    public string $slug;

    #[Field(type: 'integer')]
    public int $owner_id;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $avatar_url = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $plan_id = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $stripe_customer_id = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $trial_ends_at = null;

    #[Field(type: 'json', nullable: true)]
    public ?array $settings = null;

    #[Field(type: 'boolean', default: true)]
    public bool $ai_enabled = true;

    #[Field(type: 'decimal', precision: 8, scale: 2, default: '50.00')]
    public string $ai_monthly_budget_usd = '50.00';

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: User::class)]
    public ?User $owner = null;

    #[ManyToOne(targetEntity: Plan::class)]
    public ?Plan $plan = null;

    #[OneToMany(targetEntity: OrganizationMember::class, mappedBy: 'organization_id')]
    public array $members = [];

    #[OneToMany(targetEntity: Project::class, mappedBy: 'organization_id')]
    public array $projects = [];

    #[OneToMany(targetEntity: Board::class, mappedBy: 'organization_id')]
    public array $boards = [];

    #[OneToMany(targetEntity: TaskLabel::class, mappedBy: 'organization_id')]
    public array $labels = [];

    #[OneToMany(targetEntity: Invitation::class, mappedBy: 'organization_id')]
    public array $invitations = [];

    #[OneToMany(targetEntity: ApiKey::class, mappedBy: 'organization_id')]
    public array $apiKeys = [];

    #[OneToMany(targetEntity: UsageRecord::class, mappedBy: 'organization_id')]
    public array $usageRecords = [];

    #[OneToMany(targetEntity: AiRequest::class, mappedBy: 'organization_id')]
    public array $aiRequests = [];

    #[OneToMany(targetEntity: ActivityLog::class, mappedBy: 'organization_id')]
    public array $activityLog = [];
}
