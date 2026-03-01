<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'domains')]
class Domain
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'integer')]
    public int $environment_id;

    #[Field(type: 'string', length: 255)]
    public string $domain;

    #[Field(type: 'enum', enumValues: ['pending', 'active', 'error'], default: 'pending')]
    public string $ssl_status = 'pending';

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $ssl_expires_at = null;

    #[Field(type: 'boolean', default: false)]
    public bool $is_primary = false;

    #[Field(type: 'json', nullable: true, comment: 'DNS records to configure')]
    public ?array $dns_records = null;

    #[Field(type: 'boolean', default: false)]
    public bool $dns_verified = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Project::class)]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class)]
    public ?Environment $environment = null;
}
