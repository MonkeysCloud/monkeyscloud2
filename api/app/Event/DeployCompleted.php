<?php
declare(strict_types=1);

namespace App\Event;

final class DeployCompleted
{
    public function __construct(
        public readonly int $deploymentId,
        public readonly int $buildId,
        public readonly int $projectId,
        public readonly int $environmentId,
        public readonly string $status,      // live | failed | rolled_back
        public readonly int $duration,
        public readonly string $strategy,
    ) {
    }

    public function toArray(): array
    {
        return [
            'deployment_id' => $this->deploymentId,
            'build_id' => $this->buildId,
            'project_id' => $this->projectId,
            'environment_id' => $this->environmentId,
            'status' => $this->status,
            'duration' => $this->duration,
            'strategy' => $this->strategy,
        ];
    }
}
