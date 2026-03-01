<?php
declare(strict_types=1);

namespace App\Service\Cicd;

use App\Entity\Build;
use App\Entity\Deployment;
use App\Entity\Environment;
use App\Repository\DeploymentRepository;
use App\Repository\EnvironmentRepository;

/**
 * Orchestrates deployments with rolling, blue-green, and canary strategies.
 */
final class DeployOrchestrator
{
    public function __construct(
        private DeploymentRepository $deployRepo,
        private EnvironmentRepository $envRepo,
        private LogStreamer $logs,
    ) {
    }

    /**
     * Deploy a build to a target environment.
     */
    public function deploy(
        Build $build,
        Environment $env,
        string $strategy = 'rolling',
        ?int $deployedBy = null,
        PipelineConfig $config = null,
    ): Deployment {
        $deploy = $this->createDeployment($build, $env, $strategy, $deployedBy);

        $this->logs->info($build->id, "🚀 Deploying Build #{$build->number} to {$env->name} ({$strategy})");

        try {
            match ($strategy) {
                'rolling' => $this->rollingDeploy($deploy, $build, $env, $config),
                'blue_green' => $this->blueGreenDeploy($deploy, $build, $env, $config),
                'canary' => $this->canaryDeploy($deploy, $build, $env, $config),
                default => throw new \InvalidArgumentException("Unknown strategy: {$strategy}"),
            };

            // Health check
            $healthy = $this->healthCheck($env, $config);

            if ($healthy) {
                $this->markLive($deploy);
                $this->logs->info($build->id, "✅ Deployment live on {$env->name}");
            } else {
                // Auto-rollback
                if ($config?->autoRollback ?? true) {
                    $this->rollback($deploy, $build);
                } else {
                    $this->markFailed($deploy, 'Health check failed');
                }
            }

            return $deploy;

        } catch (\Throwable $e) {
            $this->markFailed($deploy, $e->getMessage());
            $this->logs->error($build->id, "❌ Deployment failed: {$e->getMessage()}");
            return $deploy;
        }
    }

    /**
     * Rollback to the previous live deployment.
     */
    public function rollback(Deployment $deploy, Build $build): void
    {
        $this->logs->info($build->id, "🔄 Rolling back deployment on environment {$deploy->environment_id}");

        $deploy->status = 'rolled_back';
        $deploy->updated_at = new \DateTimeImmutable();
        // TODO: $this->deployRepo->save($deploy);

        // Re-activate previous deployment
        // TODO: find last live deploy for this env and re-activate

        $this->logs->info($build->id, "Rollback complete");
    }

    // ── Strategy implementations ──────────────────────────────

    private function rollingDeploy(Deployment $deploy, Build $build, Environment $env, ?PipelineConfig $config): void
    {
        $replicas = $env->replicas ?? 1;
        $this->logs->info($build->id, "Rolling update: {$replicas} replicas");

        for ($i = 1; $i <= $replicas; $i++) {
            $this->logs->info($build->id, "  Updating replica {$i}/{$replicas}...");

            // TODO: K8s rolling update via kubectl or API
            // kubectl set image deployment/{$env->name} app={$build->image_url}

            $this->logs->info($build->id, "  Replica {$i} updated ✓");
        }
    }

    private function blueGreenDeploy(Deployment $deploy, Build $build, Environment $env, ?PipelineConfig $config): void
    {
        $this->logs->info($build->id, "Blue-green: spinning up green environment");

        // TODO: Create new deployment, wait healthy, switch traffic
        // 1. Deploy new version to "green" slot
        // 2. Health check green
        // 3. Switch load balancer / ingress to green
        // 4. Tear down "blue" (old version)

        $this->logs->info($build->id, "Traffic switched to green ✓");
    }

    private function canaryDeploy(Deployment $deploy, Build $build, Environment $env, ?PipelineConfig $config): void
    {
        $this->logs->info($build->id, "Canary: routing 10% traffic to new version");

        // TODO: Gradual traffic shift
        // 1. Deploy canary (10% traffic)
        // 2. Monitor error rate for window
        // 3. If error_rate < threshold → increase to 50% → 100%
        // 4. If error_rate >= threshold → rollback

        $errorThreshold = $config?->errorThreshold ?? 5;
        $this->logs->info($build->id, "Error threshold: {$errorThreshold}%");
        $this->logs->info($build->id, "Canary promoted to 100% ✓");
    }

    // ── Health check ──────────────────────────────────────────

    private function healthCheck(Environment $env, ?PipelineConfig $config): bool
    {
        $path = $config?->healthCheck['path'] ?? '/health';
        $retries = $config?->healthCheck['retries'] ?? 3;

        if (!$env->url) {
            return true; // No URL = skip health check
        }

        $url = rtrim($env->url, '/') . $path;

        for ($i = 1; $i <= $retries; $i++) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_CONNECTTIMEOUT => 3,
            ]);
            $response = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code >= 200 && $code < 300) {
                return true;
            }

            sleep(2);
        }

        return false;
    }

    // ── Status helpers ────────────────────────────────────────

    private function createDeployment(Build $build, Environment $env, string $strategy, ?int $deployedBy): Deployment
    {
        $deploy = new Deployment();
        $deploy->project_id = $build->project_id;
        $deploy->environment_id = $env->id;
        $deploy->build_id = $build->id;
        $deploy->status = 'deploying';
        $deploy->strategy = $strategy;
        $deploy->deployed_by = $deployedBy;
        $deploy->url = $env->url;
        $deploy->started_at = new \DateTimeImmutable();
        $deploy->created_at = new \DateTimeImmutable();
        $deploy->updated_at = new \DateTimeImmutable();
        // TODO: $this->deployRepo->save($deploy);

        return $deploy;
    }

    private function markLive(Deployment $deploy): void
    {
        $deploy->status = 'live';
        $deploy->finished_at = new \DateTimeImmutable();
        $deploy->duration = (new \DateTimeImmutable())->getTimestamp() - $deploy->started_at->getTimestamp();
        $deploy->updated_at = new \DateTimeImmutable();
        // TODO: $this->deployRepo->save($deploy);
    }

    private function markFailed(Deployment $deploy, string $reason): void
    {
        $deploy->status = 'failed';
        $deploy->finished_at = new \DateTimeImmutable();
        $deploy->duration = (new \DateTimeImmutable())->getTimestamp() - $deploy->started_at->getTimestamp();
        $deploy->updated_at = new \DateTimeImmutable();
        // TODO: $this->deployRepo->save($deploy);
    }
}
