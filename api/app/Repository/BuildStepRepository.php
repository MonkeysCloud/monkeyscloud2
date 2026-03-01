<?php
declare(strict_types=1);

namespace App\Repository;

use App\Entity\BuildStep;
use MonkeysLegion\Repository\EntityRepository;

class BuildStepRepository extends EntityRepository
{
    protected string $table = 'build_steps';
    protected string $entityClass = BuildStep::class;

    public function findByBuild(int $buildId): array
    {
        return $this->findBy(['build_id' => $buildId]);
    }
}
