<?php
declare(strict_types=1);

namespace App\Event;

final class BuildCompleted
{
    public function __construct(
        public readonly int $buildId,
        public readonly int $projectId,
        public readonly string $status,      // passed | failed | cancelled
        public readonly int $duration,
        public readonly string $branch,
        public readonly string $commitSha,
    ) {
    }

    public function toArray(): array
    {
        return [
            'build_id' => $this->buildId,
            'project_id' => $this->projectId,
            'status' => $this->status,
            'duration' => $this->duration,
            'branch' => $this->branch,
            'commit_sha' => $this->commitSha,
        ];
    }
}
