<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use App\Repository\BoardRepository;
use App\Repository\SprintRepository;
use App\Repository\TaskRepository;
use App\Repository\TaskCommentRepository;
use App\Repository\TimeEntryRepository;
use App\Repository\TaskLabelRepository;
use Psr\Http\Message\ServerRequestInterface;

final class TaskController
{
    public function __construct(
        private BoardRepository $boardRepo,
        private SprintRepository $sprintRepo,
        private TaskRepository $taskRepo,
        private TaskCommentRepository $commentRepo,
        private TimeEntryRepository $timeRepo,
        private TaskLabelRepository $labelRepo,
    ) {
    }

    // --- Boards ---

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

    // --- Sprints ---

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

    // --- Tasks ---

    #[Route(methods: 'GET', path: '/api/v1/boards/{boardId}/tasks', name: 'tasks.index', summary: 'List tasks', tags: ['Tasks'])]
    public function tasks(ServerRequestInterface $request, int $boardId): Response
    {
        $status = $request->getQueryParams()['status'] ?? null;
        return $this->json($this->taskRepo->findByBoard($boardId, $status));
    }

    #[Route(methods: 'POST', path: '/api/v1/boards/{boardId}/tasks', name: 'tasks.store', summary: 'Create task', tags: ['Tasks'])]
    public function createTask(ServerRequestInterface $request, int $boardId): Response
    {
        return $this->json(['message' => 'Created'], 201);
    }

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}', name: 'tasks.show', summary: 'Get task', tags: ['Tasks'])]
    public function showTask(ServerRequestInterface $request, int $taskId): Response
    {
        $task = $this->taskRepo->find($taskId);
        if (!$task)
            return $this->json(['error' => 'Not found'], 404);
        return $this->json($task);
    }

    #[Route(methods: 'PUT', path: '/api/v1/tasks/{taskId}', name: 'tasks.update', summary: 'Update task', tags: ['Tasks'])]
    public function updateTask(ServerRequestInterface $request, int $taskId): Response
    {
        return $this->json(['message' => 'Updated']);
    }

    #[Route(methods: 'DELETE', path: '/api/v1/tasks/{taskId}', name: 'tasks.destroy', summary: 'Delete task', tags: ['Tasks'])]
    public function deleteTask(ServerRequestInterface $request, int $taskId): Response
    {
        return $this->json(null, 204);
    }

    // --- Task Comments ---

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}/comments', name: 'tasks.comments.index', summary: 'List task comments', tags: ['Tasks'])]
    public function taskComments(ServerRequestInterface $request, int $taskId): Response
    {
        return $this->json($this->commentRepo->findByTask($taskId));
    }

    #[Route(methods: 'POST', path: '/api/v1/tasks/{taskId}/comments', name: 'tasks.comments.store', summary: 'Add comment', tags: ['Tasks'])]
    public function addTaskComment(ServerRequestInterface $request, int $taskId): Response
    {
        return $this->json(['message' => 'Added'], 201);
    }

    // --- Time Entries ---

    #[Route(methods: 'GET', path: '/api/v1/tasks/{taskId}/time-entries', name: 'tasks.time.index', summary: 'List time entries', tags: ['Tasks'])]
    public function timeEntries(ServerRequestInterface $request, int $taskId): Response
    {
        return $this->json($this->timeRepo->findByTask($taskId));
    }

    #[Route(methods: 'POST', path: '/api/v1/tasks/{taskId}/time-entries', name: 'tasks.time.store', summary: 'Log time', tags: ['Tasks'])]
    public function logTime(ServerRequestInterface $request, int $taskId): Response
    {
        return $this->json(['message' => 'Logged'], 201);
    }

    // --- Labels ---

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

    // --- My Tasks (user's assigned tasks across orgs) ---

    #[Route(methods: 'GET', path: '/api/v1/me/tasks', name: 'me.tasks', summary: 'My assigned tasks', tags: ['Tasks'])]
    public function myTasks(ServerRequestInterface $request): Response
    {
        $userId = $request->getAttribute('user_id');
        return $this->json($this->taskRepo->findByAssignee($userId));
    }

    private function json(mixed $data, int $status = 200): Response
    {
        $body = Stream::createFromString(json_encode($data));
        return new Response($body, $status, ['Content-Type' => 'application/json']);
    }
}
