<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'ssl_certificates')]
class SslCertificate
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $domain_id;

    #[Field(type: 'enum', enumValues: ['letsencrypt', 'google_managed', 'custom'])]
    public string $provider;

    #[Field(type: 'enum', enumValues: ['pending', 'active', 'expired', 'revoked'], default: 'pending')]
    public string $status = 'pending';

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $issued_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $expires_at = null;

    #[Field(type: 'boolean', default: true)]
    public bool $auto_renew = true;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Domain::class)]
    public ?Domain $domain = null;
}
