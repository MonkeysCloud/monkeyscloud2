<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Project;
use MonkeysLegion\Repository\EntityRepository;

class ProjectRepository extends EntityRepository
{
    protected string $table = 'projects';
    protected string $entityClass = Project::class;

    public function findByOrganization(int $orgId): array
    {
        return $this->findBy(['organization_id' => $orgId, 'deleted_at' => null]);
    }

    public function findBySlug(int $orgId, string $slug): ?Project
    {
        return $this->findOneBy(['organization_id' => $orgId, 'slug' => $slug]);
    }
}
