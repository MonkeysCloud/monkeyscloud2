<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Webhook;
use MonkeysLegion\Repository\EntityRepository;

class WebhookRepository extends EntityRepository
{
    protected string $table = 'webhooks';
    protected string $entityClass = Webhook::class;

    public function findByProject(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId]);
    }

    public function findActive(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId, 'active' => true]);
    }
}
