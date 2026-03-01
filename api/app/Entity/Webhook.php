<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'webhooks')]
class Webhook
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $project_id;

    #[Field(type: 'string', length: 500)]
    public string $url;

    #[Field(type: 'string', length: 255)]
    public string $secret;

    #[Field(type: 'json')]
    public array $events; // push, pr_opened, pr_merged, build_passed, deploy_live …

    #[Field(type: 'boolean', default: true)]
    public bool $active = true;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $last_triggered_at = null;

    #[Field(type: 'integer', nullable: true)]
    public ?int $last_response_code = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $updated_at;

    #[ManyToOne(targetEntity: Project::class, inversedBy: 'webhooks')]
    public ?Project $project = null;
}
