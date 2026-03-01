<?php
declare(strict_types=1);

namespace App\Event;

final class BuildStarted
{
    public function __construct(
        public readonly int $buildId,
        public readonly int $projectId,
        public readonly string $branch,
        public readonly string $commitSha,
        public readonly string $trigger,
        public readonly ?int $triggeredBy,
    ) {
    }

    public function toArray(): array
    {
        return [
            'build_id' => $this->buildId,
            'project_id' => $this->projectId,
            'branch' => $this->branch,
            'commit_sha' => $this->commitSha,
            'trigger' => $this->trigger,
            'triggered_by' => $this->triggeredBy,
        ];
    }
}
