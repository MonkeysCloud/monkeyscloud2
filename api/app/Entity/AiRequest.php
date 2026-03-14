<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'ai_requests')]
class AiRequest
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $user_id = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $project_id = null;

    #[Field(type: 'enum', enumValues: [
        'pr_summary',
        'code_review',
        'task_create',
        'sprint_plan',
        'build_analysis',
        'deploy_risk',
        'deploy_health',
        'chat',
        'search',
        'standup',
        'release_notes',
        'onboarding'
    ])]
    public string $feature;

    #[Field(type: 'string', length: 50)]
    public string $model;

    #[Field(type: 'integer', default: 0)]
    public int $prompt_tokens = 0;

    #[Field(type: 'integer', default: 0)]
    public int $completion_tokens = 0;

    #[Field(type: 'integer', default: 0)]
    public int $total_tokens = 0;

    #[Field(type: 'decimal', precision: 8, scale: 6)]
    public string $cost_usd;

    #[Field(type: 'integer')]
    public int $latency_ms;

    #[Field(type: 'boolean', default: false)]
    public bool $cached = false;

    #[Field(type: 'enum', enumValues: ['success', 'error', 'rate_limited', 'budget_exceeded'], default: 'success')]
    public string $status = 'success';

    #[Field(type: 'text', nullable: true)]
    public ?string $error_message = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'aiRequests')]
    public ?Organization $organization = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;

    #[ManyToOne(targetEntity: Project::class)]
    public ?Project $project = null;
}
