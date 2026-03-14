<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'environment_variables')]
class EnvironmentVariable
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'integer', nullable: true)]
    public ?int $environment_id = null;

    #[Field(type: 'string', length: 255)]
    public string $key;

    #[Field(type: 'text')]
    public string $value;

    #[Field(type: 'boolean', default: false)]
    public bool $is_secret = false;

    #[Field(type: 'enum', enumValues: ['build', 'runtime', 'both'], default: 'both')]
    public string $target = 'both';

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'envVars')]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class, inversedBy: 'envVars')]
    public ?Environment $environment = null;
}
