<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Notification;
use MonkeysLegion\Repository\EntityRepository;

class NotificationRepository extends EntityRepository
{
    protected string $table = 'notifications';
    protected string $entityClass = Notification::class;

    public function findByUser(int $userId): array
    {
        return $this->findBy(['user_id' => $userId]);
    }

    public function findUnread(int $userId): array
    {
        return $this->findBy(['user_id' => $userId, 'read_at' => null]);
    }
}
