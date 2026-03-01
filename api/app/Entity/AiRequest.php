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

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $project_id = null;

    #[Field(type: 'enum', enumValues: ['code_review', 'pr_summary', 'build_analysis', 'deploy_risk', 'task_suggestion', 'code_generation'])]
    public string $type;

    #[Field(type: 'string', length: 50)]
    public string $model; // gpt-4, gemini-pro, claude-3, etc.

    #[Field(type: 'integer')]
    public int $input_tokens;

    #[Field(type: 'integer')]
    public int $output_tokens;

    #[Field(type: 'decimal', precision: 8, scale: 6)]
    public string $cost_usd;

    #[Field(type: 'integer', comment: 'Latency in ms')]
    public int $latency_ms;

    #[Field(type: 'boolean', default: true)]
    public bool $success = true;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;
}
