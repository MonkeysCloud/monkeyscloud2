<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'build_steps')]
class BuildStep
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $build_id;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'integer')]
    public int $step_order;

    #[Field(type: 'enum', enumValues: ['pending', 'running', 'success', 'failed', 'skipped'], default: 'pending')]
    public string $status = 'pending';

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $command = null;

    #[Field(type: 'mediumText', nullable: true)]
    public ?string $log_output = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $exit_code = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $duration_seconds = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $started_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $finished_at = null;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Build::class, inversedBy: 'steps')]
    public ?Build $build = null;
}
