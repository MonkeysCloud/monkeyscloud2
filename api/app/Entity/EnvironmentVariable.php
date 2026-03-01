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
    public int $environment_id;

    #[Field(type: 'string', length: 255)]
    public string $key;

    #[Field(type: 'text')]
    public string $value_encrypted;

    #[Field(type: 'boolean', default: false)]
    public bool $is_secret = false;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Environment::class, inversedBy: 'variables')]
    public ?Environment $environment = null;
}
