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

    /**
     * Fetch all organizations for a user with their role, in a single JOIN query.
     * Avoids N+1 ORM queries that hit information_schema.
     *
     * @return array<int, array{id: int, name: string, slug: string, owner_id: int, avatar_url: ?string, created_at: string, role: string}>
     */
    public function findWithRoleByUser(int $userId): array
    {
        $pdo = $this->qb->pdo();
        $stmt = $pdo->prepare('
            SELECT o.id, o.name, o.slug, o.owner_id, o.avatar_url, o.created_at,
                   m.role
              FROM organizations o
              JOIN organization_members m ON m.organization_id = o.id
             WHERE m.user_id = :uid
             ORDER BY o.name
        ');
        $stmt->execute(['uid' => $userId]);
        return $stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    /**
     * Get just the slug for an organization by ID, raw SQL (no ORM overhead).
     */
    public function findSlugById(int $orgId): ?string
    {
        $pdo = $this->qb->pdo();
        $stmt = $pdo->prepare('SELECT slug FROM organizations WHERE id = :id LIMIT 1');
        $stmt->execute(['id' => $orgId]);
        $row = $stmt->fetch(\PDO::FETCH_ASSOC);
        return $row ? $row['slug'] : null;
    }
}
