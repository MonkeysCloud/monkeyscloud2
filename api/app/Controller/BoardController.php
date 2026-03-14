<?php
declare(strict_types=1);

namespace App\Controller;

use App\Repository\BoardRepository;
use MonkeysLegion\Router\Attributes\Route;
use Psr\Http\Message\ServerRequestInterface;
use MonkeysLegion\Http\Message\Response;

class BoardController extends AbstractController
{
    public function __construct(
        private BoardRepository $boardRepo,
    ) {
    }

    /** Get or auto-create the default board for a project */
    private function getOrCreateBoard(int $projectId, int $orgId): \App\Entity\Board
    {
        $boards = $this->boardRepo->findBy(['project_id' => $projectId]);
        if (!empty($boards))
            return $boards[0];

        $board = new \App\Entity\Board();
        $board->project_id = $projectId;
        $board->organization_id = $orgId;
        $board->name = 'Default Board';
        $board->type = 'kanban';
        $board->prefix = 'TSK';
        $board->task_counter = 0;
        $board->is_default = true;
        $board->columns = ['To Do', 'In Progress', 'Review', 'Done'];
        $board->created_at = new \DateTimeImmutable();
        $board->updated_at = new \DateTimeImmutable();
        $this->boardRepo->save($board);
        return $board;
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/projects/{projectId}/board', name: 'projectBoard.show', middleware: ['auth'], summary: 'Get project board', tags: ['Boards'])]
    public function show(ServerRequestInterface $request, int $orgId, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $board = $this->getOrCreateBoard($projectId, $orgId);
            return $this->json([
                'data' => [
                    'id' => $board->id,
                    'name' => $board->name,
                    'type' => $board->type,
                    'columns' => $board->columns ?? ['To Do', 'In Progress', 'Review', 'Done'],
                    'done_columns' => $board->done_columns ?? ['Done'],
                    'prefix' => $board->prefix,
                    'is_default' => $board->is_default,
                ],
            ]);
        } catch (\Throwable $e) {
            error_log('BOARD_SHOW ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/projects/{projectId}/board', name: 'projectBoard.update', middleware: ['auth'], summary: 'Update project board', tags: ['Boards'])]
    public function update(ServerRequestInterface $request, int $orgId, int $projectId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $board = $this->getOrCreateBoard($projectId, $orgId);
            $data = json_decode((string) $request->getBody(), true) ?? [];

            if (isset($data['name'])) {
                $name = trim($data['name']);
                if ($name)
                    $board->name = $name;
            }

            if (isset($data['columns']) && is_array($data['columns'])) {
                // Validate: non-empty, unique names, max 10 columns
                $cols = array_values(array_filter(array_map('trim', $data['columns'])));
                if (empty($cols)) {
                    return $this->json(['error' => 'At least one column is required.'], 422);
                }
                if (count($cols) > 10) {
                    return $this->json(['error' => 'Maximum 10 columns allowed.'], 422);
                }
                if (count($cols) !== count(array_unique(array_map('strtolower', $cols)))) {
                    return $this->json(['error' => 'Column names must be unique.'], 422);
                }
                $board->columns = $cols;
            }

            if (isset($data['done_columns']) && is_array($data['done_columns'])) {
                $board->done_columns = array_values(array_filter(array_map('trim', $data['done_columns'])));
            }

            if (isset($data['type'])) {
                if (in_array($data['type'], ['kanban', 'scrum'])) {
                    $board->type = $data['type'];
                }
            }

            if (isset($data['prefix'])) {
                $prefix = strtoupper(trim($data['prefix']));
                if ($prefix && strlen($prefix) <= 10) {
                    $board->prefix = $prefix;
                }
            }

            $board->updated_at = new \DateTimeImmutable();
            $this->boardRepo->save($board);

            return $this->json([
                'data' => [
                    'id' => $board->id,
                    'name' => $board->name,
                    'type' => $board->type,
                    'columns' => $board->columns,
                    'done_columns' => $board->done_columns ?? ['Done'],
                    'prefix' => $board->prefix,
                    'is_default' => $board->is_default,
                ],
            ]);
        } catch (\Throwable $e) {
            error_log('BOARD_UPDATE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }
}
