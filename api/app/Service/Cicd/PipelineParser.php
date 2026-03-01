<?php
declare(strict_types=1);

namespace App\Service\Cicd;

/**
 * Parses .monkeyscloud.yml from a repo and produces a PipelineConfig.
 */
final class PipelineParser
{
    public function __construct(
        private StackDetector $detector,
    ) {
    }

    /**
     * Parse pipeline config from a checked-out repo.
     *
     * 1. Auto-detect stack from repo files
     * 2. Read .monkeyscloud.yml if it exists
     * 3. Merge user overrides on top of defaults
     */
    public function parse(string $repoPath): PipelineConfig
    {
        // Auto-detect
        $detected = $this->detector->detect($repoPath);
        $config = PipelineConfig::fromDefaults($detected);

        // Read customer config if present
        $yamlPath = $repoPath . '/.monkeyscloud.yml';
        if (file_exists($yamlPath)) {
            $yaml = yaml_parse_file($yamlPath);
            if (is_array($yaml)) {
                $config = $config->mergeWith($yaml);
            }
        }

        return $config;
    }

    /**
     * Parse from raw YAML string (for testing / preview).
     */
    public function parseFromString(string $yamlContent, string $repoPath): PipelineConfig
    {
        $detected = $this->detector->detect($repoPath);
        $config = PipelineConfig::fromDefaults($detected);

        $yaml = yaml_parse($yamlContent);
        if (is_array($yaml)) {
            $config = $config->mergeWith($yaml);
        }

        return $config;
    }
}
