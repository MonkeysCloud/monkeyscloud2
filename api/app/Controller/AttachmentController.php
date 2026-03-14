<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use MonkeysLegion\Router\Attributes\Middleware;
use App\Repository\AttachmentRepository;
use App\Entity\Attachment;
use Psr\Http\Message\ServerRequestInterface;

#[Middleware('auth')]
final class AttachmentController extends AbstractController
{
    private const ALLOWED_MIME = [
        // Images
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif',
        'image/svg+xml',
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.oasis.opendocument.text',
        'application/rtf',
        'text/plain',
        'text/csv',
        // Archives
        'application/zip',
        'application/gzip',
        'application/x-tar',
    ];

    private const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
    private const UPLOAD_DIR = '/app/public/files/attachments';
    private const PUBLIC_PATH = '/files/attachments';

    public function __construct(
        private AttachmentRepository $attachmentRepo,
    ) {
    }

    /* ------------------------------------------------------------------ */
    /*  POST /api/v1/attachments/upload  (multipart/form-data)             */
    /* ------------------------------------------------------------------ */
    #[Route(methods: 'POST', path: '/api/v1/attachments/upload', name: 'attachments.upload', summary: 'Upload files', tags: ['Attachments'])]
    public function upload(ServerRequestInterface $request): Response
    {
        try {
            $userId = $this->userId($request);
            if (!$userId) {
                return $this->json(['error' => 'Authentication required.'], 401);
            }

            $params = $request->getParsedBody() ?? [];
            $entityType = $params['entity_type'] ?? null;
            $entityId = $params['entity_id'] ?? null;

            if (!$entityType || !$entityId) {
                return $this->json(['error' => 'entity_type and entity_id are required.'], 422);
            }

            $uploadedFiles = $request->getUploadedFiles();
            $raw = $uploadedFiles['files'] ?? [];

            // Normalize uploaded files to a consistent array
            $files = [];
            if (is_array($raw) && isset($raw['name'])) {
                // Raw $_FILES format — multiple files via files[]
                $names = is_array($raw['name']) ? $raw['name'] : [$raw['name']];
                for ($i = 0; $i < count($names); $i++) {
                    $files[] = [
                        'name' => is_array($raw['name']) ? $raw['name'][$i] : $raw['name'],
                        'type' => is_array($raw['type']) ? $raw['type'][$i] : $raw['type'],
                        'tmp_name' => is_array($raw['tmp_name']) ? $raw['tmp_name'][$i] : $raw['tmp_name'],
                        'error' => is_array($raw['error']) ? $raw['error'][$i] : $raw['error'],
                        'size' => is_array($raw['size']) ? $raw['size'][$i] : $raw['size'],
                    ];
                }
            } elseif (is_array($raw)) {
                // PSR-7 UploadedFileInterface objects
                foreach ($raw as $item) {
                    if (is_object($item)) {
                        $files[] = [
                            'name' => $item->getClientFilename(),
                            'type' => $item->getClientMediaType(),
                            'tmp_name' => $item->getStream()->getMetadata('uri'),
                            'error' => $item->getError(),
                            'size' => $item->getSize(),
                            '_psr7' => $item,
                        ];
                    }
                }
            }

            if (empty($files)) {
                return $this->json(['error' => 'No files uploaded.'], 422);
            }

            // Prepare storage directory
            $dir = self::UPLOAD_DIR . "/{$entityType}/{$entityId}";
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            $saved = [];
            $sortOrder = 0;

            foreach ($files as $f) {
                if ((int) ($f['error'] ?? 1) !== UPLOAD_ERR_OK) {
                    continue;
                }

                $mime = $f['type'] ?? '';
                $size = (int) ($f['size'] ?? 0);
                $originalName = $f['name'] ?? 'unknown';
                $tmpName = $f['tmp_name'] ?? '';

                // Validate MIME
                if (!in_array($mime, self::ALLOWED_MIME, true)) {
                    continue;
                }

                // Validate size
                if ($size > self::MAX_FILE_SIZE) {
                    continue;
                }

                // Generate safe filename
                $ext = pathinfo($originalName, PATHINFO_EXTENSION);
                $safeName = bin2hex(random_bytes(16)) . ($ext ? ".{$ext}" : '');
                $filePath = "{$dir}/{$safeName}";
                $publicPath = self::PUBLIC_PATH . "/{$entityType}/{$entityId}/{$safeName}";
                // Build URL from the incoming request host (includes port, e.g. localhost:8000)
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost:8000';
                $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $fileUrl = $scheme . '://' . $host . $publicPath;

                // Move file
                if (isset($f['_psr7'])) {
                    $f['_psr7']->moveTo($filePath);
                } else {
                    move_uploaded_file($tmpName, $filePath);
                }

                // Create Attachment entity
                $attachment = new Attachment();
                $attachment->entity_type = $entityType;
                $attachment->entity_id = (int) $entityId;
                $attachment->uploaded_by = (int) $userId;
                $attachment->file_name = $originalName;
                $attachment->file_path = $filePath;
                $attachment->file_url = $fileUrl;
                $attachment->file_size = $size;
                $attachment->mime_type = $mime;
                $attachment->sort_order = $sortOrder++;
                $attachment->created_at = new \DateTimeImmutable();

                $this->attachmentRepo->save($attachment);

                $saved[] = $attachment->toArray();
            }

            if (empty($saved)) {
                return $this->json(['error' => 'No valid files were uploaded.'], 422);
            }

            return $this->json(['data' => $saved], 201);
        } catch (\Throwable $e) {
            error_log('ATTACHMENT_UPLOAD ERROR: ' . $e->getMessage());
            error_log('ATTACHMENT_UPLOAD TRACE: ' . $e->getTraceAsString());
            return $this->json(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  GET /api/v1/attachments/{entityType}/{entityId}                     */
    /* ------------------------------------------------------------------ */
    #[Route(methods: 'GET', path: '/api/v1/attachments/{entityType}/{entityId}', name: 'attachments.list', summary: 'List attachments for entity', tags: ['Attachments'])]
    public function list(ServerRequestInterface $request, string $entityType, int $entityId): Response
    {
        try {
            $attachments = $this->attachmentRepo->findByEntity($entityType, $entityId);
            $data = array_map(fn(Attachment $a) => $a->toArray(), $attachments);
            return $this->json(['data' => $data]);
        } catch (\Throwable $e) {
            error_log('ATTACHMENT_LIST ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Internal server error.'], 500);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  DELETE /api/v1/attachments/{id}                                     */
    /* ------------------------------------------------------------------ */
    #[Route(methods: 'DELETE', path: '/api/v1/attachments/{id}', name: 'attachments.delete', summary: 'Delete attachment', tags: ['Attachments'])]
    public function delete(ServerRequestInterface $request, int $id): Response
    {
        $userId = $this->userId($request);
        if (!$userId) {
            return $this->json(['error' => 'Authentication required.'], 401);
        }

        $attachment = $this->attachmentRepo->find($id);
        if (!$attachment) {
            return $this->json(['error' => 'Attachment not found.'], 404);
        }

        // Only the uploader can delete
        if ($attachment->uploaded_by !== (int) $userId) {
            return $this->json(['error' => 'Forbidden.'], 403);
        }

        // Delete file from disk
        if (file_exists($attachment->file_path)) {
            unlink($attachment->file_path);
        }

        // Delete DB record
        $this->attachmentRepo->delete($attachment);

        return $this->json(null, 204);
    }

    /* ------------------------------------------------------------------ */
    /*  GET /api/v1/attachments/download/{id}                               */
    /* ------------------------------------------------------------------ */
    #[Route(methods: 'GET', path: '/api/v1/attachments/download/{id}', name: 'attachments.download', summary: 'Download attachment', tags: ['Attachments'])]
    public function download(ServerRequestInterface $request, int $id): Response
    {
        $attachment = $this->attachmentRepo->find($id);
        if (!$attachment || !file_exists($attachment->file_path)) {
            return $this->json(['error' => 'File not found.'], 404);
        }

        $stream = new Stream(fopen($attachment->file_path, 'rb'));
        return new Response(
            $stream,
            200,
            [
                'Content-Type' => $attachment->mime_type ?: 'application/octet-stream',
                'Content-Disposition' => 'attachment; filename="' . addslashes($attachment->file_name) . '"',
                'Content-Length' => (string) filesize($attachment->file_path),
                'Access-Control-Allow-Origin' => '*',
            ]
        );
    }
}
