<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;

#[Entity(table: 'stack_configs')]
class StackConfig
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'string', length: 50, unique: true)]
    public string $name;

    #[Field(type: 'string', length: 100)]
    public string $display_name;

    #[Field(type: 'string', length: 50)]
    public string $category;

    #[Field(type: 'string', length: 255)]
    public string $docker_image;

    #[Field(type: 'text')]
    public string $scaffold_command;

    #[Field(type: 'text')]
    public string $gitignore_template;

    #[Field(type: 'json', nullable: true)]
    public ?array $post_scaffold_commands = null;

    #[Field(type: 'boolean', default: true)]
    public bool $enabled = true;

    #[Field(type: 'datetime', default: 'CURRENT_TIMESTAMP')]
    public \DateTimeImmutable|string|null $created_at = null;

    #[Field(type: 'datetime', default: 'CURRENT_TIMESTAMP')]
    public \DateTimeImmutable|string|null $updated_at = null;

    public function __set(string $name, mixed $value): void
    {
        if (in_array($name, ['created_at', 'updated_at']) && is_string($value)) {
            $value = new \DateTimeImmutable($value);
        }
        if ($name === 'enabled' && is_int($value)) {
            $value = (bool) $value;
        }
        $this->$name = $value;
    }
}
