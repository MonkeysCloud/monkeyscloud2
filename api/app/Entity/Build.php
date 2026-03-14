<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'builds')]
class Build
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'integer')]
    public int $environment_id;

    #[Field(type: 'integer')]
    public int $number;

    #[Field(type: 'char', length: 40)]
    public string $commit_sha;

    #[Field(type: 'string', length: 255)]
    public string $branch;

    #[Field(type: 'enum', enumValues: ['queued', 'running', 'success', 'failed', 'cancelled'], default: 'queued')]
    public string $status = 'queued';

    #[Field(type: 'integer', nullable: true)]
    public ?int $triggered_by = null;

    #[Field(type: 'enum', enumValues: ['push', 'manual', 'pr', 'schedule', 'rollback', 'api'], default: 'push')]
    public string $trigger = 'push';

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $cloud_build_id = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $log_url = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $image_tag = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $duration_seconds = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $error_message = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_analysis = null;

    #[Field(type: 'json', nullable: true)]
    public ?array $ai_review = null;

    #[Field(type: 'enum', enumValues: ['low', 'medium', 'high'], nullable: true)]
    public ?string $ai_risk_score = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $started_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $finished_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'builds')]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class, inversedBy: 'builds')]
    public ?Environment $environment = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $triggeredBy = null;

    #[OneToMany(targetEntity: BuildStep::class, mappedBy: 'build_id')]
    public array $steps = [];

    #[OneToMany(targetEntity: Deployment::class, mappedBy: 'build_id')]
    public array $deployments = [];
}
