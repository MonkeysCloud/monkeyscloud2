<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

/**
 * Polymorphic attachment — reusable across projects, tasks, messages, etc.
 */
#[Entity(table: 'attachments')]
class Attachment
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    /** e.g. 'project', 'task', 'message', 'organization' */
    #[Field(type: 'string', length: 50)]
    public string $entity_type;

    #[Field(type: 'integer')]
    public int $entity_id;

    #[Field(type: 'integer')]
    public int $uploaded_by;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $uploader = null;

    #[Field(type: 'string', length: 255)]
    public string $file_name;

    #[Field(type: 'text')]
    public string $file_path;

    #[Field(type: 'text')]
    public string $file_url;

    #[Field(type: 'bigInt')]
    public int $file_size;

    #[Field(type: 'string', length: 100)]
    public string $mime_type;

    #[Field(type: 'integer', default: 0)]
    public int $sort_order = 0;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    // ── Helpers ──

    public function isImage(): bool
    {
        return str_starts_with($this->mime_type, 'image/');
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'entity_type' => $this->entity_type,
            'entity_id' => $this->entity_id,
            'uploaded_by' => $this->uploaded_by,
            'file_name' => $this->file_name,
            'file_url' => $this->file_url,
            'file_size' => $this->file_size,
            'mime_type' => $this->mime_type,
            'sort_order' => $this->sort_order,
            'created_at' => $this->created_at instanceof \DateTimeInterface
                ? $this->created_at->format('c')
                : (string) $this->created_at,
        ];
    }
}
