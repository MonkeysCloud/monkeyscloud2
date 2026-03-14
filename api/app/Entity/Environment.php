<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'environments')]
class Environment
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'string', length: 50)]
    public string $name;

    #[Field(type: 'string', length: 50)]
    public string $slug;

    #[Field(type: 'enum', enumValues: ['production', 'staging', 'preview', 'development', 'testing', 'custom'])]
    public string $type;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $url = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $branch = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $pull_request_id = null;

    #[Field(type: 'boolean', default: true)]
    public bool $auto_deploy = true;

    #[Field(type: 'boolean', default: false)]
    public bool $is_production = false;

    // --- GCP Compute Engine ---

    #[Field(type: 'string', length: 50, nullable: true)]
    public ?string $region = null;

    #[Field(type: 'string', length: 50, default: 'e2-micro')]
    public string $machine_type = 'e2-micro';

    #[Field(type: 'integer', default: 20)]
    public int $disk_size_gb = 20;

    #[Field(type: 'string', length: 50, nullable: true)]
    public ?string $ip_address = null;

    #[Field(type: 'string', length: 50, nullable: true)]
    public ?string $internal_ip = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $instance_id = null;

    // --- SSH Access ---

    #[Field(type: 'string', length: 50, nullable: true)]
    public ?string $ssh_user = null;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $ssh_password_hash = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ssh_public_key = null;

    // --- Terraform ---

    #[Field(type: 'text', nullable: true)]
    public ?string $terraform_state = null;

    #[Field(type: 'enum', enumValues: ['pending', 'installing', 'ready', 'error'], nullable: true)]
    public ?string $stack_status = null;

    // --- Infrastructure ---

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $k8s_namespace = null;

    #[Field(type: 'integer', default: 1)]
    public int $replicas = 1;

    #[Field(type: 'integer', nullable: true)]
    public ?int $sleep_after_minutes = null;

    #[Field(type: 'enum', enumValues: ['pending', 'provisioning', 'active', 'building', 'deploying', 'sleeping', 'stopped', 'error'], default: 'pending')]
    public string $status = 'pending';

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'environments')]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: PullRequest::class)]
    public ?PullRequest $pullRequest = null;

    #[OneToMany(targetEntity: Deployment::class, mappedBy: 'environment_id')]
    public array $deployments = [];

    #[OneToMany(targetEntity: Build::class, mappedBy: 'environment_id')]
    public array $builds = [];

    #[OneToMany(targetEntity: Domain::class, mappedBy: 'environment_id')]
    public array $domains = [];

    #[OneToMany(targetEntity: EnvironmentVariable::class, mappedBy: 'environment_id')]
    public array $envVars = [];
}
