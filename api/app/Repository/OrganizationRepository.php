<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Organization;
use MonkeysLegion\Repository\EntityRepository;

class OrganizationRepository extends EntityRepository
{
    protected string $table = 'organizations';
    protected string $entityClass = Organization::class;

    public function findBySlug(string $slug): ?Organization
    {
        $pdo = $this->qb->pdo();
        $stmt = $pdo->prepare('SELECT * FROM organizations WHERE slug = :slug LIMIT 1');
        $stmt->execute(['slug' => $slug]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        $org = new Organization();
        $org->id = (int) $row['id'];
        $org->name = $row['name'];
        $org->slug = $row['slug'];
        $org->owner_id = (int) $row['owner_id'];
        $org->created_at = new \DateTimeImmutable($row['created_at']);
        $org->updated_at = new \DateTimeImmutable($row['updated_at']);

        return $org;
    }

    public function findByOwner(int $ownerId): array
    {
        return $this->findBy(['owner_id' => $ownerId]);
    }
}
