<?php
declare(strict_types=1);

namespace App\Service\Cicd;

/**
 * Value object representing a parsed .monkeyscloud.yml pipeline config
 * merged with auto-detected defaults.
 */
final class PipelineConfig
{
    public function __construct(
        public readonly string $stack,
        public readonly array $runtime,          // ['php' => '8.4', 'node' => '22']
        public readonly ?string $installCommand,
        public readonly ?string $buildCommand,
        public readonly ?string $testCommand,
        public readonly array $customSteps,      // [{name, command}]
        public readonly array $buildEnv,         // key => value
        public readonly array $cacheDirs,        // ['vendor/', 'node_modules/']
        public readonly string $deployStrategy,   // rolling | blue_green | canary
        public readonly bool $autoDeploy,
        public readonly array $environments,     // [{name, branch, replicas, envVars, requireApproval}]
        public readonly array $healthCheck,      // {path, interval, timeout, retries}
        public readonly bool $autoRollback,
        public readonly int $errorThreshold,
        public readonly array $ai,               // {code_review, pr_summary, deploy_risk, build_analysis}
        public readonly array $notifications,    // {slack, email, webhook}
    ) {
    }

    /**
     * Create a default config from auto-detected stack values.
     */
    public static function fromDefaults(array $detected): self
    {
        return new self(
            stack: $detected['stack'],
            runtime: $detected['runtime'],
            installCommand: $detected['commands']['install'] ?? null,
            buildCommand: $detected['commands']['build'] ?? null,
            testCommand: $detected['commands']['test'] ?? null,
            customSteps: [],
            buildEnv: [],
            cacheDirs: self::defaultCache($detected['stack']),
            deployStrategy: 'rolling',
            autoDeploy: true,
            environments: [],
            healthCheck: ['path' => '/health', 'interval' => '10s', 'timeout' => '5s', 'retries' => 3],
            autoRollback: true,
            errorThreshold: 5,
            ai: ['code_review' => false, 'pr_summary' => false, 'deploy_risk' => false, 'build_analysis' => false],
            notifications: [],
        );
    }

    /**
     * Merge user YAML overrides on top of auto-detected defaults.
     */
    public function mergeWith(array $yaml): self
    {
        $build = $yaml['build'] ?? [];
        $deploy = $yaml['deploy'] ?? [];
        $ai = $yaml['ai'] ?? [];

        return new self(
            stack: $yaml['stack'] ?? $this->stack,
            runtime: array_merge($this->runtime, array_filter([
                'php' => $build['php_version'] ?? null,
                'node' => $build['node_version'] ?? null,
                'python' => $build['python_version'] ?? null,
            ])),
            installCommand: $build['install'] ?? $this->installCommand,
            buildCommand: $build['build'] ?? $this->buildCommand,
            testCommand: $build['test'] ?? $this->testCommand,
            customSteps: $build['custom_steps'] ?? $this->customSteps,
            buildEnv: array_merge($this->buildEnv, $build['build_env'] ?? []),
            cacheDirs: $build['cache'] ?? $this->cacheDirs,
            deployStrategy: $deploy['strategy'] ?? $this->deployStrategy,
            autoDeploy: $deploy['auto_deploy'] ?? $this->autoDeploy,
            environments: $this->parseEnvironments($deploy['environments'] ?? []),
            healthCheck: array_merge($this->healthCheck, $deploy['health_check'] ?? []),
            autoRollback: $deploy['rollback']['auto_rollback'] ?? $this->autoRollback,
            errorThreshold: $deploy['rollback']['error_threshold'] ?? $this->errorThreshold,
            ai: array_merge($this->ai, $ai),
            notifications: $yaml['notifications'] ?? $this->notifications,
        );
    }

    private function parseEnvironments(array $envs): array
    {
        $parsed = [];
        foreach ($envs as $name => $cfg) {
            $parsed[] = [
                'name' => $name,
                'branch' => $cfg['branch'] ?? 'main',
                'replicas' => $cfg['replicas'] ?? 1,
                'env_vars' => $cfg['env_vars'] ?? [],
                'require_approval' => $cfg['require_approval'] ?? false,
            ];
        }
        return $parsed;
    }

    private static function defaultCache(string $stack): array
    {
        return match ($stack) {
            'monkeyslegion', 'laravel', 'drupal' => ['vendor/'],
            'nextjs' => ['node_modules/', '.next/cache/'],
            'nuxtjs' => ['node_modules/', '.nuxt/'],
            'react', 'vue' => ['node_modules/'],
            'django', 'flask', 'fastapi' => ['.venv/'],
            'go' => ['/go/pkg/mod/'],
            'rust' => ['target/'],
            'rails' => ['vendor/bundle/'],
            default => [],
        };
    }

    public function toBuildSteps(): array
    {
        $steps = [];
        $order = 0;

        $steps[] = ['name' => 'Clone Repository', 'command' => null, 'sort_order' => $order++];

        if ($this->installCommand) {
            $steps[] = ['name' => 'Install Dependencies', 'command' => $this->installCommand, 'sort_order' => $order++];
        }
        if ($this->testCommand) {
            $steps[] = ['name' => 'Run Tests', 'command' => $this->testCommand, 'sort_order' => $order++];
        }
        if ($this->buildCommand) {
            $steps[] = ['name' => 'Build', 'command' => $this->buildCommand, 'sort_order' => $order++];
        }
        foreach ($this->customSteps as $step) {
            $steps[] = ['name' => $step['name'], 'command' => $step['command'], 'sort_order' => $order++];
        }

        $steps[] = ['name' => 'Build Image', 'command' => null, 'sort_order' => $order++];
        $steps[] = ['name' => 'Push to Registry', 'command' => null, 'sort_order' => $order++];

        return $steps;
    }
}
