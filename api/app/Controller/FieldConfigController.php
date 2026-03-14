<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use App\Repository\BoardRepository;
use App\Repository\BoardFieldConfigRepository;
use App\Repository\TaskCustomFieldValueRepository;
use Psr\Http\Message\ServerRequestInterface;

final class FieldConfigController extends AbstractController
{
    /** Default system fields every board gets */
    private const SYSTEM_FIELDS = [
        ['field_key' => 'title', 'field_label' => 'Title', 'field_type' => 'text', 'required' => true, 'position' => 0],
        ['field_key' => 'description', 'field_label' => 'Description', 'field_type' => 'text', 'required' => false, 'position' => 1],
        ['field_key' => 'type', 'field_label' => 'Type', 'field_type' => 'select', 'required' => true, 'position' => 2],
        ['field_key' => 'status', 'field_label' => 'Status', 'field_type' => 'select', 'required' => true, 'position' => 3],
        ['field_key' => 'priority', 'field_label' => 'Priority', 'field_type' => 'select', 'required' => true, 'position' => 4],
        ['field_key' => 'assignee_id', 'field_label' => 'Assignee', 'field_type' => 'select', 'required' => false, 'position' => 5],
        ['field_key' => 'labels', 'field_label' => 'Labels', 'field_type' => 'multiselect', 'required' => false, 'position' => 6],
        ['field_key' => 'sprint_id', 'field_label' => 'Sprint', 'field_type' => 'select', 'required' => false, 'position' => 7],
        ['field_key' => 'story_points', 'field_label' => 'Story Points', 'field_type' => 'number', 'required' => false, 'position' => 8],
        ['field_key' => 'due_date', 'field_label' => 'Due Date', 'field_type' => 'date', 'required' => false, 'position' => 9],
        ['field_key' => 'parent_id', 'field_label' => 'Parent Task', 'field_type' => 'select', 'required' => false, 'position' => 10],
    ];

    public function __construct(
        private BoardRepository $boardRepo,
        private BoardFieldConfigRepository $fieldConfigRepo,
        private TaskCustomFieldValueRepository $cfvRepo,
    ) {
    }

    /** Seed system fields for a board if none exist */
    private function ensureSystemFields(int $boardId): void
    {
        $existing = $this->fieldConfigRepo->findByBoard($boardId);
        if (count($existing) > 0)
            return;

        $now = new \DateTimeImmutable();
        foreach (self::SYSTEM_FIELDS as $f) {
            $cfg = new \App\Entity\BoardFieldConfig();
            $cfg->board_id = $boardId;
            $cfg->field_key = $f['field_key'];
            $cfg->field_label = $f['field_label'];
            $cfg->field_type = $f['field_type'];
            $cfg->enabled = true;
            $cfg->required = $f['required'];
            $cfg->is_system = true;
            $cfg->position = $f['position'];
            $cfg->options = null;
            $cfg->created_at = $now;
            $cfg->updated_at = $now;
            $this->fieldConfigRepo->save($cfg);
        }
    }

    private function serialize(\App\Entity\BoardFieldConfig $c): array
    {
        return [
            'id' => $c->id,
            'board_id' => $c->board_id,
            'field_key' => $c->field_key,
            'field_label' => $c->field_label,
            'field_type' => $c->field_type,
            'enabled' => $c->enabled,
            'required' => $c->required,
            'is_system' => $c->is_system,
            'position' => $c->position,
            'options' => $c->options,
        ];
    }

    // ─────────────────────────────────────────────────
    //  List field configs for a project's board
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectId}/field-configs', name: 'fieldConfigs.index', middleware: ['auth'], summary: 'List field configs', tags: ['FieldConfig'])]
    public function index(ServerRequestInterface $request, int $orgId, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $boards = $this->boardRepo->findByProject($projectId);
            if (empty($boards))
                return $this->json(['data' => []]);
            $board = $boards[0];

            $this->ensureSystemFields($board->id);
            $configs = $this->fieldConfigRepo->findByBoard($board->id);

            return $this->json(['data' => array_map(fn($c) => $this->serialize($c), $configs)]);
        } catch (\Throwable $e) {
            error_log('FIELD_CONFIG_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Update a field config (toggle enabled/required, rename, reorder)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'PUT', path: '/api/v1/field-configs/{configId}', name: 'fieldConfigs.update', middleware: ['auth'], summary: 'Update field config', tags: ['FieldConfig'])]
    public function update(ServerRequestInterface $request, int $configId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $cfg = $this->fieldConfigRepo->find($configId);
            if (!$cfg)
                return $this->json(['error' => 'Config not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];

            // System fields: only allow toggling enabled (except title/status/type/priority which are always required)
            $alwaysRequired = ['title', 'status', 'type'];

            if (array_key_exists('enabled', $data) && !in_array($cfg->field_key, $alwaysRequired)) {
                $cfg->enabled = (bool) $data['enabled'];
            }
            if (array_key_exists('required', $data) && !in_array($cfg->field_key, $alwaysRequired)) {
                $cfg->required = (bool) $data['required'];
            }
            if (isset($data['field_label']) && !$cfg->is_system) {
                $cfg->field_label = trim($data['field_label']);
            }
            if (isset($data['position'])) {
                $cfg->position = (int) $data['position'];
            }
            if (array_key_exists('options', $data) && !$cfg->is_system) {
                $cfg->options = is_array($data['options']) ? $data['options'] : null;
            }

            $cfg->updated_at = new \DateTimeImmutable();
            $this->fieldConfigRepo->save($cfg);

            return $this->json(['data' => $this->serialize($cfg)]);
        } catch (\Throwable $e) {
            error_log('FIELD_CONFIG_UPDATE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Bulk update positions (reorder)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/projects/{projectId}/field-configs/reorder', name: 'fieldConfigs.reorder', middleware: ['auth'], summary: 'Reorder fields', tags: ['FieldConfig'])]
    public function reorder(ServerRequestInterface $request, int $orgId, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $data = json_decode((string) $request->getBody(), true) ?? [];
            $order = $data['order'] ?? [];
            if (!is_array($order))
                return $this->json(['error' => 'Order must be an array of config IDs.'], 422);

            foreach ($order as $pos => $id) {
                $cfg = $this->fieldConfigRepo->find((int) $id);
                if ($cfg) {
                    $cfg->position = $pos;
                    $cfg->updated_at = new \DateTimeImmutable();
                    $this->fieldConfigRepo->save($cfg);
                }
            }

            return $this->json(['message' => 'Reordered.']);
        } catch (\Throwable $e) {
            error_log('FIELD_REORDER ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Create custom field
    // ─────────────────────────────────────────────────

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/projects/{projectId}/field-configs', name: 'fieldConfigs.store', middleware: ['auth'], summary: 'Create custom field', tags: ['FieldConfig'])]
    public function store(ServerRequestInterface $request, int $orgId, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $boards = $this->boardRepo->findByProject($projectId);
            if (empty($boards))
                return $this->json(['error' => 'No board found.'], 404);
            $board = $boards[0];

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $key = trim($data['field_key'] ?? '');
            $label = trim($data['field_label'] ?? '');
            $type = $data['field_type'] ?? 'text';

            if (!$key || !$label)
                return $this->json(['error' => 'Field key and label are required.'], 422);

            // Check uniqueness
            $existing = $this->fieldConfigRepo->findByBoardAndKey($board->id, $key);
            if ($existing)
                return $this->json(['error' => 'A field with this key already exists.'], 422);

            // Get max position
            $configs = $this->fieldConfigRepo->findByBoard($board->id);
            $maxPos = 0;
            foreach ($configs as $c) {
                if ($c->position > $maxPos)
                    $maxPos = $c->position;
            }

            $allowedTypes = ['text', 'number', 'date', 'select', 'multiselect', 'checkbox', 'url', 'email'];
            if (!in_array($type, $allowedTypes))
                $type = 'text';

            $now = new \DateTimeImmutable();
            $cfg = new \App\Entity\BoardFieldConfig();
            $cfg->board_id = $board->id;
            $cfg->field_key = $key;
            $cfg->field_label = $label;
            $cfg->field_type = $type;
            $cfg->enabled = true;
            $cfg->required = (bool) ($data['required'] ?? false);
            $cfg->is_system = false;
            $cfg->position = $maxPos + 1;
            $cfg->options = isset($data['options']) && is_array($data['options']) ? $data['options'] : null;
            $cfg->created_at = $now;
            $cfg->updated_at = $now;
            $this->fieldConfigRepo->save($cfg);

            return $this->json(['data' => $this->serialize($cfg)], 201);
        } catch (\Throwable $e) {
            error_log('FIELD_CREATE ERROR: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Delete custom field
    // ─────────────────────────────────────────────────

    #[Route(methods: 'DELETE', path: '/api/v1/field-configs/{configId}', name: 'fieldConfigs.destroy', middleware: ['auth'], summary: 'Delete custom field', tags: ['FieldConfig'])]
    public function destroy(ServerRequestInterface $request, int $configId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $cfg = $this->fieldConfigRepo->find($configId);
            if (!$cfg)
                return $this->json(['error' => 'Config not found.'], 404);

            if ($cfg->is_system)
                return $this->json(['error' => 'Cannot delete system fields.'], 422);

            $this->fieldConfigRepo->delete($cfg);
            return $this->json(['message' => 'Field deleted.']);
        } catch (\Throwable $e) {
            error_log('FIELD_DELETE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Custom field values for a task
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}/custom-fields', name: 'tasks.customFields.index', middleware: ['auth'], summary: 'Get custom field values for a task', tags: ['FieldConfig'])]
    public function taskCustomFields(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $values = $this->cfvRepo->findByTask($taskId);
            $data = [];
            foreach ($values as $v) {
                $data[] = [
                    'id' => $v->id,
                    'task_id' => $v->task_id,
                    'field_config_id' => $v->field_config_id,
                    'value' => $v->value,
                ];
            }
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('TASK_CF_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'PUT', path: '/api/v1/tasks/{taskId}/custom-fields', name: 'tasks.customFields.update', middleware: ['auth'], summary: 'Update custom field values for a task', tags: ['FieldConfig'])]
    public function updateTaskCustomFields(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $data = json_decode((string) $request->getBody(), true) ?? [];
            // Expect { "values": { "<field_config_id>": "value", ... } }
            $values = $data['values'] ?? [];

            $now = new \DateTimeImmutable();
            $saved = [];

            foreach ($values as $fieldConfigId => $value) {
                $fieldConfigId = (int) $fieldConfigId;
                $existing = $this->cfvRepo->findByTaskAndField($taskId, $fieldConfigId);

                if ($existing) {
                    $existing->value = is_null($value) ? null : (string) $value;
                    $existing->updated_at = $now;
                    $this->cfvRepo->save($existing);
                    $saved[] = $existing;
                } else {
                    $entry = new \App\Entity\TaskCustomFieldValue();
                    $entry->task_id = $taskId;
                    $entry->field_config_id = $fieldConfigId;
                    $entry->value = is_null($value) ? null : (string) $value;
                    $entry->created_at = $now;
                    $entry->updated_at = $now;
                    $this->cfvRepo->save($entry);
                    $saved[] = $entry;
                }
            }

            $result = [];
            foreach ($saved as $v) {
                $result[] = [
                    'id' => $v->id,
                    'task_id' => $v->task_id,
                    'field_config_id' => $v->field_config_id,
                    'value' => $v->value,
                ];
            }
            return $this->json(['data' => $result]);
        } catch (\Throwable $e) {
            error_log('TASK_CF_UPDATE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }
}
