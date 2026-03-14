<?php
declare(strict_types=1);

namespace App\Entity;

use MonkeysLegion\Entity\Attributes\Entity;
use MonkeysLegion\Entity\Attributes\Field;
use MonkeysLegion\Entity\Attributes\ManyToMany;
use MonkeysLegion\Entity\Attributes\JoinTable;
use MonkeysLegion\Entity\Attributes\OneToMany;

use MonkeysLegion\Auth\Contract\AuthenticatableInterface;
use MonkeysLegion\Auth\Contract\HasRolesInterface;
use MonkeysLegion\Auth\Contract\HasPermissionsInterface;
use MonkeysLegion\Auth\Trait\AuthenticatableTrait;
use MonkeysLegion\Auth\Trait\HasRolesTrait;
use MonkeysLegion\Auth\Trait\HasPermissionsTrait;

#[Entity(table: 'users')]
class User implements
    AuthenticatableInterface,
    HasRolesInterface,
    HasPermissionsInterface
{
    use AuthenticatableTrait;
    use HasRolesTrait;
    use HasPermissionsTrait;

    #[Field(type: 'integer', autoIncrement: true, primaryKey: true)]
    public int $id;

    #[Field(type: 'string', length: 255, unique: true)]
    public string $email;

    #[Field(type: 'string', length: 255)]
    public string $password_hash;

    #[Field(type: 'integer', default: 1)]
    public int $token_version = 1;

    #[Field(type: 'string', length: 100)]
    public string $name;

    #[Field(type: 'string', length: 500, nullable: true)]
    public ?string $avatar_url = null;

    #[Field(type: 'string', length: 255, nullable: true)]
    public ?string $two_factor_secret = null;

    #[Field(type: 'boolean', default: false)]
    public bool $two_factor_enabled = false;

    #[Field(type: 'json', nullable: true)]
    public ?array $two_factor_recovery_codes = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $email_verified_at = null;

    #[Field(type: 'datetime', nullable: true)]
    public ?\DateTimeImmutable $last_login_at = null;

    #[Field(type: 'string', length: 45, nullable: true)]
    public ?string $last_login_ip = null;

    #[Field(type: 'string', length: 50, default: 'UTC')]
    public string $timezone = 'UTC';

    #[Field(type: 'string', length: 10, default: 'en')]
    public string $locale = 'en';

    #[Field(type: 'boolean', default: false)]
    public bool $is_admin = false;

    #[Field(type: 'enum', enumValues: ['active', 'suspended', 'deleted'], default: 'active')]
    public string $status = 'active';

    #[Field(type: 'datetime', default: 'CURRENT_TIMESTAMP')]
    public \DateTimeImmutable|string|null $created_at = null;

    #[Field(type: 'datetime', default: 'CURRENT_TIMESTAMP')]
    public \DateTimeImmutable|string|null $updated_at = null;

    // --- Relationships ---

    #[ManyToMany(targetEntity: Role::class, inversedBy: 'users')]
    #[JoinTable(name: 'user_roles', joinColumn: 'user_id', inverseJoinColumn: 'role_id')]
    public array $roles = [];

    public array $permissions = [];

    #[OneToMany(targetEntity: OrganizationMember::class, mappedBy: 'user_id')]
    public array $memberships = [];

    #[OneToMany(targetEntity: Organization::class, mappedBy: 'owner_id')]
    public array $organizations = [];

    #[OneToMany(targetEntity: Notification::class, mappedBy: 'user_id')]
    public array $notifications = [];

    #[OneToMany(targetEntity: ApiKey::class, mappedBy: 'user_id')]
    public array $apiKeys = [];

    #[OneToMany(targetEntity: TimeEntry::class, mappedBy: 'user_id')]
    public array $timeEntries = [];

    // ----------------------------------------------------------
    // Magic setter for auto-converting datetime strings from DB
    // ----------------------------------------------------------

    public function __set(string $name, mixed $value): void
    {
        // Convert datetime strings from DatabaseUserProvider's naive hydrator
        if (in_array($name, ['created_at', 'updated_at', 'email_verified_at', 'last_login_at']) && is_string($value)) {
            $value = new \DateTimeImmutable($value);
        }
        if (in_array($name, ['two_factor_enabled', 'is_admin']) && is_int($value)) {
            $value = (bool) $value;
        }
        $this->$name = $value;
    }

    // ----------------------------------------------------------
    // Accessors / helpers
    // ----------------------------------------------------------

    public function getId(): int
    {
        return $this->id;
    }
    public function getEmail(): string
    {
        return $this->email;
    }
    public function setEmail(string $email): self
    {
        $this->email = $email;
        return $this;
    }
    public function getName(): string
    {
        return $this->name;
    }
    public function setName(string $name): self
    {
        $this->name = $name;
        return $this;
    }
    public function getPasswordHash(): string
    {
        return $this->password_hash;
    }
    public function setPasswordHash(string $hash): self
    {
        $this->password_hash = $hash;
        return $this;
    }
    public function getTokenVersion(): int
    {
        return $this->token_version;
    }
    public function bumpTokenVersion(): self
    {
        $this->token_version++;
        return $this;
    }

    public function isAdmin(): bool
    {
        return $this->is_admin;
    }

    public function markEmailVerified(?\DateTimeImmutable $at = null): self
    {
        $this->email_verified_at = $at ?? new \DateTimeImmutable();
        return $this;
    }

    public function getTwoFactorSecret(): ?string
    {
        return $this->two_factor_secret;
    }
    public function setTwoFactorSecret(?string $secret): self
    {
        $this->two_factor_secret = $secret;
        return $this;
    }
    public function getTwoFactorRecoveryCodes(): ?array
    {
        return $this->two_factor_recovery_codes;
    }
    public function setTwoFactorRecoveryCodes(?array $codes): self
    {
        $this->two_factor_recovery_codes = $codes;
        return $this;
    }
    public function getCreatedAt(): ?\DateTimeImmutable
    {
        if (is_string($this->created_at)) {
            $this->created_at = new \DateTimeImmutable($this->created_at);
        }
        return $this->created_at;
    }
    public function getUpdatedAt(): ?\DateTimeImmutable
    {
        if (is_string($this->updated_at)) {
            $this->updated_at = new \DateTimeImmutable($this->updated_at);
        }
        return $this->updated_at;
    }

    // AuthenticatableInterface
    public function getAuthIdentifier(): int|string
    {
        return $this->id;
    }
    public function getAuthIdentifierName(): string
    {
        return 'id';
    }
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }
    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_enabled;
    }
}
