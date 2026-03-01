<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'deployments')]
class Deployment
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'integer')]
    public int $environment_id;

    #[Field(type: 'integer')]
    public int $build_id;

    #[Field(type: 'enum', enumValues: ['pending', 'deploying', 'live', 'failed', 'rolled_back'], default: 'pending')]
    public string $status = 'pending';

    #[Field(type: 'enum', enumValues: ['rolling', 'blue_green', 'canary'], default: 'rolling')]
    public string $strategy = 'rolling';

    #[Field(type: 'integer')]
    public int $deployed_by;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $url = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $duration_seconds = null;

    #[Field(type: 'integer', nullable: true, comment: 'Rollback target deployment')]
    public ?int $rollback_from_id = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_risk_assessment = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $started_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $finished_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Project::class)]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class)]
    public ?Environment $environment = null;

    #[ManyToOne(targetEntity: Build::class)]
    public ?Build $build = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $deployer = null;
}
