<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Plan;
use MonkeysLegion\Repository\EntityRepository;

class PlanRepository extends EntityRepository
{
    protected string $table = 'plans';
    protected string $entityClass = Plan::class;

    public function findBySlug(string $slug): ?Plan
    {
        return $this->findOneBy(['slug' => $slug]);
    }
}
