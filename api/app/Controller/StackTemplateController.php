<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Router\Attributes\Middleware;
use App\Entity\StackConfig;
use App\Repository\StackConfigRepository;
use App\Repository\UserRepository;
use Psr\Http\Message\ServerRequestInterface;

#[Middleware('auth')]
class StackTemplateController extends AbstractController
{
    public function __construct(
        private StackConfigRepository $stackRepo,
        private UserRepository $userRepo,
    ) {
    }

    private function requireAdmin(ServerRequestInterface $request): ?Response
    {
        $uid = $this->userId($request);
        if (!$uid) {
            return $this->json(['error' => 'Authentication required.'], 401);
        }
        $user = $this->userRepo->find((int) $uid);
        if (!$user || !$user->is_admin) {
            return $this->json(['error' => 'Admin access required.'], 403);
        }
        return null;
    }

    private function configToArray(StackConfig $c): array
    {
        return [
            'id' => $c->id,
            'name' => $c->name,
            'display_name' => $c->display_name,
            'category' => $c->category,
            'docker_image' => $c->docker_image,
            'scaffold_command' => $c->scaffold_command,
            'gitignore_template' => $c->gitignore_template,
            'post_scaffold_commands' => $c->post_scaffold_commands,
            'enabled' => $c->enabled,
            'created_at' => ($c->created_at instanceof \DateTimeImmutable) ? $c->created_at->format('c') : $c->created_at,
            'updated_at' => ($c->updated_at instanceof \DateTimeImmutable) ? $c->updated_at->format('c') : $c->updated_at,
        ];
    }

    // ── List all stack configs ───────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/admin/stack-configs', name: 'admin.stackConfigs.list', summary: 'List stack configs', tags: ['Admin'])]
    public function list(ServerRequestInterface $request): Response
    {
        if ($denied = $this->requireAdmin($request))
            return $denied;
        $configs = $this->stackRepo->all();
        return $this->json(['data' => array_map([$this, 'configToArray'], $configs)]);
    }

    // ── List enabled stacks (public, for project creation) ──────────────

    #[Route(methods: 'GET', path: '/api/v1/stacks', name: 'stacks.list', summary: 'List available stacks', tags: ['Projects'])]
    public function listEnabled(ServerRequestInterface $request): Response
    {
        $configs = $this->stackRepo->findEnabled();
        $data = array_map(fn(StackConfig $c) => [
            'name' => $c->name,
            'display_name' => $c->display_name,
            'category' => $c->category,
        ], $configs);
        return $this->json(['data' => $data]);
    }

    // ── Get one ─────────────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/admin/stack-configs/{id}', name: 'admin.stackConfigs.show', summary: 'Get stack config', tags: ['Admin'])]
    public function show(ServerRequestInterface $request, int $id): Response
    {
        if ($denied = $this->requireAdmin($request))
            return $denied;
        $config = $this->stackRepo->find($id);
        if (!$config) {
            return $this->json(['error' => 'Stack config not found'], 404);
        }
        return $this->json(['data' => $this->configToArray($config)]);
    }

    // ── Create ──────────────────────────────────────────────────────────

    #[Route(methods: 'POST', path: '/api/v1/admin/stack-configs', name: 'admin.stackConfigs.create', summary: 'Create stack config', tags: ['Admin'])]
    public function create(ServerRequestInterface $request): Response
    {
        if ($denied = $this->requireAdmin($request))
            return $denied;

        $data = json_decode((string) $request->getBody(), true) ?? [];

        $name = strtolower(trim($data['name'] ?? ''));
        if ($name === '') {
            return $this->json(['error' => 'Name is required'], 422);
        }

        $existing = $this->stackRepo->findByName($name);
        if ($existing) {
            return $this->json(['error' => 'A stack with this name already exists'], 409);
        }

        $now = new \DateTimeImmutable();
        $config = new StackConfig();
        $config->name = $name;
        $config->display_name = trim($data['display_name'] ?? ucfirst($name));
        $config->category = trim($data['category'] ?? 'Other');
        $config->docker_image = trim($data['docker_image'] ?? '');
        $config->scaffold_command = trim($data['scaffold_command'] ?? '');
        $config->gitignore_template = trim($data['gitignore_template'] ?? '');
        $config->post_scaffold_commands = $data['post_scaffold_commands'] ?? null;
        $config->enabled = (bool) ($data['enabled'] ?? true);
        $config->created_at = $now;
        $config->updated_at = $now;

        $this->stackRepo->save($config);

        return $this->json(['data' => $this->configToArray($config)], 201);
    }

    // ── Update ──────────────────────────────────────────────────────────

    #[Route(methods: 'PUT', path: '/api/v1/admin/stack-configs/{id}', name: 'admin.stackConfigs.update', summary: 'Update stack config', tags: ['Admin'])]
    public function update(ServerRequestInterface $request, int $id): Response
    {
        if ($denied = $this->requireAdmin($request))
            return $denied;

        $config = $this->stackRepo->find($id);
        if (!$config) {
            return $this->json(['error' => 'Stack config not found'], 404);
        }

        $data = json_decode((string) $request->getBody(), true) ?? [];

        if (isset($data['display_name']))
            $config->display_name = trim($data['display_name']);
        if (isset($data['category']))
            $config->category = trim($data['category']);
        if (isset($data['docker_image']))
            $config->docker_image = trim($data['docker_image']);
        if (isset($data['scaffold_command']))
            $config->scaffold_command = trim($data['scaffold_command']);
        if (isset($data['gitignore_template']))
            $config->gitignore_template = trim($data['gitignore_template']);
        if (array_key_exists('post_scaffold_commands', $data))
            $config->post_scaffold_commands = $data['post_scaffold_commands'];
        if (isset($data['enabled']))
            $config->enabled = (bool) $data['enabled'];
        $config->updated_at = new \DateTimeImmutable();

        $this->stackRepo->save($config);

        return $this->json(['data' => $this->configToArray($config)]);
    }

    // ── Delete ──────────────────────────────────────────────────────────

    #[Route(methods: 'DELETE', path: '/api/v1/admin/stack-configs/{id}', name: 'admin.stackConfigs.delete', summary: 'Delete stack config', tags: ['Admin'])]
    public function delete(ServerRequestInterface $request, int $id): Response
    {
        if ($denied = $this->requireAdmin($request))
            return $denied;

        $config = $this->stackRepo->find($id);
        if (!$config) {
            return $this->json(['error' => 'Stack config not found'], 404);
        }

        $this->stackRepo->delete($config);

        return $this->json(['status' => 'deleted']);
    }
}
