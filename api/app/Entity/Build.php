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

    #[Field(type: 'string', length: 100)]
    public string $branch;

    #[Field(type: 'enum', enumValues: ['queued', 'running', 'passed', 'failed', 'cancelled'], default: 'queued')]
    public string $status = 'queued';

    #[Field(type: 'integer', nullable: true)]
    public ?int $triggered_by = null;

    #[Field(type: 'enum', enumValues: ['push', 'manual', 'pr', 'schedule', 'rollback'], default: 'push')]
    public string $trigger = 'push';

    #[Field(type: 'longText', nullable: true)]
    public ?string $log = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $image_url = null;

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $image_tag = null;

    #[Field(type: 'integer', nullable: true, comment: 'Duration in seconds')]
    public ?int $duration_seconds = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $started_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $finished_at = null;

    #[Field(type: 'text', nullable: true)]
    public ?string $ai_analysis = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'builds')]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class)]
    public ?Environment $environment = null;

    #[OneToMany(targetEntity: BuildStep::class, mappedBy: 'build_id')]
    public array $steps = [];
}
