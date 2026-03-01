<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToOne;

#[Entity(table: 'notifications')]
class Notification
{
    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'integer')]
    public int $user_id;

    #[Field(type: 'string', length: 50)]
    public string $type; // build_failed, pr_opened, deploy_live, task_assigned …

    #[Field(type: 'string', length: 255)]
    public string $title;

    #[Field(type: 'text', nullable: true)]
    public ?string $body = null;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $action_url = null;

    #[Field(type: 'json', nullable: true)]
    public ?array $data = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $read_at = null;

    #[Field(type: 'datetime')]
    public \DateTimeImmutable $created_at;

    #[ManyToOne(targetEntity: User::class)]
    public ?User $user = null;
}
