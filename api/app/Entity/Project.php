<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

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

    #[Field(type: 'enum', enumValues: [
        'monkeyslegion',
        'laravel',
        'wordpress',
        'drupal',
        'nextjs',
        'nuxtjs',
        'react',
        'vue',
        'django',
        'fastapi',
        'flask',
        'rails',
        'go',
        'rust',
        'static',
        'docker'
    ])]
    public string $stack;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $php_version = null;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $node_version = null;

    #[Field(type: 'string', length: 10, nullable: true)]
    public ?string $python_version = null;

    #[Field(type: 'enum', enumValues: ['mysql', 'postgres', 'mongo', 'redis', 'none'], nullable: true)]
    public ?string $database = null;

    #[Field(type: 'enum', enumValues: ['active', 'suspended', 'archived'], default: 'active')]
    public string $status = 'active';

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $repo_url = null;

    #[Field(type: 'string', length: 100, default: 'main')]
    public string $default_branch = 'main';

    #[Field(type: 'boolean', default: true)]
    public bool $auto_deploy = true;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $custom_domain = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $deleted_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Organization::class, inversedBy: 'projects')]
    public ?Organization $organization = null;

    #[OneToMany(targetEntity: Environment::class, mappedBy: 'project_id')]
    public array $environments = [];

    #[OneToMany(targetEntity: Build::class, mappedBy: 'project_id')]
    public array $builds = [];

    #[OneToMany(targetEntity: PullRequest::class, mappedBy: 'project_id')]
    public array $pull_requests = [];

    #[OneToMany(targetEntity: Webhook::class, mappedBy: 'project_id')]
    public array $webhooks = [];
}
