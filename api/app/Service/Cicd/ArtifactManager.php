<?php
declare(strict_types=1);

namespace App\Service\Cicd;

use App\Entity\Build;

/**
 * Builds Docker images and pushes them to the container registry.
 */
final class ArtifactManager
{
    private string $registryUrl;

    public function __construct(
        private LogStreamer $logs,
    ) {
        $this->registryUrl = getenv('REGISTRY_URL') ?: 'http://registry:5000';
    }

    /**
     * Build a Docker image for the project.
     */
    public function buildImage(Build $build, PipelineConfig $config, string $workDir): void
    {
        $tag = $this->imageTag($build);

        $this->logs->info($build->id, "Building Docker image: {$tag}");

        // Check for existing Dockerfile, or generate one
        $dockerfile = $workDir . '/Dockerfile';
        if (!file_exists($dockerfile)) {
            $this->generateDockerfile($workDir, $config);
            $this->logs->info($build->id, "Auto-generated Dockerfile for stack: {$config->stack}");
        }

        $command = sprintf(
            'docker build -t %s -f %s %s 2>&1',
            escapeshellarg($tag),
            escapeshellarg($dockerfile),
            escapeshellarg($workDir)
        );

        $output = [];
        $exitCode = 0;
        exec($command, $output, $exitCode);

        foreach ($output as $line) {
            $this->logs->append($build->id, $line);
        }

        if ($exitCode !== 0) {
            throw new \RuntimeException('Docker build failed', $exitCode);
        }

        $build->image_tag = $tag;
        $build->image_url = $this->registryUrl . '/' . $tag;

        $this->logs->info($build->id, "Image built successfully: {$tag}");
    }

    /**
     * Push the built image to the registry.
     */
    public function pushImage(Build $build): void
    {
        if (!$build->image_tag) {
            throw new \RuntimeException('No image tag to push');
        }

        $registryTag = $this->registryHost() . '/' . $build->image_tag;

        $this->logs->info($build->id, "Pushing to registry: {$registryTag}");

        // Tag for registry
        exec(sprintf(
            'docker tag %s %s 2>&1',
            escapeshellarg($build->image_tag),
            escapeshellarg($registryTag)
        ));

        // Push
        $output = [];
        $exitCode = 0;
        exec(sprintf('docker push %s 2>&1', escapeshellarg($registryTag)), $output, $exitCode);

        foreach ($output as $line) {
            $this->logs->append($build->id, $line);
        }

        if ($exitCode !== 0) {
            throw new \RuntimeException('Docker push failed', $exitCode);
        }

        $build->image_url = $registryTag;
        $this->logs->info($build->id, "Image pushed successfully");
    }

    /**
     * Generate a Dockerfile based on stack type.
     */
    private function generateDockerfile(string $workDir, PipelineConfig $config): void
    {
        $content = match ($config->stack) {
            'monkeyslegion', 'laravel' => $this->phpDockerfile($config),
            'nextjs' => $this->nodeSsrDockerfile($config),
            'react', 'vue' => $this->nodeSpaDockerfile($config),
            'nuxtjs' => $this->nodeSsrDockerfile($config),
            'django', 'fastapi', 'flask' => $this->pythonDockerfile($config),
            'go' => $this->goDockerfile($config),
            'rust' => $this->rustDockerfile($config),
            'rails' => $this->rubyDockerfile($config),
            'static' => $this->staticDockerfile(),
            default => throw new \RuntimeException("Cannot auto-generate Dockerfile for stack: {$config->stack}"),
        };

        file_put_contents($workDir . '/Dockerfile', $content);
    }

    private function imageTag(Build $build): string
    {
        $sha = substr($build->commit_sha, 0, 7);
        return "build-{$build->project_id}:{$build->number}-{$sha}";
    }

    private function registryHost(): string
    {
        return parse_url($this->registryUrl, PHP_URL_HOST) . ':' . (parse_url($this->registryUrl, PHP_URL_PORT) ?: 5000);
    }

    private function phpDockerfile(PipelineConfig $config): string
    {
        $php = $config->runtime['php'] ?? '8.4';
        return <<<DOCKERFILE
FROM dunglas/frankenphp:1-php{$php}-alpine
RUN apk add --no-cache icu-dev libzip-dev && docker-php-ext-install pdo_mysql intl zip opcache
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /app
COPY . .
RUN composer install --no-dev --optimize-autoloader --no-scripts
EXPOSE 8000
CMD ["frankenphp", "run", "--config", "/etc/caddy/Caddyfile"]
DOCKERFILE;
    }

    private function nodeSsrDockerfile(PipelineConfig $config): string
    {
        $node = $config->runtime['node'] ?? '22';
        return <<<DOCKERFILE
FROM node:{$node}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:{$node}-alpine
WORKDIR /app
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
DOCKERFILE;
    }

    private function nodeSpaDockerfile(PipelineConfig $config): string
    {
        $node = $config->runtime['node'] ?? '22';
        return <<<DOCKERFILE
FROM node:{$node}-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
DOCKERFILE;
    }

    private function pythonDockerfile(PipelineConfig $config): string
    {
        $py = $config->runtime['python'] ?? '3.13';
        return <<<DOCKERFILE
FROM python:{$py}-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "app:app"]
DOCKERFILE;
    }

    private function goDockerfile(PipelineConfig $config): string
    {
        $go = $config->runtime['go'] ?? '1.23';
        return <<<DOCKERFILE
FROM golang:{$go}-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /main ./cmd/...
FROM alpine:3.20
COPY --from=builder /main /main
EXPOSE 8080
CMD ["/main"]
DOCKERFILE;
    }

    private function rustDockerfile(PipelineConfig $config): string
    {
        return <<<DOCKERFILE
FROM rust:slim AS builder
WORKDIR /app
COPY . .
RUN cargo build --release
FROM debian:bookworm-slim
COPY --from=builder /app/target/release/app /app
EXPOSE 8080
CMD ["/app"]
DOCKERFILE;
    }

    private function rubyDockerfile(PipelineConfig $config): string
    {
        $ruby = $config->runtime['ruby'] ?? '3.3';
        return <<<DOCKERFILE
FROM ruby:{$ruby}-slim
RUN apt-get update && apt-get install -y build-essential libpq-dev
WORKDIR /app
COPY Gemfile* ./
RUN bundle install --without development test
COPY . .
EXPOSE 3000
CMD ["rails", "server", "-b", "0.0.0.0"]
DOCKERFILE;
    }

    private function staticDockerfile(): string
    {
        return <<<DOCKERFILE
FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
DOCKERFILE;
    }
}
