<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Domain;
use MonkeysLegion\Repository\EntityRepository;

class DomainRepository extends EntityRepository
{
    protected string $table = 'domains';
    protected string $entityClass = Domain::class;

    public function findByProject(int $projectId): array
    {
        return $this->findBy(['project_id' => $projectId]);
    }

    public function findByDomain(string $domain): ?Domain
    {
        return $this->findOneBy(['domain' => $domain]);
    }
}
