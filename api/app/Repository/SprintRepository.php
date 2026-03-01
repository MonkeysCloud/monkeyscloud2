<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\Sprint;
use MonkeysLegion\Repository\EntityRepository;

class SprintRepository extends EntityRepository
{
    protected string $table = 'sprints';
    protected string $entityClass = Sprint::class;

    public function findByBoard(int $boardId): array
    {
        return $this->findBy(['board_id' => $boardId]);
    }

    public function findActive(int $boardId): ?Sprint
    {
        return $this->findOneBy(['board_id' => $boardId, 'status' => 'active']);
    }
}
