<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\EnvironmentVariable;
use MonkeysLegion\Repository\EntityRepository;

class EnvironmentVariableRepository extends EntityRepository
{
    protected string $table = 'environment_variables';
    protected string $entityClass = EnvironmentVariable::class;

    public function findByEnvironment(int $envId): array
    {
        return $this->findBy(['environment_id' => $envId]);
    }
}
