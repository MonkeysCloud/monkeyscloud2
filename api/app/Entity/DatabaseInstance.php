<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'database_instances')]
class DatabaseInstance
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'integer')]
    public int $environment_id;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'enum', enumValues: ['postgres', 'mysql', 'redis'])]
    public string $engine;

    #[Field(type: 'string', length: 20)]
    public string $engine_version;

    #[Field(type: 'enum', enumValues: ['micro', 'small', 'medium', 'large', 'xlarge'])]
    public string $tier;

    #[Field(type: 'integer', default: 10)]
    public int $storage_gb = 10;

    #[Field(type: 'boolean', default: false)]
    public bool $high_availability = false;

    #[Field(type: 'enum', enumValues: ['provisioning', 'running', 'stopped', 'error', 'deleting'], default: 'provisioning')]
    public string $status = 'provisioning';

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $host = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $port = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $database_name = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $username = null;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $password_encrypted = null;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $connection_url_encrypted = null;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $gcp_instance_id = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class)]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class)]
    public ?Environment $environment = null;

    #[OneToMany(targetEntity: DatabaseBackup::class, mappedBy: 'database_instance_id')]
    public array $backups = [];
}
