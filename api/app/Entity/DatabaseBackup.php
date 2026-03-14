<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'database_backups')]
class DatabaseBackup
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $database_instance_id;

    #[Field(type: 'enum', enumValues: ['manual', 'scheduled'])]
    public string $type;

    #[Field(type: 'enum', enumValues: ['running', 'completed', 'failed'], default: 'running')]
    public string $status = 'running';

    #[Field(type: 'bigInt', nullable: true)]
    public ?int $size_bytes = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $storage_path = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $completed_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $expires_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: DatabaseInstance::class, inversedBy: 'backups')]
    public ?DatabaseInstance $databaseInstance = null;
}
