<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\PrReview;
use MonkeysLegion\Repository\EntityRepository;

class PrReviewRepository extends EntityRepository
{
    protected string $table = 'pr_reviews';
    protected string $entityClass = PrReview::class;

    public function findByPullRequest(int $prId): array
    {
        return $this->findBy(['pull_request_id' => $prId]);
    }
}
