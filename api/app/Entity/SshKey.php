<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'ssh_keys')]
class SshKey
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'string', length: 255)]
    public string $name;

    #[Field(type: 'text')]
    public string $public_key;

    #[Field(type: 'string', length: 64)]
    public string $fingerprint;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $last_used_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
