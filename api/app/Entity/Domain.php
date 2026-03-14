<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToOne;

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
    public string $hostname;

    #[Field(type: 'enum', enumValues: ['custom', 'generated'], default: 'custom')]
    public string $type = 'custom';

    #[Field(type: 'enum', enumValues: ['pending', 'provisioning', 'active', 'failed'], default: 'pending')]
    public string $ssl_status = 'pending';

    #[Field(type: 'integer', nullable: true)]
    public ?int $ssl_certificate_id = null;

    #[Field(type: 'string', length: 64, nullable: true)]
    public ?string $dns_verification_token = null;

    #[Field(type: 'boolean', default: false)]
    public bool $dns_verified = false;

    #[Field(type: 'boolean', default: false)]
    public bool $cdn_enabled = false;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $redirect_to = null;

    #[Field(type: 'boolean', default: false)]
    public bool $is_primary = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'domains')]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Environment::class, inversedBy: 'domains')]
    public ?Environment $environment = null;

    #[ManyToOne(targetEntity: SslCertificate::class)]
    public ?SslCertificate $sslCertificate = null;
}
