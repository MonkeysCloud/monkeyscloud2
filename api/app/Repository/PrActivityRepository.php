<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\PrActivity;
use MonkeysLegion\Repository\EntityRepository;

class PrActivityRepository extends EntityRepository
{
    protected string $table = 'pr_activities';
    protected string $entityClass = PrActivity::class;

    public function findByPullRequest(int $prId): array
    {
        return $this->findBy(['pull_request_id' => $prId], ['created_at' => 'ASC']);
    }
}
