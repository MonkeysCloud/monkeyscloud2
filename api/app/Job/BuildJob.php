<?php
declare(strict_types=1);

namespace App\Job;

use App\Service\Cicd\BuildOrchestrator;
use App\Service\Cicd\DeployOrchestrator;
use App\Service\Cicd\PipelineParser;
use App\Repository\EnvironmentRepository;

/**
 * Queue job dispatched on git push / manual trigger.
 * Consumed by the cicd-worker via `php ml queue:work --queue=builds`.
 */
final class BuildJob
{
    public function __construct(
        private BuildOrchestrator $orchestrator,
        private DeployOrchestrator $deployer,
        private PipelineParser $parser,
        private EnvironmentRepository $envRepo,
    ) {
    }

    /**
     * @param array $payload {projectId, branch, commitSha, trigger, triggeredBy}
     */
    public function handle(array $payload): void
    {
        $build = $this->orchestrator->run(
            projectId: $payload['projectId'],
            branch: $payload['branch'],
            commitSha: $payload['commitSha'],
            trigger: $payload['trigger'] ?? 'push',
            triggeredBy: $payload['triggeredBy'] ?? null,
        );

        // Auto-deploy on success if config allows
        if ($build->status === 'passed') {
            $env = $this->envRepo->findByProjectAndBranch(
                $payload['projectId'],
                $payload['branch']
            );

            if ($env && $env->auto_deploy) {
                // Parse config for deploy strategy
                $workDir = '/var/lib/cicd/builds/build-' . $build->id;
                $config = file_exists($workDir) ? $this->parser->parse($workDir) : null;

                $this->deployer->deploy(
                    build: $build,
                    env: $env,
                    strategy: $config?->deployStrategy ?? 'rolling',
                    deployedBy: $payload['triggeredBy'] ?? null,
                    config: $config,
                );
            }
        }
    }
}
