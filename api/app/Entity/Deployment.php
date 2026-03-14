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

    #[Field(type: 'string', length: 50, nullable: true)]
    public ?string $version = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $image_tag = null;

    #[Field(type: 'enum', enumValues: ['pending', 'deploying', 'active', 'failed', 'rolled_back', 'superseded'], default: 'pending')]
    public string $status = 'pending';

    #[Field(type: 'enum', enumValues: ['rolling', 'blue_green', 'canary'], default: 'rolling')]
    public string $strategy = 'rolling';

    #[Field(type: 'integer', nullable: true)]
    public ?int $deployed_by = null;

    #[Field(type: 'integer', default: 1)]
    public int $replicas = 1;

    #[Field(type: 'integer', nullable: true)]
    public ?int $rollback_to_id = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $rolled_back_by = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_risk_assessment = null;

    #[Field(type: 'enum', enumValues: ['low', 'medium', 'high'], nullable: true)]
    public ?string $ai_risk_score = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_health_report = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $release_notes = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $deployed_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $rolled_back_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'deployments')]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class, inversedBy: 'deployments')]
    public ?Environment $environment = null;

    #[ManyToOne(targetEntity: Build::class, inversedBy: 'deployments')]
    public ?Build $build = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $deployer = null;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $rollbackBy = null;

    #[ManyToOne(targetEntity: Deployment::class)]
    public ?Deployment $rollbackTarget = null;
}
