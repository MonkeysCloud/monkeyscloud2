<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Subscription;
use MonkeysLegion\Repository\EntityRepository;

class SubscriptionRepository extends EntityRepository
{
    protected string $table = 'subscriptions';
    protected string $entityClass = Subscription::class;

    public function findByOrganization(int $orgId): ?Subscription
    {
        return $this->findOneBy(['organization_id' => $orgId]);
    }

    public function findActive(int $orgId): ?Subscription
    {
        return $this->findOneBy(['organization_id' => $orgId, 'status' => 'active']);
    }
}
