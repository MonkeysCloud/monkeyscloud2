<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;
use MonkeysLegion\Entity\Attributes\OneToOne;

#[Entity(table: 'projects')]
class Project
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'string', length: 100)]
    public string $slug;

    #[Field(type: 'text', nullable: true)]
    public ?string $description = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $logo_url = null;

    #[Field(type: 'enum', enumValues: [
        'monkeyslegion',
        'laravel',
        'symfony',
        'wordpress',
        'drupal',
        'php-generic',
        'nextjs',
        'nuxtjs',
        'remix',
        'sveltekit',
        'astro',
        'express',
        'nestjs',
        'react',
        'vue',
        'angular',
        'django',
        'fastapi',
        'flask',
        'streamlit',
        'python-generic',
        'rails',
        'ruby-generic',
        'go',
        'rust',
        'spring-boot',
        'java-generic',
        'dotnet',
        'phoenix',
        'static',
        'docker',
        'docker-compose'
    ])]
    public string $stack;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $php_version = null;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $node_version = null;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $python_version = null;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $ruby_version = null;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $go_version = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $build_command = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $start_command = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $install_command = null;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $output_directory = null;

    #[Field(type: 'string', length: 255, default: '/')]
    public string $root_directory = '/';

    #[Field(type: 'boolean', default: true)]
    public bool $auto_deploy = true;

    #[Field(type: 'enum', enumValues: ['internal', 'github', 'gitlab', 'bitbucket'], default: 'internal')]
    public string $repo_source = 'internal';

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $repo_url = null;

    #[Field(type: 'string', length: 100, default: 'main')]
    public string $default_branch = 'main';

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $task_prefix = null;

    #[Field(type: 'integer', default: 0)]
    public int $task_counter = 0;

    #[Field(type: 'enum', enumValues: ['active', 'paused', 'archived'], default: 'active')]
    public string $status = 'active';

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $deleted_at = null;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'projects')]
    public ?Organization $organization = null;

    #[OneToMany(targetEntity: Environment::class, mappedBy: 'project_id')]
    public array $environments = [];

    #[OneToMany(targetEntity: EnvironmentVariable::class, mappedBy: 'project_id')]
    public array $envVars = [];

    #[OneToMany(targetEntity: Build::class, mappedBy: 'project_id')]
    public array $builds = [];

    #[OneToMany(targetEntity: Deployment::class, mappedBy: 'project_id')]
    public array $deployments = [];

    #[OneToMany(targetEntity: Domain::class, mappedBy: 'project_id')]
    public array $domains = [];

    #[OneToMany(targetEntity: Webhook::class, mappedBy: 'project_id')]
    public array $webhooks = [];

    #[OneToMany(targetEntity: Board::class, mappedBy: 'project_id')]
    public array $boards = [];
}
