<?php
declare(strict_types=1);

namespace App\Controller;

use App\Repository\TaskLabelRepository;
use App\Repository\OrganizationMemberRepository;
use MonkeysLegion\Router\Attributes\Route;
use Psr\Http\Message\ServerRequestInterface;
use MonkeysLegion\Http\Message\Response;

class LabelController extends AbstractController
{
    public function __construct(
        private TaskLabelRepository $labelRepo,
        private OrganizationMemberRepository $memberRepo,
    ) {
    }

    #[Route(methods: 'GET', path: '/api/v1/organizations/{orgId}/task-labels', name: 'taskLabels.index', middleware: ['auth'], summary: 'List labels', tags: ['Labels'])]
    public function index(ServerRequestInterface $request, int $orgId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $labels = $this->labelRepo->findByOrganization($orgId);
            $data = array_map(fn($l) => [
                'id' => $l->id,
                'name' => $l->name,
                'color' => $l->color,
                'created_at' => $l->created_at instanceof \DateTimeInterface ? $l->created_at->format('c') : $l->created_at,
            ], $labels);
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('LABEL_INDEX ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'POST', path: '/api/v1/organizations/{orgId}/task-labels', name: 'taskLabels.store', middleware: ['auth'], summary: 'Create label', tags: ['Labels'])]
    public function store(ServerRequestInterface $request, int $orgId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $data = json_decode((string) $request->getBody(), true) ?? [];
            $name = trim($data['name'] ?? '');
            $color = trim($data['color'] ?? '#6366F1');

            if (!$name)
                return $this->json(['error' => 'Label name is required.'], 422);
            if (strlen($name) > 50)
                return $this->json(['error' => 'Label name must be 50 characters or less.'], 422);

            // Validate hex color
            if (!preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
                $color = '#6366F1';
            }

            // Check for duplicate name in org
            $existing = $this->labelRepo->findByOrganization($orgId);
            foreach ($existing as $l) {
                if (strtolower($l->name) === strtolower($name)) {
                    return $this->json(['error' => 'A label with this name already exists.'], 409);
                }
            }

            $label = new \App\Entity\TaskLabel();
            $label->organization_id = $orgId;
            $label->name = $name;
            $label->color = $color;
            $label->created_at = new \DateTimeImmutable();
            $this->labelRepo->save($label);

            return $this->json([
                'data' => [
                    'id' => $label->id,
                    'name' => $label->name,
                    'color' => $label->color,
                ],
            ], 201);
        } catch (\Throwable $e) {
            error_log('LABEL_STORE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    #[Route(methods: 'PUT', path: '/api/v1/organizations/{orgId}/task-labels/{labelId}', name: 'taskLabels.update', middleware: ['auth'], summary: 'Update label', tags: ['Labels'])]
    public function update(ServerRequestInterface $request, int $orgId, int $labelId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $label = $this->labelRepo->find($labelId);
            if (!$label || $label->organization_id !== $orgId) {
                return $this->json(['error' => 'Label not found.'], 404);
            }

            $data = json_decode((string) $request->getBody(), true) ?? [];

            if (isset($data['name'])) {
                $name = trim($data['name']);
                if (!$name)
                    return $this->json(['error' => 'Label name is required.'], 422);
                if (strlen($name) > 50)
                    return $this->json(['error' => 'Label name must be 50 characters or less.'], 422);

                // Check for duplicate
                $existing = $this->labelRepo->findByOrganization($orgId);
                foreach ($existing as $l) {
                    if ($l->id !== $labelId && strtolower($l->name) === strtolower($name)) {
                        return $this->json(['error' => 'A label with this name already exists.'], 409);
                    }
                }
                $label->name = $name;
            }

            if (isset($data['color'])) {
                $color = trim($data['color']);
                if (preg_match('/^#[0-9A-Fa-f]{6}$/', $color)) {
                    $label->color = $color;
                }
            }

            $this->labelRepo->save($label);

            return $this->json([
                'data' => [
                    'id' => $label->id,
                    'name' => $label->name,
                    'color' => $label->color,
                ],
            ]);
        } catch (\Throwable $e) {
            error_log('LABEL_UPDATE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    #[Route(methods: 'DELETE', path: '/api/v1/organizations/{orgId}/task-labels/{labelId}', name: 'taskLabels.destroy', middleware: ['auth'], summary: 'Delete label', tags: ['Labels'])]
    public function destroy(ServerRequestInterface $request, int $orgId, int $labelId): Response
    {
        $userId = $this->userId($request);
        if (!$userId)
            return $this->json(['error' => 'Authentication required.'], 401);

        try {
            $label = $this->labelRepo->find($labelId);
            if (!$label || $label->organization_id !== $orgId) {
                return $this->json(['error' => 'Label not found.'], 404);
            }

            $this->labelRepo->delete($label);

            return $this->json(['message' => 'Label deleted.']);
        } catch (\Throwable $e) {
            error_log('LABEL_DELETE ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }
}
