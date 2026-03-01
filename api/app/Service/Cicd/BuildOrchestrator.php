<?php
declare(strict_types=1);

namespace App\Service\Cicd;

use App\Entity\Build;
use App\Entity\BuildStep;
use App\Entity\Project;
use App\Repository\BuildRepository;
use App\Repository\BuildStepRepository;
use App\Repository\ProjectRepository;

/**
 * Orchestrates the full build pipeline:
 *   clone → install → test → build → image → push
 */
final class BuildOrchestrator
{
    public function __construct(
        private PipelineParser $parser,
        private BuildRunner $runner,
        private ArtifactManager $artifacts,
        private LogStreamer $logs,
        private BuildRepository $buildRepo,
        private BuildStepRepository $stepRepo,
        private ProjectRepository $projectRepo,
    ) {
    }

    /**
     * Run a full build for a project.
     *
     * @param int    $projectId
     * @param string $branch
     * @param string $commitSha
     * @param string $trigger   push|pr|manual|schedule
     * @param int|null $triggeredBy User ID (null for system triggers)
     */
    public function run(
        int $projectId,
        string $branch,
        string $commitSha,
        string $trigger = 'push',
        ?int $triggeredBy = null,
    ): Build {
        $project = $this->projectRepo->find($projectId);
        $build = $this->createBuild($project, $branch, $commitSha, $trigger, $triggeredBy);

        $this->logs->info($build->id, "Build #{$build->number} started for {$project->name}");
        $this->logs->info($build->id, "Branch: {$branch} | Commit: " . substr($commitSha, 0, 7));

        try {
            // 1. Checkout code
            $workDir = $this->runner->checkout($project, $branch, $commitSha, $build->id);

            // 2. Parse pipeline config from repo
            $config = $this->parser->parse($workDir);
            $steps = $config->toBuildSteps();

            // 3. Create step records
            $stepEntities = [];
            foreach ($steps as $stepDef) {
                $step = $this->createStep($build, $stepDef);
                $stepEntities[] = $step;
            }

            // 4. Execute each step
            foreach ($stepEntities as $step) {
                $this->logs->info($build->id, "── Step: {$step->name} ──");
                $this->executeStep($build, $step, $config, $workDir);

                if ($step->status === 'failed') {
                    $this->failBuild($build, "Step '{$step->name}' failed with exit code {$step->exit_code}");
                    return $build;
                }
            }

            // 5. Success
            $this->passBuild($build);
            return $build;

        } catch (\Throwable $e) {
            $this->failBuild($build, "Unexpected error: {$e->getMessage()}");
            return $build;
        }
    }

    private function executeStep(Build $build, BuildStep $step, PipelineConfig $config, string $workDir): void
    {
        $step->status = 'running';
        $step->started_at = new \DateTimeImmutable();
        // TODO: $this->stepRepo->save($step);

        $startTime = hrtime(true);

        try {
            match ($step->name) {
                'Clone Repository' => $this->logs->info($build->id, "Cloned to {$workDir}"),
                'Build Image' => $this->artifacts->buildImage($build, $config, $workDir),
                'Push to Registry' => $this->artifacts->pushImage($build),
                default => $this->runner->executeCommand(
                    $step->command,
                    $workDir,
                    $config->buildEnv,
                    $build->id,
                    $step,
                ),
            };

            $step->status = 'passed';
            $step->exit_code = 0;
        } catch (\RuntimeException $e) {
            $step->status = 'failed';
            $step->exit_code = (int) $e->getCode() ?: 1;
            $step->log = ($step->log ?? '') . "\nERROR: " . $e->getMessage();
            $this->logs->error($build->id, $e->getMessage());
        }

        $elapsed = (hrtime(true) - $startTime) / 1e9;
        $step->duration = (int) round($elapsed);
        $step->finished_at = new \DateTimeImmutable();
        // TODO: $this->stepRepo->save($step);
    }

    private function createBuild(Project $project, string $branch, string $sha, string $trigger, ?int $triggeredBy): Build
    {
        $build = new Build();
        $build->project_id = $project->id;
        $build->number = $this->buildRepo->nextNumber($project->id);
        $build->commit_sha = $sha;
        $build->branch = $branch;
        $build->status = 'running';
        $build->trigger = $trigger;
        $build->triggered_by = $triggeredBy;
        $build->started_at = new \DateTimeImmutable();
        $build->created_at = new \DateTimeImmutable();
        $build->updated_at = new \DateTimeImmutable();
        // TODO: $this->buildRepo->save($build);

        return $build;
    }

    private function createStep(Build $build, array $def): BuildStep
    {
        $step = new BuildStep();
        $step->build_id = $build->id;
        $step->name = $def['name'];
        $step->sort_order = $def['sort_order'];
        $step->command = $def['command'];
        $step->status = 'queued';
        $step->created_at = new \DateTimeImmutable();
        $step->updated_at = new \DateTimeImmutable();
        // TODO: $this->stepRepo->save($step);

        return $step;
    }

    private function passBuild(Build $build): void
    {
        $build->status = 'passed';
        $build->finished_at = new \DateTimeImmutable();
        $build->duration = (new \DateTimeImmutable())->getTimestamp() - $build->started_at->getTimestamp();
        $build->updated_at = new \DateTimeImmutable();
        // TODO: $this->buildRepo->save($build);

        $this->logs->info($build->id, "✅ Build #{$build->number} passed in {$build->duration}s");
    }

    private function failBuild(Build $build, string $reason): void
    {
        $build->status = 'failed';
        $build->finished_at = new \DateTimeImmutable();
        $build->duration = (new \DateTimeImmutable())->getTimestamp() - $build->started_at->getTimestamp();
        $build->updated_at = new \DateTimeImmutable();
        // TODO: $this->buildRepo->save($build);

        $this->logs->error($build->id, "❌ Build #{$build->number} failed: {$reason}");
    }
}
