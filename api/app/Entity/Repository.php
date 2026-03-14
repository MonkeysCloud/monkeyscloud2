<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;
use MonkeysLegion\Entity\Attributes\OneToMany;

#[Entity(table: 'repositories')]
class Repository
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'integer')]
    public int $organization_id;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'string', length: 100, default: 'main')]
    public string $default_branch = 'main';

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $storage_path = null;

    #[Field(type: 'bigInt', default: 0)]
    public int $size_bytes = 0;

    #[Field(type: 'enum', enumValues: ['internal', 'github', 'gitlab', 'bitbucket'], default: 'internal')]
    public string $source = 'internal';

    #[Field(type: 'string', length: 100, nullable: true)]
    public ?string $external_id = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $external_url = null;

    #[Field(type: 'string', length: 64, nullable: true)]
    public ?string $webhook_secret = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $last_push_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    // --- Relationships ---

    #[ManyToOne(targetEntity: Project::class)]
    public ?Project $project = null;

    #[ManyToOne(targetEntity: Organization::class)]
    public ?Organization $organization = null;

    #[OneToMany(targetEntity: Branch::class, mappedBy: 'repository_id')]
    public array $branches = [];

    #[OneToMany(targetEntity: Commit::class, mappedBy: 'repository_id')]
    public array $commits = [];

    #[OneToMany(targetEntity: PullRequest::class, mappedBy: 'repository_id')]
    public array $pullRequests = [];
}
