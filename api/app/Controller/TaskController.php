<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use App\Repository\BoardRepository;
use App\Repository\SprintRepository;
use App\Repository\TaskRepository;
use App\Repository\TaskCommentRepository;
use App\Repository\TimeEntryRepository;
use App\Repository\TaskLabelRepository;
use App\Repository\AttachmentRepository;
use Psr\Http\Message\ServerRequestInterface;

final class TaskController extends AbstractController
{
    public function __construct(
        private BoardRepository $boardRepo,
        private SprintRepository $sprintRepo,
        private TaskRepository $taskRepo,
        private TaskCommentRepository $commentRepo,
        private TimeEntryRepository $timeRepo,
        private TaskLabelRepository $labelRepo,
        private AttachmentRepository $attachmentRepo,
    ) {
    }

    /** Resolve the board for a given project */
    private function getBoardForProject(int $projectId): ?\App\Entity\Board
    {
        $boards = $this->boardRepo->findByProject($projectId);
        return $boards[0] ?? null;
    }

    /** Serialize a task to array */
    private function serializeTask(\App\Entity\Task $t, bool $includeComments = false): array
    {
        // Resolve prefix for key — prefer project task_prefix, fall back to board prefix
        $prefix = '';
        try {
            $board = $this->boardRepo->find($t->board_id);
            if ($board && $board->project_id) {
                $pdo = $this->taskRepo->getPdo();
                $stmt = $pdo->prepare('SELECT task_prefix FROM projects WHERE id = ? LIMIT 1');
                $stmt->execute([$board->project_id]);
                $projPrefix = $stmt->fetchColumn();
                if ($projPrefix) {
                    $prefix = $projPrefix;
                } elseif ($board->prefix) {
                    $prefix = $board->prefix;
                }
            } elseif ($board) {
                $prefix = $board->prefix;
            }
        } catch (\Throwable $e) {
        }

        $data = [
            'id' => $t->id,
            'board_id' => $t->board_id,
            'sprint_id' => $t->sprint_id,
            'number' => $t->number,
            'key' => $prefix ? ($prefix . '-' . $t->number) : ('#' . $t->number),
            'title' => $t->title,
            'description' => $t->description,
            'type' => $t->type,
            'status' => $t->status,
            'priority' => $t->priority,
            'story_points' => $t->story_points,
            'assignee_id' => $t->assignee_id,
            'reporter_id' => $t->reporter_id,
            'parent_id' => $t->parent_id,
            'branch_name' => $t->branch_name,
            'due_date' => $t->due_date instanceof \DateTimeInterface ? $t->due_date->format('Y-m-d') : $t->due_date,
            'started_at' => $t->started_at instanceof \DateTimeInterface ? $t->started_at->format('c') : $t->started_at,
            'completed_at' => $t->completed_at instanceof \DateTimeInterface ? $t->completed_at->format('c') : $t->completed_at,
            'position' => $t->position,
            'ai_generated' => $t->ai_generated,
            'created_at' => $t->created_at instanceof \DateTimeInterface ? $t->created_at->format('c') : $t->created_at,
            'updated_at' => $t->updated_at instanceof \DateTimeInterface ? $t->updated_at->format('c') : $t->updated_at,
        ];

        // Load labels from join table
        try {
            $pdo = $this->taskRepo->getPdo();
            $stmt = $pdo->prepare('SELECT tl.id, tl.name, tl.color FROM task_label jt JOIN task_labels tl ON tl.id = jt.label_id WHERE jt.task_id = ?');
            $stmt->execute([$t->id]);
            $data['labels'] = $stmt->fetchAll(\PDO::FETCH_ASSOC);
        } catch (\Throwable $e) {
            $data['labels'] = [];
        }

        // Load children count and parent info
        try {
            $pdo = $this->taskRepo->getPdo();
            $stmt = $pdo->prepare('SELECT COUNT(*) FROM tasks WHERE parent_id = ? AND deleted_at IS NULL');
            $stmt->execute([$t->id]);
            $data['children_count'] = (int) $stmt->fetchColumn();
        } catch (\Throwable $e) {
            $data['children_count'] = 0;
        }

        // Parent info
        if ($t->parent_id) {
            try {
                $parent = $this->taskRepo->find($t->parent_id);
                if ($parent) {
                    // Compute parent key
                    $parentKey = '#' . $parent->number;
                    try {
                        $parentBoard = $this->boardRepo->find($parent->board_id);
                        if ($parentBoard && $parentBoard->project_id) {
                            $pStmt = $pdo->prepare('SELECT task_prefix FROM projects WHERE id = ? LIMIT 1');
                            $pStmt->execute([$parentBoard->project_id]);
                            $pPrefix = $pStmt->fetchColumn();
                            if ($pPrefix)
                                $parentKey = $pPrefix . '-' . $parent->number;
                        }
                    } catch (\Throwable $e) {
                    }
                    $data['parent'] = [
                        'id' => $parent->id,
                        'number' => $parent->number,
                        'key' => $parentKey,
                        'title' => $parent->title,
                        'type' => $parent->type,
                    ];
                }
            } catch (\Throwable $e) {
                $data['parent'] = null;
            }
        } else {
            $data['parent'] = null;
        }

        // Load children list (only when includeComments = detail view)
        if ($includeComments) {
            try {
                $children = $this->taskRepo->findBy(['parent_id' => $t->id]);
                $children = array_filter($children, fn($c) => !$c->deleted_at);
                $data['children'] = array_values(array_map(function ($c) use ($prefix) {
                    $childKey = $prefix ? ($prefix . '-' . $c->number) : ('#' . $c->number);
                    return [
                        'id' => $c->id,
                        'number' => $c->number,
                        'key' => $childKey,
                        'title' => $c->title,
                        'type' => $c->type,
                        'status' => $c->status,
                        'priority' => $c->priority,
                        'story_points' => $c->story_points,
                        'assignee_id' => $c->assignee_id,
                    ];
                }, $children));
            } catch (\Throwable $e) {
                $data['children'] = [];
            }
        }

        if ($includeComments) {
            try {
                $comments = $this->commentRepo->findByTask($t->id);
                $data['comments'] = array_map(fn($c) => [
                    'id' => $c->id,
                    'task_id' => $c->task_id,
                    'user_id' => $c->user_id,
                    'is_ai' => $c->is_ai,
                    'body' => $c->body,
                    'parent_id' => $c->parent_id,
                    'created_at' => $c->created_at instanceof \DateTimeInterface ? $c->created_at->format('c') : $c->created_at,
                    'updated_at' => $c->updated_at instanceof \DateTimeInterface ? $c->updated_at->format('c') : $c->updated_at,
                ], $comments);
            } catch (\Throwable $e) {
                $data['comments'] = [];
            }
        }
        // Attachments (detail view)
        if ($includeComments) {
            try {
                $attachments = $this->attachmentRepo->findByEntity('task', $t->id);
                $data['attachments'] = array_map(fn($a) => $a->toArray(), $attachments);
            } catch (\Throwable $e) {
                $data['attachments'] = [];
            }
        }

        return $data;
    }

    // ─────────────────────────────────────────────────
    //  Boards (keep existing routes)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/boards', name: 'boards.index', summary: 'List boards', tags: ['Tasks'])]
    public function boards(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->boardRepo->findByOrganization($orgId));
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/boards', name: 'boards.store', summary: 'Create board', tags: ['Tasks'])]
    public function createBoard(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json(['message' => 'Created'], 201);
    }

    #[Route(methods: 'GET', path: '/api/v1/boards/{boardId}', name: 'boards.show', summary: 'Get board', tags: ['Tasks'])]
    public function showBoard(ServerRequestInterface $request, int $boardId): Response
    {
        $board = $this->boardRepo->find($boardId);
        if (!$board)
            return $this->json(['error' => 'Not found'], 404);
        return $this->json($board);
    }

    // ─────────────────────────────────────────────────
    //  Sprints (keep existing routes)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/boards/{boardId}/sprints', name: 'sprints.index', summary: 'List sprints', tags: ['Tasks'])]
    public function sprints(ServerRequestInterface $request, int $boardId): Response
    {
        return $this->json($this->sprintRepo->findByBoard($boardId));
    }

    #[Route(methods: 'POST', path: '/api/v1/boards/{boardId}/sprints', name: 'sprints.store', summary: 'Create sprint', tags: ['Tasks'])]
    public function createSprint(ServerRequestInterface $request, int $boardId): Response
    {
        return $this->json(['message' => 'Created'], 201);
    }

    #[Route(methods: 'PUT', path: '/api/v1/sprints/{sprintId}', name: 'sprints.update', summary: 'Update sprint', tags: ['Tasks'])]
    public function updateSprint(ServerRequestInterface $request, int $sprintId): Response
    {
        return $this->json(['message' => 'Updated']);
    }

    // ─────────────────────────────────────────────────
    //  Tasks — List (project-scoped)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/tasks', name: 'projectTasks.index', middleware: ['auth'], summary: 'List tasks for project', tags: ['Tasks'])]
    public function projectTasks(ServerRequestInterface $request, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $board = $this->getBoardForProject($projectId);
            if (!$board)
                return $this->json(['data' => []]);

            $params = $request->getQueryParams();
            $criteria = ['board_id' => $board->id];

            if (!empty($params['status']))
                $criteria['status'] = $params['status'];
            if (!empty($params['priority']))
                $criteria['priority'] = $params['priority'];
            if (!empty($params['type']))
                $criteria['type'] = $params['type'];
            if (!empty($params['assignee_id']))
                $criteria['assignee_id'] = (int) $params['assignee_id'];
            if (!empty($params['sprint_id']))
                $criteria['sprint_id'] = (int) $params['sprint_id'];

            // If exclude_completed_sprints is set, use raw SQL to exclude tasks from completed/cancelled sprints
            if (!empty($params['exclude_completed_sprints'])) {
                $pdo = $this->taskRepo->getPdo();
                $sql = "SELECT * FROM tasks WHERE board_id = ? AND deleted_at IS NULL AND (sprint_id IS NULL OR sprint_id NOT IN (SELECT id FROM sprints WHERE status IN ('completed', 'cancelled')))";
                $sqlParams = [$board->id];

                if (!empty($params['status'])) {
                    $sql .= " AND status = ?";
                    $sqlParams[] = $params['status'];
                }
                if (!empty($params['priority'])) {
                    $sql .= " AND priority = ?";
                    $sqlParams[] = $params['priority'];
                }
                if (!empty($params['type'])) {
                    $sql .= " AND type = ?";
                    $sqlParams[] = $params['type'];
                }
                if (!empty($params['assignee_id'])) {
                    $sql .= " AND assignee_id = ?";
                    $sqlParams[] = (int) $params['assignee_id'];
                }
                if (!empty($params['sprint_id'])) {
                    $sql .= " AND sprint_id = ?";
                    $sqlParams[] = (int) $params['sprint_id'];
                }

                $sql .= " ORDER BY position ASC, created_at DESC";
                $stmt = $pdo->prepare($sql);
                $stmt->execute($sqlParams);
                $rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

                // Hydrate into Task entities
                $dateFields = ['created_at', 'updated_at', 'deleted_at', 'due_date', 'started_at', 'completed_at'];
                $intFields = ['id', 'board_id', 'number', 'position', 'assignee_id', 'sprint_id', 'parent_id'];
                $tasks = [];
                foreach ($rows as $row) {
                    $t = new \App\Entity\Task();
                    foreach ($row as $col => $val) {
                        if (!property_exists($t, $col))
                            continue;
                        if ($val === null) {
                            try {
                                $t->$col = null;
                            } catch (\Throwable $e) {
                            }
                        } elseif (in_array($col, $dateFields)) {
                            $t->$col = new \DateTimeImmutable($val);
                        } elseif (in_array($col, $intFields)) {
                            $t->$col = (int) $val;
                        } else {
                            $t->$col = $val;
                        }
                    }
                    $tasks[] = $t;
                }
            } else {
                $tasks = $this->taskRepo->findBy($criteria, ['position' => 'ASC', 'created_at' => 'DESC']);
            }

            // Filter by search
            $search = trim($params['search'] ?? '');
            if ($search) {
                $searchLower = strtolower($search);
                // Fetch project task_prefix for key matching (e.g. "MW-1")
                $taskPrefix = '';
                try {
                    $pdo = $this->taskRepo->getPdo();
                    $stmt = $pdo->prepare('SELECT task_prefix FROM projects WHERE id = ? LIMIT 1');
                    $stmt->execute([$projectId]);
                    $taskPrefix = strtolower((string) $stmt->fetchColumn());
                } catch (\Throwable $e) {
                }

                $tasks = array_filter(
                    $tasks,
                    function ($t) use ($searchLower, $search, $taskPrefix) {
                        // Match by title
                        if (str_contains(strtolower($t->title), $searchLower))
                            return true;
                        // Match by number
                        if (str_contains((string) $t->number, $search))
                            return true;
                        // Match by full key (e.g. "mw-1")
                        if ($taskPrefix) {
                            $key = $taskPrefix . '-' . $t->number;
                            if (str_contains($key, $searchLower))
                                return true;
                        }
                        return false;
                    }
                );
            }

            // Filter by label (via join table)
            if (!empty($params['label_id'])) {
                try {
                    $pdo = $this->taskRepo->getPdo();
                    $stmt = $pdo->prepare('SELECT task_id FROM task_label WHERE label_id = ?');
                    $stmt->execute([(int) $params['label_id']]);
                    $labelTaskIds = array_column($stmt->fetchAll(\PDO::FETCH_ASSOC), 'task_id');
                    $tasks = array_filter($tasks, fn($t) => in_array($t->id, $labelTaskIds));
                } catch (\Throwable $e) {
                }
            }

            $data = array_values(array_map(fn($t) => $this->serializeTask($t), $tasks));
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('TASK_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Tasks — Board-scoped (keep existing routes)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/boards/{boardId}/tasks', name: 'tasks.index', summary: 'List tasks', tags: ['Tasks'])]
    public function tasks(ServerRequestInterface $request, int $boardId): Response
    {
        $status = $request->getQueryParams()['status'] ?? null;
        return $this->json($this->taskRepo->findByBoard($boardId, $status));
    }

    // ─────────────────────────────────────────────────
    //  Tasks — Create
    // ─────────────────────────────────────────────────

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/tasks', name: 'projectTasks.store', middleware: ['auth'], summary: 'Create task', tags: ['Tasks'])]
    public function createProjectTask(ServerRequestInterface $request, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $board = $this->getBoardForProject($projectId);
            if (!$board)
                return $this->json(['error' => 'No board found for this project.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $title = trim($data['title'] ?? '');
            if (!$title)
                return $this->json(['error' => 'Task title is required.'], 422);

            // Increment project counter atomically (or board counter as fallback)
            $pdo = $this->taskRepo->getPdo();
            $stmt = $pdo->prepare('UPDATE projects SET task_counter = task_counter + 1 WHERE id = ? RETURNING task_counter');
            $stmt->execute([$projectId]);
            $number = (int) $stmt->fetchColumn();
            if (!$number) {
                // Fallback to board counter
                $stmt = $pdo->prepare('UPDATE boards SET task_counter = task_counter + 1 WHERE id = ? RETURNING task_counter');
                $stmt->execute([$board->id]);
                $number = (int) $stmt->fetchColumn();
            }

            $now = new \DateTimeImmutable();
            $task = new \App\Entity\Task();
            $task->board_id = $board->id;
            $task->number = $number;
            $task->title = $title;
            $task->description = $data['description'] ?? null;
            $task->type = $data['type'] ?? 'task';
            $task->status = $data['status'] ?? 'backlog';
            $task->priority = $data['priority'] ?? 'medium';
            $task->story_points = isset($data['story_points']) ? (string) $data['story_points'] : null;
            $task->assignee_id = isset($data['assignee_id']) ? (int) $data['assignee_id'] : null;
            $task->reporter_id = (int) $userId;
            $task->parent_id = isset($data['parent_id']) ? (int) $data['parent_id'] : null;
            $task->sprint_id = isset($data['sprint_id']) ? (int) $data['sprint_id'] : null;
            $task->due_date = !empty($data['due_date']) ? new \DateTimeImmutable($data['due_date']) : null;
            $task->position = (int) ($data['position'] ?? 0);
            $task->created_at = $now;
            $task->updated_at = $now;

            $this->taskRepo->save($task);

            // Attach labels
            if (!empty($data['label_ids']) && is_array($data['label_ids'])) {
                foreach ($data['label_ids'] as $labelId) {
                    try {
                        $pdo->prepare('INSERT INTO task_label (task_id, label_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
                            ->execute([$task->id, (int) $labelId]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            return $this->json(['data' => $this->serializeTask($task)], 201);
        } catch (\Throwable $e) {
            error_log('TASK_CREATE ERROR: ' . $e->getMessage() . ' ' . $e->getTraceAsString());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/boards/{boardId}/tasks', name: 'tasks.store', summary: 'Create task', tags: ['Tasks'])]
    public function createTask(ServerRequestInterface $request, int $boardId): Response
    {
        // Delegate to project-based create after resolving board
        $board = $this->boardRepo->find($boardId);
        if (!$board || !$board->project_id)
            return $this->json(['error' => 'Board not found.'], 404);
        return $this->createProjectTask($request, $board->project_id);
    }

    // ─────────────────────────────────────────────────
    //  Tasks — Show
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}', name: 'tasks.show', middleware: ['auth'], summary: 'Get task', tags: ['Tasks'])]
    public function showTask(ServerRequestInterface $request, string $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = null;

            if (is_numeric($taskId)) {
                $task = $this->taskRepo->find((int) $taskId);
            } else {
                // Parse key like "MW-2" into prefix + number
                $parts = explode('-', $taskId, 2);
                if (count($parts) === 2 && is_numeric($parts[1])) {
                    $prefix = strtoupper($parts[0]);
                    $number = (int) $parts[1];
                    $pdo = $this->taskRepo->getPdo();
                    $stmt = $pdo->prepare('
                        SELECT t.id FROM tasks t
                        JOIN boards b ON b.id = t.board_id
                        JOIN projects p ON p.id = b.project_id
                        WHERE p.task_prefix = ? AND t.number = ?
                        LIMIT 1
                    ');
                    $stmt->execute([$prefix, $number]);
                    $foundId = $stmt->fetchColumn();
                    if ($foundId) {
                        $task = $this->taskRepo->find((int) $foundId);
                    }
                }
            }

            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            return $this->json(['data' => $this->serializeTask($task, true)]);
        } catch (\Throwable $e) {
            error_log('TASK_SHOW ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Tasks — Update
    // ─────────────────────────────────────────────────

    #[Route(methods: 'PUT', path: '/api/v1/tasks/{taskId}', name: 'tasks.update', middleware: ['auth'], summary: 'Update task', tags: ['Tasks'])]
    public function updateTask(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];

            // Updatable fields
            if (isset($data['title'])) {
                $v = trim($data['title']);
                if ($v)
                    $task->title = $v;
            }
            if (array_key_exists('description', $data))
                $task->description = $data['description'];
            if (isset($data['type']))
                $task->type = $data['type'];
            if (isset($data['status'])) {
                $task->status = $data['status'];
                // Auto-set timestamps
                if ($data['status'] !== 'backlog' && !$task->started_at) {
                    $task->started_at = new \DateTimeImmutable();
                }
                if (strtolower($data['status']) === 'done' || strtolower($data['status']) === 'completed') {
                    $task->completed_at = new \DateTimeImmutable();
                }
            }
            if (isset($data['priority']))
                $task->priority = $data['priority'];
            if (array_key_exists('story_points', $data))
                $task->story_points = $data['story_points'] !== null ? (string) $data['story_points'] : null;
            if (array_key_exists('assignee_id', $data))
                $task->assignee_id = $data['assignee_id'] !== null ? (int) $data['assignee_id'] : null;
            if (array_key_exists('sprint_id', $data))
                $task->sprint_id = $data['sprint_id'] !== null ? (int) $data['sprint_id'] : null;
            if (array_key_exists('parent_id', $data))
                $task->parent_id = $data['parent_id'] !== null ? (int) $data['parent_id'] : null;
            if (array_key_exists('due_date', $data))
                $task->due_date = !empty($data['due_date']) ? new \DateTimeImmutable($data['due_date']) : null;
            if (isset($data['position']))
                $task->position = (int) $data['position'];
            if (array_key_exists('branch_name', $data))
                $task->branch_name = $data['branch_name'];

            $task->updated_at = new \DateTimeImmutable();
            $this->taskRepo->save($task);

            // Update labels if provided
            if (isset($data['label_ids']) && is_array($data['label_ids'])) {
                $pdo = $this->taskRepo->getPdo();
                $pdo->prepare('DELETE FROM task_label WHERE task_id = ?')->execute([$task->id]);
                foreach ($data['label_ids'] as $labelId) {
                    try {
                        $pdo->prepare('INSERT INTO task_label (task_id, label_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
                            ->execute([$task->id, (int) $labelId]);
                    } catch (\Throwable $e) {
                    }
                }
            }

            return $this->json(['data' => $this->serializeTask($task)]);
        } catch (\Throwable $e) {
            error_log('TASK_UPDATE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Tasks — Move (change status + position)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'PUT', path: '/api/v1/tasks/{taskId}/move', name: 'tasks.move', middleware: ['auth'], summary: 'Move task', tags: ['Tasks'])]
    public function moveTask(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            if (isset($data['status']))
                $task->status = $data['status'];
            if (isset($data['position']))
                $task->position = (int) $data['position'];
            if (isset($data['sprint_id']))
                $task->sprint_id = $data['sprint_id'] !== null ? (int) $data['sprint_id'] : null;

            $task->updated_at = new \DateTimeImmutable();
            $this->taskRepo->save($task);

            return $this->json(['data' => $this->serializeTask($task)]);
        } catch (\Throwable $e) {
            error_log('TASK_MOVE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Tasks — Batch Reorder
    // ─────────────────────────────────────────────────

    #[Route(methods: 'PUT', path: '/api/v1/projects/{projectId}/tasks/reorder', name: 'tasks.reorder', middleware: ['auth'], summary: 'Batch reorder tasks', tags: ['Tasks'])]
    public function reorderTasks(ServerRequestInterface $request, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $data = json_decode((string) $request->getBody(), true) ?? [];
            $items = $data['items'] ?? [];

            if (empty($items)) {
                return $this->json(['error' => 'No items provided.'], 422);
            }

            $pdo = $this->taskRepo->getPdo();
            $pdo->beginTransaction();

            try {
                $stmt = $pdo->prepare('UPDATE tasks SET status = ?, position = ?, sprint_id = ?, updated_at = NOW() WHERE id = ?');
                foreach ($items as $item) {
                    $stmt->execute([
                        $item['status'] ?? null,
                        (int) ($item['position'] ?? 0),
                        isset($item['sprint_id']) ? ($item['sprint_id'] !== null ? (int) $item['sprint_id'] : null) : null,
                        (int) $item['id'],
                    ]);
                }
                $pdo->commit();
            } catch (\Throwable $e) {
                $pdo->rollBack();
                throw $e;
            }

            return $this->json(['message' => 'Reorder successful.']);
        } catch (\Throwable $e) {
            error_log('TASK_REORDER ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Tasks — Delete (soft)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'DELETE', path: '/api/v1/tasks/{taskId}', name: 'tasks.destroy', middleware: ['auth'], summary: 'Delete task', tags: ['Tasks'])]
    public function deleteTask(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $task->deleted_at = new \DateTimeImmutable();
            $task->updated_at = new \DateTimeImmutable();
            $this->taskRepo->save($task);

            return $this->json(['message' => 'Task deleted.']);
        } catch (\Throwable $e) {
            error_log('TASK_DELETE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Comments
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}/comments', name: 'tasks.comments.index', middleware: ['auth'], summary: 'List task comments', tags: ['Tasks'])]
    public function taskComments(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $comments = $this->commentRepo->findByTask($taskId);
            $data = array_map(fn($c) => [
                'id' => $c->id,
                'task_id' => $c->task_id,
                'user_id' => $c->user_id,
                'is_ai' => $c->is_ai,
                'body' => $c->body,
                'parent_id' => $c->parent_id,
                'created_at' => $c->created_at instanceof \DateTimeInterface ? $c->created_at->format('c') : $c->created_at,
                'updated_at' => $c->updated_at instanceof \DateTimeInterface ? $c->updated_at->format('c') : $c->updated_at,
            ], $comments);
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('COMMENT_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/tasks/{taskId}/comments', name: 'tasks.comments.store', middleware: ['auth'], summary: 'Add comment', tags: ['Tasks'])]
    public function addTaskComment(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $body = trim($data['body'] ?? '');
            if (!$body)
                return $this->json(['error' => 'Comment body is required.'], 422);

            $now = new \DateTimeImmutable();
            $comment = new \App\Entity\TaskComment();
            $comment->task_id = $taskId;
            $comment->user_id = (int) $userId;
            $comment->body = $body;
            $comment->parent_id = isset($data['parent_id']) ? (int) $data['parent_id'] : null;
            $comment->is_ai = false;
            $comment->created_at = $now;
            $comment->updated_at = $now;
            $this->commentRepo->save($comment);

            return $this->json([
                'data' => [
                    'id' => $comment->id,
                    'task_id' => $comment->task_id,
                    'user_id' => $comment->user_id,
                    'is_ai' => $comment->is_ai,
                    'body' => $comment->body,
                    'parent_id' => $comment->parent_id,
                    'created_at' => $comment->created_at->format('c'),
                    'updated_at' => $comment->updated_at->format('c'),
                ],
            ], 201);
        } catch (\Throwable $e) {
            error_log('COMMENT_CREATE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'PUT', path: '/api/v1/comments/{commentId}', name: 'comments.update', middleware: ['auth'], summary: 'Edit comment', tags: ['Tasks'])]
    public function editComment(ServerRequestInterface $request, int $commentId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $comment = $this->commentRepo->find($commentId);
            if (!$comment)
                return $this->json(['error' => 'Comment not found.'], 404);
            if ($comment->user_id !== (int) $userId)
                return $this->json(['error' => 'You can only edit your own comments.'], 403);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $body = trim($data['body'] ?? '');
            if (!$body)
                return $this->json(['error' => 'Comment body is required.'], 422);

            $comment->body = $body;
            $comment->updated_at = new \DateTimeImmutable();
            $this->commentRepo->save($comment);

            return $this->json([
                'data' => [
                    'id' => $comment->id,
                    'body' => $comment->body,
                    'updated_at' => $comment->updated_at->format('c'),
                ],
            ]);
        } catch (\Throwable $e) {
            error_log('COMMENT_EDIT ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'DELETE', path: '/api/v1/comments/{commentId}', name: 'comments.destroy', middleware: ['auth'], summary: 'Delete comment', tags: ['Tasks'])]
    public function deleteComment(ServerRequestInterface $request, int $commentId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $comment = $this->commentRepo->find($commentId);
            if (!$comment)
                return $this->json(['error' => 'Comment not found.'], 404);

            $this->commentRepo->delete($comment);
            return $this->json(['message' => 'Comment deleted.']);
        } catch (\Throwable $e) {
            error_log('COMMENT_DELETE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Task Labels (attach/detach)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'POST', path: '/api/v1/tasks/{taskId}/labels/{labelId}', name: 'tasks.labels.attach', middleware: ['auth'], summary: 'Attach label', tags: ['Tasks'])]
    public function attachLabel(ServerRequestInterface $request, int $taskId, int $labelId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $pdo = $this->taskRepo->getPdo();
            $pdo->prepare('INSERT INTO task_label (task_id, label_id) VALUES (?, ?) ON CONFLICT DO NOTHING')
                ->execute([$taskId, $labelId]);
            return $this->json(['message' => 'Label attached.']);
        } catch (\Throwable $e) {
            error_log('LABEL_ATTACH ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'DELETE', path: '/api/v1/tasks/{taskId}/labels/{labelId}', name: 'tasks.labels.detach', middleware: ['auth'], summary: 'Detach label', tags: ['Tasks'])]
    public function detachLabel(ServerRequestInterface $request, int $taskId, int $labelId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $pdo = $this->taskRepo->getPdo();
            $pdo->prepare('DELETE FROM task_label WHERE task_id = ? AND label_id = ?')
                ->execute([$taskId, $labelId]);
            return $this->json(['message' => 'Label detached.']);
        } catch (\Throwable $e) {
            error_log('LABEL_DETACH ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Time Entries
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}/time-entries', name: 'tasks.time.index', middleware: ['auth'], summary: 'List time entries', tags: ['Tasks'])]
    public function timeEntries(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $entries = $this->timeRepo->findByTask($taskId);
            $data = array_map(fn($e) => [
                'id' => $e->id,
                'task_id' => $e->task_id,
                'user_id' => $e->user_id,
                'duration_minutes' => $e->duration_minutes,
                'description' => $e->description,
                'logged_at' => $e->logged_at instanceof \DateTimeInterface ? $e->logged_at->format('Y-m-d') : $e->logged_at,
                'created_at' => $e->created_at instanceof \DateTimeInterface ? $e->created_at->format('c') : $e->created_at,
            ], $entries);
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('TIME_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/tasks/{taskId}/time-entries', name: 'tasks.time.store', middleware: ['auth'], summary: 'Log time', tags: ['Tasks'])]
    public function logTime(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $duration = (int) ($data['duration_minutes'] ?? 0);
            if ($duration <= 0)
                return $this->json(['error' => 'Duration must be positive.'], 422);

            $entry = new \App\Entity\TimeEntry();
            $entry->task_id = $taskId;
            $entry->user_id = (int) $userId;
            $entry->duration_minutes = $duration;
            $entry->description = trim($data['description'] ?? '') ?: null;
            $entry->logged_at = !empty($data['logged_at']) ? new \DateTimeImmutable($data['logged_at']) : new \DateTimeImmutable();
            $entry->created_at = new \DateTimeImmutable();
            $this->timeRepo->save($entry);

            return $this->json([
                'data' => [
                    'id' => $entry->id,
                    'duration_minutes' => $entry->duration_minutes,
                    'description' => $entry->description,
                    'logged_at' => $entry->logged_at->format('Y-m-d'),
                ],
            ], 201);
        } catch (\Throwable $e) {
            error_log('TIME_LOG ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Labels (keep existing routes)
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/labels', name: 'labels.index', summary: 'List labels', tags: ['Tasks'])]
    public function labels(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json($this->labelRepo->findByOrganization($orgId));
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/labels', name: 'labels.store', summary: 'Create label', tags: ['Tasks'])]
    public function createLabel(ServerRequestInterface $request, int $orgId): Response
    {
        return $this->json(['message' => 'Created'], 201);
    }

    // ─────────────────────────────────────────────────
    //  My Tasks
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/me/tasks', name: 'me.tasks', middleware: ['auth'], summary: 'My assigned tasks', tags: ['Tasks'])]
    public function myTasks(ServerRequestInterface $request): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $tasks = $this->taskRepo->findByAssignee((int) $userId);
            $data = array_map(fn($t) => $this->serializeTask($t), $tasks);
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('MY_TASKS ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Subtasks
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}/children', name: 'tasks.children', middleware: ['auth'], summary: 'List subtasks', tags: ['Tasks'])]
    public function listChildren(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $children = $this->taskRepo->findBy(['parent_id' => $taskId]);
            $children = array_filter($children, fn($c) => !$c->deleted_at);
            $data = array_values(array_map(fn($t) => $this->serializeTask($t), $children));
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('LIST_CHILDREN ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/tasks/{taskId}/children', name: 'tasks.children.create', middleware: ['auth'], summary: 'Create subtask', tags: ['Tasks'])]
    public function createChild(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $parent = $this->taskRepo->find($taskId);
            if (!$parent)
                return $this->json(['error' => 'Parent task not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $title = trim($data['title'] ?? '');
            if (!$title)
                return $this->json(['error' => 'Subtask title is required.'], 422);

            // Increment project counter atomically (matching createProjectTask logic)
            $pdo = $this->taskRepo->getPdo();
            // Resolve project_id from board
            $board = $this->boardRepo->find($parent->board_id);
            $number = 0;
            if ($board && $board->project_id) {
                $stmt = $pdo->prepare('UPDATE projects SET task_counter = task_counter + 1 WHERE id = ? RETURNING task_counter');
                $stmt->execute([$board->project_id]);
                $number = (int) $stmt->fetchColumn();
            }
            if (!$number) {
                // Fallback to board counter
                $stmt = $pdo->prepare('UPDATE boards SET task_counter = task_counter + 1 WHERE id = ? RETURNING task_counter');
                $stmt->execute([$parent->board_id]);
                $number = (int) $stmt->fetchColumn();
            }

            $now = new \DateTimeImmutable();
            $child = new \App\Entity\Task();
            $child->board_id = $parent->board_id;
            $child->sprint_id = $parent->sprint_id;
            $child->number = $number;
            $child->title = $title;
            $child->description = $data['description'] ?? null;
            $child->type = $data['type'] ?? 'task';
            $child->status = $data['status'] ?? 'backlog';
            $child->priority = $data['priority'] ?? $parent->priority;
            $child->story_points = isset($data['story_points']) ? (string) $data['story_points'] : null;
            $child->assignee_id = isset($data['assignee_id']) ? (int) $data['assignee_id'] : null;
            $child->reporter_id = (int) $userId;
            $child->parent_id = $parent->id;
            $child->created_at = $now;
            $child->updated_at = $now;
            $this->taskRepo->save($child);

            return $this->json(['data' => $this->serializeTask($child)], 201);
        } catch (\Throwable $e) {
            error_log('CREATE_CHILD ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'PUT', path: '/api/v1/tasks/{taskId}/parent', name: 'tasks.setParent', middleware: ['auth'], summary: 'Set parent task', tags: ['Tasks'])]
    public function setParent(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $parentId = $data['parent_id'] ?? null;

            if ($parentId !== null) {
                $parent = $this->taskRepo->find((int) $parentId);
                if (!$parent)
                    return $this->json(['error' => 'Parent task not found.'], 404);

                // Prevent circular reference
                if ($parent->parent_id === $task->id)
                    return $this->json(['error' => 'Circular parent reference.'], 422);

                // Prevent self-parent
                if ((int) $parentId === $task->id)
                    return $this->json(['error' => 'Task cannot be its own parent.'], 422);

                $task->parent_id = (int) $parentId;
            } else {
                $task->parent_id = null;
            }

            $task->updated_at = new \DateTimeImmutable();
            $this->taskRepo->save($task);

            return $this->json(['data' => $this->serializeTask($task)]);
        } catch (\Throwable $e) {
            error_log('SET_PARENT ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'DELETE', path: '/api/v1/tasks/{taskId}/parent', name: 'tasks.removeParent', middleware: ['auth'], summary: 'Remove parent', tags: ['Tasks'])]
    public function removeParent(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $task->parent_id = null;
            $task->updated_at = new \DateTimeImmutable();
            $this->taskRepo->save($task);

            return $this->json(['data' => $this->serializeTask($task)]);
        } catch (\Throwable $e) {
            error_log('REMOVE_PARENT ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Attachments
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}/attachments', name: 'tasks.attachments', middleware: ['auth'], summary: 'List attachments', tags: ['Tasks'])]
    public function listAttachments(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $attachments = $this->attachmentRepo->findByEntity('task', $taskId);
            return $this->json(['data' => array_map(fn($a) => $a->toArray(), $attachments)]);
        } catch (\Throwable $e) {
            error_log('LIST_ATTACHMENTS ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/tasks/{taskId}/attachments', name: 'tasks.attachments.upload', middleware: ['auth'], summary: 'Upload attachment', tags: ['Tasks'])]
    public function uploadAttachment(ServerRequestInterface $request, int $taskId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $task = $this->taskRepo->find($taskId);
            if (!$task)
                return $this->json(['error' => 'Task not found.'], 404);

            $files = $request->getUploadedFiles();
            $raw = $files['file'] ?? null;

            // Resolve the file — could be PSR-7 UploadedFileInterface or raw $_FILES array
            $origName = 'unnamed';
            $fileSize = 0;
            $mimeType = 'application/octet-stream';
            $tmpPath = null;

            if (is_array($raw) && isset($raw['tmp_name'])) {
                // Raw $_FILES array
                if ($raw['error'] !== UPLOAD_ERR_OK)
                    return $this->json(['error' => 'File upload failed (error code: ' . $raw['error'] . ')'], 422);
                $origName = $raw['name'] ?? 'unnamed';
                $fileSize = $raw['size'] ?? 0;
                $mimeType = $raw['type'] ?? 'application/octet-stream';
                $tmpPath = $raw['tmp_name'];
            } elseif (is_object($raw) && method_exists($raw, 'getError')) {
                // PSR-7 UploadedFileInterface
                if ($raw->getError() !== UPLOAD_ERR_OK)
                    return $this->json(['error' => 'File upload failed.'], 422);
                $origName = $raw->getClientFilename() ?? 'unnamed';
                $fileSize = $raw->getSize() ?? 0;
                $mimeType = $raw->getClientMediaType() ?? 'application/octet-stream';
                $tmpPath = null; // will use moveTo
            } else {
                return $this->json(['error' => 'No file provided.'], 422);
            }

            $ext = pathinfo($origName, PATHINFO_EXTENSION);
            $safeName = time() . '_' . bin2hex(random_bytes(8)) . ($ext ? '.' . $ext : '');

            $uploadDir = '/app/storage/attachments/' . $taskId;
            if (!is_dir($uploadDir))
                mkdir($uploadDir, 0775, true);

            $filePath = $uploadDir . '/' . $safeName;

            if ($tmpPath) {
                // Raw file: move from temp
                if (!move_uploaded_file($tmpPath, $filePath) && !rename($tmpPath, $filePath)) {
                    return $this->json(['error' => 'Failed to move uploaded file.'], 500);
                }
            } else {
                // PSR-7: use moveTo
                $raw->moveTo($filePath);
            }

            $attachment = new \App\Entity\Attachment();
            $attachment->entity_type = 'task';
            $attachment->entity_id = $taskId;
            $attachment->uploaded_by = (int) $userId;
            $attachment->file_name = $origName;
            $attachment->file_path = $filePath;
            $attachment->file_url = '/storage/attachments/' . $taskId . '/' . $safeName;
            $attachment->file_size = $fileSize;
            $attachment->mime_type = $mimeType;
            $attachment->created_at = new \DateTimeImmutable();
            $this->attachmentRepo->save($attachment);

            return $this->json(['data' => $attachment->toArray()], 201);
        } catch (\Throwable $e) {
            error_log('UPLOAD_ATTACHMENT ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'DELETE', path: '/api/v1/attachments/{attachmentId}', name: 'tasks.attachments.delete', middleware: ['auth'], summary: 'Delete attachment', tags: ['Tasks'])]
    public function deleteAttachment(ServerRequestInterface $request, int $attachmentId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $attachment = $this->attachmentRepo->find($attachmentId);
            if (!$attachment)
                return $this->json(['error' => 'Attachment not found.'], 404);

            // Delete file from disk
            if (file_exists($attachment->file_path)) {
                unlink($attachment->file_path);
            }

            $this->attachmentRepo->delete($attachment);
            return $this->json(['message' => 'Attachment deleted.']);
        } catch (\Throwable $e) {
            error_log('DELETE_ATTACHMENT ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    // ─────────────────────────────────────────────────
    //  Static file serving for /storage/
    // ─────────────────────────────────────────────────

    #[Route(methods: 'GET', path: '/storage/attachments/{taskId}/{filename}', name: 'storage.serve', summary: 'Serve storage files')]
    public function serveStorageFile(ServerRequestInterface $request, int $taskId, string $filename): Response
    {
        // Sanitize filename to prevent path traversal
        $filename = basename($filename);
        $filePath = '/app/storage/attachments/' . $taskId . '/' . $filename;

        if (!is_file($filePath)) {
            return $this->json(['error' => 'File not found.'], 404);
        }

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $mimeTypes = [
            'png' => 'image/png',
            'jpg' => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif' => 'image/gif',
            'webp' => 'image/webp',
            'svg' => 'image/svg+xml',
            'pdf' => 'application/pdf',
            'zip' => 'application/zip',
            'txt' => 'text/plain',
            'csv' => 'text/csv',
            'json' => 'application/json',
            'doc' => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls' => 'application/vnd.ms-excel',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        $contentType = $mimeTypes[$ext] ?? 'application/octet-stream';

        $content = file_get_contents($filePath);
        $body = \MonkeysLegion\Http\Message\Stream::createFromString($content);
        return new Response($body, 200, [
            'Content-Type' => $contentType,
            'Content-Length' => (string) strlen($content),
            'Cache-Control' => 'public, max-age=86400',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Authorization, Content-Type',
        ]);
    }
}
