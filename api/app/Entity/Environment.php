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

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $branch = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $url = null;

    #[Field(type: 'enum', enumValues: ['active', 'stopped', 'deploying', 'failed'], default: 'active')]
    public string $status = 'active';

    #[Field(type: 'integer', default: 1)]
    public int $replicas = 1;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $cpu_limit = null;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $memory_limit = null;

    #[Field(type: 'boolean', default: true)]
    public bool $auto_deploy = true;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'environments')]
    public ?Project $project = null;

    #[OneToMany(targetEntity: EnvironmentVariable::class, mappedBy: 'environment_id')]
    public array $variables = [];
}
