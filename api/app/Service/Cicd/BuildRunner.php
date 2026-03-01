<?php
declare(strict_types=1);

namespace App\Service\Cicd;

use App\Entity\BuildStep;
use App\Entity\Project;

/**
 * Executes individual build steps in isolated Docker containers
 * or directly via shell for simple commands.
 */
final class BuildRunner
{
    private string $buildsPath;
    private string $reposPath;

    public function __construct(
        private LogStreamer $logs,
    ) {
        $this->buildsPath = '/var/lib/cicd/builds';
        $this->reposPath = '/var/lib/git';
    }

    /**
     * Checkout code from a bare repo into a work directory.
     */
    public function checkout(Project $project, string $branch, string $sha, int $buildId): string
    {
        $workDir = $this->buildsPath . '/build-' . $buildId;
        @mkdir($workDir, 0755, true);

        $bareRepo = $this->reposPath . '/' . $project->organization_id . '/' . $project->slug . '.git';

        $this->logs->info($buildId, "Cloning {$bareRepo} → {$workDir}");

        // Clone from bare repo
        $this->exec("git clone --branch {$branch} --single-branch {$bareRepo} {$workDir}", $workDir, $buildId);

        // Checkout specific commit
        if ($sha) {
            $this->exec("git checkout {$sha}", $workDir, $buildId);
        }

        return $workDir;
    }

    /**
     * Execute a build command, capturing output into the step log.
     */
    public function executeCommand(
        ?string $command,
        string $workDir,
        array $envVars,
        int $buildId,
        BuildStep $step,
    ): void {
        if (!$command) {
            $step->log = "No command to execute.\n";
            return;
        }

        $this->logs->info($buildId, "$ {$command}");

        // Build env string
        $envStr = '';
        foreach ($envVars as $k => $v) {
            $envStr .= escapeshellarg($k) . '=' . escapeshellarg($v) . ' ';
        }

        $fullCommand = "cd " . escapeshellarg($workDir) . " && {$envStr}{$command} 2>&1";

        $output = [];
        $exitCode = 0;
        exec($fullCommand, $output, $exitCode);

        $log = implode("\n", $output);
        $step->log = $log;

        // Stream log lines
        foreach ($output as $line) {
            $this->logs->append($buildId, $line);
        }

        if ($exitCode !== 0) {
            throw new \RuntimeException("Command failed: {$command}", $exitCode);
        }
    }

    /**
     * Clean up build workspace.
     */
    public function cleanup(int $buildId): void
    {
        $workDir = $this->buildsPath . '/build-' . $buildId;
        if (is_dir($workDir)) {
            exec("rm -rf " . escapeshellarg($workDir));
        }
    }

    private function exec(string $command, string $workDir, int $buildId): void
    {
        $output = [];
        $exitCode = 0;
        exec("cd " . escapeshellarg($workDir) . " && {$command} 2>&1", $output, $exitCode);

        foreach ($output as $line) {
            $this->logs->append($buildId, $line);
        }

        if ($exitCode !== 0) {
            throw new \RuntimeException("Git command failed: {$command}", $exitCode);
        }
    }
}
