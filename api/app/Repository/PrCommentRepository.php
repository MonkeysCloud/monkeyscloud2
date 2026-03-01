<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\PrComment;
use MonkeysLegion\Repository\EntityRepository;

class PrCommentRepository extends EntityRepository
{
    protected string $table = 'pr_comments';
    protected string $entityClass = PrComment::class;

    public function findByPullRequest(int $prId): array
    {
        return $this->findBy(['pull_request_id' => $prId]);
    }
}
