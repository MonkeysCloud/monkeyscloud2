<?php
declare(strict_types=1);

namespace App\Job;

use App\Service\Cicd\DeployOrchestrator;
use App\Service\Cicd\PipelineParser;
use App\Repository\BuildRepository;
use App\Repository\EnvironmentRepository;

/**
 * Queue job for manual deployments or deploy retries.
 * Consumed via `php ml queue:work --queue=deploys`.
 */
final class DeployJob
{
    public function __construct(
        private DeployOrchestrator $deployer,
        private PipelineParser $parser,
        private BuildRepository $buildRepo,
        private EnvironmentRepository $envRepo,
    ) {
    }

    /**
     * @param array $payload {buildId, environmentId, strategy, deployedBy}
     */
    public function handle(array $payload): void
    {
        $build = $this->buildRepo->find($payload['buildId']);
        $env = $this->envRepo->find($payload['environmentId']);

        if (!$build || !$env) {
            throw new \RuntimeException('Build or environment not found');
        }

        $strategy = $payload['strategy'] ?? 'rolling';

        // Load pipeline config if available
        $workDir = '/var/lib/cicd/builds/build-' . $build->id;
        $config = file_exists($workDir) ? $this->parser->parse($workDir) : null;

        $this->deployer->deploy(
            build: $build,
            env: $env,
            strategy: $strategy,
            deployedBy: $payload['deployedBy'] ?? null,
            config: $config,
        );
    }
}
