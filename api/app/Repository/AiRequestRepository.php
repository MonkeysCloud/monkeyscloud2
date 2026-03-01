<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\AiRequest;
use MonkeysLegion\Repository\EntityRepository;

class AiRequestRepository extends EntityRepository
{
    protected string $table = 'ai_requests';
    protected string $entityClass = AiRequest::class;

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId]);
    }
}
