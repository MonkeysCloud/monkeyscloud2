<?php
declare(strict_types=1);

namespace App\Controller;

use App\Repository\SprintRepository;
use App\Repository\BoardRepository;
use App\Repository\ProjectRepository;
use App\Repository\TaskRepository;
use MonkeysLegion\Router\Attributes\Route;
use Psr\Http\Message\ServerRequestInterface;
use MonkeysLegion\Http\Message\Response;

class SprintController extends AbstractController
{
    public function __construct(
        private SprintRepository $sprintRepo,
        private BoardRepository $boardRepo,
        private ProjectRepository $projectRepo,
        private TaskRepository $taskRepo,
    ) {
    }

    /** Get or auto-create the default board for a project */
    private function getOrCreateBoard(int $projectId): ?\App\Entity\Board
    {
        $boards = $this->boardRepo->findBy(['project_id' => $projectId]);
        if (!empty($boards))
            return $boards[0];

        // Auto-create a default board
        $board = new \App\Entity\Board();
        $board->project_id = $projectId;
        $board->name = 'Default Board';
        $board->type = 'scrum';
        $board->prefix = 'SPR';
        $board->task_counter = 0;
        $board->is_default = true;
        $board->columns = ['To Do', 'In Progress', 'Done'];
        $board->created_at = new \DateTimeImmutable();
        $board->updated_at = new \DateTimeImmutable();
        $this->boardRepo->save($board);
        return $board;
    }

    #[Route(methods: 'GET', path: '/api/v1/projects/{projectId}/sprints', name: 'projectSprints.index', middleware: ['auth'], summary: 'List sprints for project', tags: ['Sprints'])]
    public function index(ServerRequestInterface $request, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $board = $this->getOrCreateBoard($projectId);
            if (!$board)
                return $this->json(['data' => []]);

            $sprints = $this->sprintRepo->findByBoard($board->id);
            $data = array_map(fn($s) => [
                'id' => $s->id,
                'name' => $s->name,
                'goal' => $s->goal,
                'starts_at' => $s->starts_at instanceof \DateTimeInterface ? $s->starts_at->format('Y-m-d') : $s->starts_at,
                'ends_at' => $s->ends_at instanceof \DateTimeInterface ? $s->ends_at->format('Y-m-d') : $s->ends_at,
                'status' => $s->status,
                'velocity' => $s->velocity,
                'created_at' => $s->created_at instanceof \DateTimeInterface ? $s->created_at->format('c') : $s->created_at,
            ], $sprints);

            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('SPRINT_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/sprints', name: 'projectSprints.store', middleware: ['auth'], summary: 'Create sprint', tags: ['Sprints'])]
    public function store(ServerRequestInterface $request, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $data = json_decode((string) $request->getBody(), true) ?? [];
            $name = trim($data['name'] ?? '');
            $goal = trim($data['goal'] ?? '');
            $startsAt = $data['starts_at'] ?? '';
            $endsAt = $data['ends_at'] ?? '';

            if (!$name)
                return $this->json(['error' => 'Sprint name is required.'], 422);
            if (!$startsAt || !$endsAt)
                return $this->json(['error' => 'Start and end dates are required.'], 422);

            $startDate = new \DateTimeImmutable($startsAt);
            $endDate = new \DateTimeImmutable($endsAt);
            if ($endDate <= $startDate) {
                return $this->json(['error' => 'End date must be after start date.'], 422);
            }

            $board = $this->getOrCreateBoard($projectId);
            if (!$board)
                return $this->json(['error' => 'Could not resolve board.'], 500);

            $now = new \DateTimeImmutable();
            $sprint = new \App\Entity\Sprint();
            $sprint->board_id = $board->id;
            $sprint->name = $name;
            $sprint->goal = $goal ?: null;
            $sprint->starts_at = $startDate;
            $sprint->ends_at = $endDate;
            $sprint->status = 'planning';
            $sprint->created_at = $now;
            $sprint->updated_at = $now;
            $this->sprintRepo->save($sprint);

            return $this->json([
                'data' => [
                    'id' => $sprint->id,
                    'name' => $sprint->name,
                    'goal' => $sprint->goal,
                    'starts_at' => $sprint->starts_at->format('Y-m-d'),
                    'ends_at' => $sprint->ends_at->format('Y-m-d'),
                    'status' => $sprint->status,
                ],
            ], 201);
        } catch (\Throwable $e) {
            error_log('SPRINT_STORE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'PUT', path: '/api/v1/projects/{projectId}/sprints/{sprintId}', name: 'projectSprints.update', middleware: ['auth'], summary: 'Update sprint', tags: ['Sprints'])]
    public function update(ServerRequestInterface $request, int $projectId, int $sprintId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $sprint = $this->sprintRepo->find($sprintId);
            if (!$sprint)
                return $this->json(['error' => 'Sprint not found.'], 404);

            $data = json_decode((string) $request->getBody(), true) ?? [];

            if (isset($data['name'])) {
                $name = trim($data['name']);
                if ($name)
                    $sprint->name = $name;
            }
            if (array_key_exists('goal', $data)) {
                $sprint->goal = trim($data['goal'] ?? '') ?: null;
            }
            if (isset($data['starts_at'])) {
                $sprint->starts_at = new \DateTimeImmutable($data['starts_at']);
            }
            if (isset($data['ends_at'])) {
                $sprint->ends_at = new \DateTimeImmutable($data['ends_at']);
            }
            if (isset($data['status'])) {
                $allowed = ['planning', 'active', 'completed', 'cancelled'];
                if (in_array($data['status'], $allowed)) {
                    $sprint->status = $data['status'];
                }
            }
            if (isset($data['velocity'])) {
                $sprint->velocity = $data['velocity'];
            }

            $sprint->updated_at = new \DateTimeImmutable();
            $this->sprintRepo->save($sprint);

            return $this->json([
                'data' => [
                    'id' => $sprint->id,
                    'name' => $sprint->name,
                    'goal' => $sprint->goal,
                    'starts_at' => $sprint->starts_at instanceof \DateTimeInterface ? $sprint->starts_at->format('Y-m-d') : $sprint->starts_at,
                    'ends_at' => $sprint->ends_at instanceof \DateTimeInterface ? $sprint->ends_at->format('Y-m-d') : $sprint->ends_at,
                    'status' => $sprint->status,
                    'velocity' => $sprint->velocity,
                ],
            ]);
        } catch (\Throwable $e) {
            error_log('SPRINT_UPDATE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/projects/{projectId}/sprints/{sprintId}/complete', name: 'projectSprints.complete', middleware: ['auth'], summary: 'Complete sprint (Jira-like)', tags: ['Sprints'])]
    public function complete(ServerRequestInterface $request, int $projectId, int $sprintId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $sprint = $this->sprintRepo->find($sprintId);
            if (!$sprint)
                return $this->json(['error' => 'Sprint not found.'], 404);

            if ($sprint->status !== 'active')
                return $this->json(['error' => 'Only active sprints can be completed.'], 422);

            $data = json_decode((string) $request->getBody(), true) ?? [];
            $moveTo = $data['move_to'] ?? 'backlog'; // 'backlog' or 'next_sprint'
            $nextSprintId = isset($data['next_sprint_id']) ? (int) $data['next_sprint_id'] : null;
            $startNextSprint = (bool) ($data['start_next_sprint'] ?? false);
            $doneColumns = $data['done_columns'] ?? ['Done'];

            // Get all tasks in this sprint
            $sprintTasks = $this->taskRepo->findBySprint($sprintId);
            $sprintTasks = array_filter($sprintTasks, fn($t) => !$t->deleted_at);

            // Separate completed vs incomplete
            $completedTasks = [];
            $incompleteTasks = [];
            foreach ($sprintTasks as $task) {
                // Check if task status matches any done column (case-insensitive)
                $isDone = false;
                foreach ($doneColumns as $dc) {
                    if (strtolower($task->status) === strtolower($dc)) {
                        $isDone = true;
                        break;
                    }
                }
                if ($isDone) {
                    $completedTasks[] = $task;
                } else {
                    $incompleteTasks[] = $task;
                }
            }

            // Calculate velocity from completed tasks
            $velocity = 0;
            foreach ($completedTasks as $task) {
                $velocity += (float) ($task->story_points ?? 0);
            }

            // Move incomplete tasks using direct SQL (ORM save may not persist sprint_id changes)
            $pdo = $this->taskRepo->getPdo();
            $movedCount = 0;
            $incompleteIds = array_map(fn($t) => $t->id, $incompleteTasks);

            if (!empty($incompleteIds)) {
                $targetSprintId = ($moveTo === 'next_sprint' && $nextSprintId) ? $nextSprintId : null;
                $placeholders = implode(',', array_fill(0, count($incompleteIds), '?'));
                $sql = "UPDATE tasks SET sprint_id = ?, updated_at = NOW() WHERE id IN ($placeholders)";
                $params = array_merge([$targetSprintId], $incompleteIds);
                $stmt = $pdo->prepare($sql);
                $stmt->execute($params);
                $movedCount = count($incompleteIds);
                error_log("SPRINT_COMPLETE: Moved $movedCount tasks (IDs: " . implode(',', $incompleteIds) . ") to sprint_id=$targetSprintId");
            }

            // Mark sprint as completed using direct SQL too
            $stmtSprint = $pdo->prepare("UPDATE sprints SET status = 'completed', velocity = ?, updated_at = NOW() WHERE id = ?");
            $stmtSprint->execute([(string) $velocity, $sprintId]);

            // Optionally start next sprint
            $nextSprintStarted = false;
            if ($startNextSprint && $nextSprintId) {
                $nextSprint = $this->sprintRepo->find($nextSprintId);
                if ($nextSprint && $nextSprint->status === 'planning') {
                    $stmtNext = $pdo->prepare("UPDATE sprints SET status = 'active', updated_at = NOW() WHERE id = ?");
                    $stmtNext->execute([$nextSprintId]);
                    $nextSprintStarted = true;
                }
            }

            return $this->json([
                'data' => [
                    'sprint_id' => $sprint->id,
                    'status' => 'completed',
                    'completed_count' => count($completedTasks),
                    'moved_count' => $movedCount,
                    'move_to' => $moveTo,
                    'velocity' => $velocity,
                    'next_sprint_started' => $nextSprintStarted,
                ],
            ]);
        } catch (\Throwable $e) {
            error_log('SPRINT_COMPLETE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'DELETE', path: '/api/v1/projects/{projectId}/sprints/{sprintId}', name: 'projectSprints.destroy', middleware: ['auth'], summary: 'Delete sprint', tags: ['Sprints'])]
    public function destroy(ServerRequestInterface $request, int $projectId, int $sprintId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $sprint = $this->sprintRepo->find($sprintId);
            if (!$sprint)
                return $this->json(['error' => 'Sprint not found.'], 404);

            $this->sprintRepo->delete($sprint);
            return $this->json(['message' => 'Sprint deleted.']);
        } catch (\Throwable $e) {
            error_log('SPRINT_DELETE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }
}
