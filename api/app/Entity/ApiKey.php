<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'api_keys')]
class ApiKey implements \JsonSerializable
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'string', length: 255)]
    public string $name;

    #[Field(type: 'string', length: 32)]
    public string $key_id;

    #[Field(type: 'string', length: 255)]
    public string $key_hash;

    #[Field(type: 'json')]
    public array $scopes;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $last_used_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $expires_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;

    public function jsonSerialize(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'key_id' => $this->key_id,
            'scopes' => $this->scopes,
            'last_used_at' => $this->last_used_at?->format('c'),
            'expires_at' => $this->expires_at?->format('c'),
            'created_at' => $this->created_at->format('c'),
        ];
    }
}
