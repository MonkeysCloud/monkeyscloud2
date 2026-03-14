<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'board_field_configs')]
class BoardFieldConfig
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $board_id;

    #[Field(type: 'string', length: 50)]
    public string $field_key;

    #[Field(type: 'string', length: 100)]
    public string $field_label;

    #[Field(type: 'enum', enumValues: ['text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email'], default: 'text')]
    public string $field_type = 'text';

    #[Field(type: 'boolean', default: true)]
    public bool $enabled = true;

    #[Field(type: 'boolean', default: false)]
    public bool $required = false;

    #[Field(type: 'boolean', default: false)]
    public bool $is_system = false;

    #[Field(type: 'integer', default: 0)]
    public int $position = 0;

    #[Field(type: 'json', nullable: true)]
    public ?array $options = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Board::class)]
    public ?Board $board = null;
}
