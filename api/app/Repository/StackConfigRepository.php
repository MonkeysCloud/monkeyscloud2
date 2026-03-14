<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\StackConfig;
use MonkeysLegion\Repository\EntityRepository;

class StackConfigRepository extends EntityRepository
{
    protected string $table = 'stack_configs';
    protected string $entityClass = StackConfig::class;

    public function findByName(string $name): ?StackConfig
    {
        $results = $this->findBy(['name' => $name]);
        return $results[0] ?? null;
    }

    public function findEnabled(): array
    {
        return $this->findBy(['enabled' => true]);
    }

    public function all(): array
    {
        return $this->findBy([]);
    }
}
