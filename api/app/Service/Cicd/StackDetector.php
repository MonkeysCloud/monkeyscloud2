<?php
declare(strict_types=1);

namespace App\Service\Cicd;

/**
 * Auto-detect project stack from repo files.
 */
final class StackDetector
{
    /**
     * Detect stack from file listing in a repository root.
     *
     * @param string $repoPath Absolute path to the checked-out repo
     * @return array{stack: string, runtime: array<string, string>, commands: array<string, string>}
     */
    public function detect(string $repoPath): array
    {
        // ── PHP stacks ──────────────────────────────────────────
        if ($this->has($repoPath, 'composer.json')) {
            $composer = $this->readJson($repoPath, 'composer.json');
            $require = $composer['require'] ?? [];

            if (isset($require['monkeyscloud/monkeyslegion'])) {
                return $this->stack('monkeyslegion', ['php' => $this->phpVersion($composer)], [
                    'install' => 'composer install --no-dev --optimize-autoloader',
                    'test' => 'vendor/bin/phpunit',
                ]);
            }
            if (isset($require['laravel/framework'])) {
                return $this->stack('laravel', ['php' => $this->phpVersion($composer)], [
                    'install' => 'composer install --no-dev --optimize-autoloader',
                    'build' => 'npm ci && npm run build',
                    'test' => 'php artisan test',
                ]);
            }
            if (isset($require['drupal/core'])) {
                return $this->stack('drupal', ['php' => $this->phpVersion($composer)], [
                    'install' => 'composer install --no-dev --optimize-autoloader',
                ]);
            }
            // WordPress detected by wp-config.php
        }

        if ($this->has($repoPath, 'wp-config.php') || $this->has($repoPath, 'wp-content')) {
            return $this->stack('wordpress', ['php' => '8.3'], []);
        }

        // ── JavaScript / Node stacks ────────────────────────────
        if ($this->has($repoPath, 'package.json')) {
            $pkg = $this->readJson($repoPath, 'package.json');
            $deps = array_merge($pkg['dependencies'] ?? [], $pkg['devDependencies'] ?? []);
            $node = $this->nodeVersion($repoPath);

            if (isset($deps['next'])) {
                return $this->stack('nextjs', ['node' => $node], [
                    'install' => 'npm ci',
                    'build' => 'npm run build',
                    'test' => 'npm test',
                ]);
            }
            if (isset($deps['nuxt'])) {
                return $this->stack('nuxtjs', ['node' => $node], [
                    'install' => 'npm ci',
                    'build' => 'npm run build',
                ]);
            }
            if (isset($deps['vue'])) {
                return $this->stack('vue', ['node' => $node], [
                    'install' => 'npm ci',
                    'build' => 'npm run build',
                ]);
            }
            if (isset($deps['react']) || isset($deps['react-dom'])) {
                return $this->stack('react', ['node' => $node], [
                    'install' => 'npm ci',
                    'build' => 'npm run build',
                ]);
            }
        }

        // ── Python stacks ───────────────────────────────────────
        if ($this->has($repoPath, 'requirements.txt') || $this->has($repoPath, 'pyproject.toml')) {
            $py = $this->pythonVersion($repoPath);
            if ($this->has($repoPath, 'manage.py')) {
                return $this->stack('django', ['python' => $py], [
                    'install' => 'pip install -r requirements.txt',
                    'test' => 'python manage.py test',
                ]);
            }
            if ($this->fileContains($repoPath, 'requirements.txt', 'fastapi')) {
                return $this->stack('fastapi', ['python' => $py], [
                    'install' => 'pip install -r requirements.txt',
                    'test' => 'pytest',
                ]);
            }
            if ($this->fileContains($repoPath, 'requirements.txt', 'flask')) {
                return $this->stack('flask', ['python' => $py], [
                    'install' => 'pip install -r requirements.txt',
                    'test' => 'pytest',
                ]);
            }
        }

        // ── Go ──────────────────────────────────────────────────
        if ($this->has($repoPath, 'go.mod')) {
            return $this->stack('go', ['go' => $this->goVersion($repoPath)], [
                'install' => 'go mod download',
                'build' => 'go build -o /app/main ./cmd/...',
                'test' => 'go test ./...',
            ]);
        }

        // ── Rust ────────────────────────────────────────────────
        if ($this->has($repoPath, 'Cargo.toml')) {
            return $this->stack('rust', ['rust' => 'stable'], [
                'build' => 'cargo build --release',
                'test' => 'cargo test',
            ]);
        }

        // ── Ruby / Rails ────────────────────────────────────────
        if ($this->has($repoPath, 'Gemfile')) {
            if ($this->fileContains($repoPath, 'Gemfile', 'rails')) {
                return $this->stack('rails', ['ruby' => '3.3'], [
                    'install' => 'bundle install --without development test',
                    'test' => 'bundle exec rails test',
                ]);
            }
        }

        // ── Docker (explicit) ───────────────────────────────────
        if ($this->has($repoPath, 'Dockerfile')) {
            return $this->stack('docker', [], []);
        }

        // ── Static ──────────────────────────────────────────────
        if ($this->has($repoPath, 'index.html')) {
            return $this->stack('static', [], []);
        }

        // Fallback
        return $this->stack('docker', [], []);
    }

    // ── Helpers ─────────────────────────────────────────────────

    private function stack(string $name, array $runtime, array $commands): array
    {
        return ['stack' => $name, 'runtime' => $runtime, 'commands' => $commands];
    }

    private function has(string $root, string $file): bool
    {
        return file_exists($root . '/' . $file);
    }

    private function readJson(string $root, string $file): array
    {
        $path = $root . '/' . $file;
        if (!file_exists($path))
            return [];
        return json_decode(file_get_contents($path), true) ?: [];
    }

    private function fileContains(string $root, string $file, string $needle): bool
    {
        $path = $root . '/' . $file;
        if (!file_exists($path))
            return false;
        return str_contains(file_get_contents($path), $needle);
    }

    private function phpVersion(array $composer): string
    {
        return ltrim($composer['require']['php'] ?? '8.4', '^~>= ');
    }

    private function nodeVersion(string $root): string
    {
        if (file_exists($root . '/.nvmrc')) {
            return trim(file_get_contents($root . '/.nvmrc'));
        }
        return '22';
    }

    private function pythonVersion(string $root): string
    {
        if (file_exists($root . '/.python-version')) {
            return trim(file_get_contents($root . '/.python-version'));
        }
        return '3.13';
    }

    private function goVersion(string $root): string
    {
        if (file_exists($root . '/go.mod')) {
            if (preg_match('/^go\s+([\d.]+)/m', file_get_contents($root . '/go.mod'), $m)) {
                return $m[1];
            }
        }
        return '1.23';
    }
}
