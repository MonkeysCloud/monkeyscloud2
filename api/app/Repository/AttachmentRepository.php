<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Attachment;
use MonkeysLegion\Repository\EntityRepository;

class AttachmentRepository extends EntityRepository
{
    protected string $table = 'attachments';
    protected string $entityClass = Attachment::class;

    /**
     * Find all attachments for a given entity (e.g. project, task).
     */
    public function findByEntity(string $entityType, int $entityId): array
    {
        return $this->findBy(
            ['entity_type' => $entityType, 'entity_id' => $entityId],
            ['sort_order' => 'ASC', 'created_at' => 'ASC']
        );
    }

    /**
     * Find all attachments uploaded by a specific user.
     */
    public function findByUploader(int $userId): array
    {
        return $this->findBy(['uploaded_by' => $userId]);
    }
}
