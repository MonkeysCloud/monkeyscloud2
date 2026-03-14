<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\BoardFieldConfig;
use MonkeysLegion\Repository\EntityRepository;

class BoardFieldConfigRepository extends EntityRepository
{
    protected string $table = 'board_field_configs';
    protected string $entityClass = BoardFieldConfig::class;

    public function findByBoard(int $boardId): array
    {
        return $this->findBy(['board_id' => $boardId], ['position' => 'ASC']);
    }

    public function findByBoardAndKey(int $boardId, string $key): ?BoardFieldConfig
    {
        return $this->findOneBy(['board_id' => $boardId, 'field_key' => $key]);
    }
}
