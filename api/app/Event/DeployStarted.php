<?php
declare(strict_types=1);

namespace App\Event;

final class DeployStarted
{
    public function __construct(
        public readonly int $deploymentId,
        public readonly int $buildId,
        public readonly int $projectId,
        public readonly int $environmentId,
        public readonly string $strategy,
        public readonly ?int $deployedBy,
    ) {
    }

    public function toArray(): array
    {
        return [
            'deployment_id' => $this->deploymentId,
            'build_id' => $this->buildId,
            'project_id' => $this->projectId,
            'environment_id' => $this->environmentId,
            'strategy' => $this->strategy,
            'deployed_by' => $this->deployedBy,
        ];
    }
}
