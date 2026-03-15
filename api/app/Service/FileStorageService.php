<?php
declare(strict_types=1);

namespace App\Service;

/**
 * Uploads files to Google Cloud Storage using the JSON API.
 *
 * Authentication:
 *  - In GKE: Workload Identity (metadata server provides access tokens)
 *  - Local:  Falls back to local filesystem storage via /app/public/
 *
 * Env vars:
 *  - GCS_BUCKET       Bucket name  (default: monkeyscloud-uploads)
 *  - GCS_PUBLIC_URL   Optional CDN prefix; defaults to https://storage.googleapis.com/{bucket}
 *  - STORAGE_DRIVER   "gcs" | "local" (default: auto-detect)
 */
final class FileStorageService
{
    private string $bucket;
    private string $publicUrl;
    private string $driver;

    public function __construct()
    {
        $this->bucket    = $_ENV['GCS_BUCKET'] ?? getenv('GCS_BUCKET') ?: 'monkeyscloud-uploads';
        $this->publicUrl = rtrim(
            $_ENV['GCS_PUBLIC_URL'] ?? getenv('GCS_PUBLIC_URL')
                ?: "https://storage.googleapis.com/{$this->bucket}",
            '/'
        );

        $configured = $_ENV['STORAGE_DRIVER'] ?? getenv('STORAGE_DRIVER') ?: '';
        if ($configured !== '') {
            $this->driver = $configured;
        } else {
            // Auto-detect: if metadata server is reachable, use GCS
            $this->driver = $this->hasMetadataServer() ? 'gcs' : 'local';
        }
    }

    /**
     * Upload a file.
     *
     * @param  string $objectPath  e.g. "avatars/user_42_1710000000.jpg"
     * @param  string $localFile   Absolute path to the temp file
     * @param  string $contentType MIME type
     * @return string              Public URL of the uploaded file
     */
    public function upload(string $objectPath, string $localFile, string $contentType = 'application/octet-stream'): string
    {
        if ($this->driver === 'local') {
            return $this->uploadLocal($objectPath, $localFile);
        }

        return $this->uploadGcs($objectPath, $localFile, $contentType);
    }

    /**
     * Delete a file by its object path or full URL.
     */
    public function delete(string $pathOrUrl): void
    {
        $objectPath = $this->extractObjectPath($pathOrUrl);
        if ($objectPath === '') {
            return;
        }

        if ($this->driver === 'local') {
            $this->deleteLocal($objectPath);
            return;
        }

        $this->deleteGcs($objectPath);
    }

    /**
     * Get the public URL for an object path.
     */
    public function url(string $objectPath): string
    {
        if ($this->driver === 'local') {
            return '/files/' . ltrim($objectPath, '/');
        }
        return $this->publicUrl . '/' . ltrim($objectPath, '/');
    }

    // ──────────────────────────────────────────────────────────────
    // GCS implementation
    // ──────────────────────────────────────────────────────────────

    private function uploadGcs(string $objectPath, string $localFile, string $contentType): string
    {
        $token = $this->getAccessToken();
        $encodedName = rawurlencode($objectPath);

        $url = "https://storage.googleapis.com/upload/storage/v1/b/{$this->bucket}/o"
             . "?uploadType=media&name={$encodedName}";

        $fileContents = file_get_contents($localFile);
        if ($fileContents === false) {
            throw new \RuntimeException("Cannot read file: {$localFile}");
        }

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $fileContents,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer {$token}",
                "Content-Type: {$contentType}",
            ],
        ]);

        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($body === false || $httpCode < 200 || $httpCode >= 300) {
            throw new \RuntimeException("GCS upload failed (HTTP {$httpCode}): {$curlErr} — {$body}");
        }

        // Make the object publicly readable
        $this->makePublic($objectPath, $token);

        return $this->publicUrl . '/' . $objectPath;
    }

    private function makePublic(string $objectPath, string $token): void
    {
        $encodedName = rawurlencode($objectPath);
        $url = "https://storage.googleapis.com/storage/v1/b/{$this->bucket}/o/{$encodedName}/acl";

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode([
                'entity' => 'allUsers',
                'role'   => 'READER',
            ]),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 10,
            CURLOPT_HTTPHEADER     => [
                "Authorization: Bearer {$token}",
                "Content-Type: application/json",
            ],
        ]);
        curl_exec($ch);
        curl_close($ch);
    }

    private function deleteGcs(string $objectPath): void
    {
        try {
            $token = $this->getAccessToken();
            $encodedName = rawurlencode($objectPath);
            $url = "https://storage.googleapis.com/storage/v1/b/{$this->bucket}/o/{$encodedName}";

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_CUSTOMREQUEST  => 'DELETE',
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT        => 10,
                CURLOPT_HTTPHEADER     => [
                    "Authorization: Bearer {$token}",
                ],
            ]);
            curl_exec($ch);
            curl_close($ch);
        } catch (\Throwable $e) {
            error_log("GCS_DELETE ERROR: {$e->getMessage()}");
        }
    }

    /**
     * Get an OAuth2 access token from the GKE metadata server (Workload Identity).
     */
    private function getAccessToken(): string
    {
        static $cached = null;
        static $expiry = 0;

        if ($cached && time() < $expiry - 60) {
            return $cached;
        }

        $url = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 5,
            CURLOPT_HTTPHEADER     => ['Metadata-Flavor: Google'],
        ]);
        $body = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || !$body) {
            throw new \RuntimeException('Failed to get GCS access token from metadata server');
        }

        $data = json_decode($body, true);
        $cached = $data['access_token'] ?? '';
        $expiry = time() + ($data['expires_in'] ?? 3600);

        if (!$cached) {
            throw new \RuntimeException('Empty access token from metadata server');
        }

        return $cached;
    }

    // ──────────────────────────────────────────────────────────────
    // Local filesystem fallback
    // ──────────────────────────────────────────────────────────────

    private function uploadLocal(string $objectPath, string $localFile): string
    {
        $dir = '/app/public/files/' . dirname($objectPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $dest = '/app/public/files/' . $objectPath;
        if (!copy($localFile, $dest) && !rename($localFile, $dest)) {
            throw new \RuntimeException("Failed to save file locally: {$dest}");
        }
        return '/files/' . $objectPath;
    }

    private function deleteLocal(string $objectPath): void
    {
        $path = '/app/public/files/' . $objectPath;
        if (file_exists($path)) {
            unlink($path);
        }
    }

    // ──────────────────────────────────────────────────────────────
    // Helpers
    // ──────────────────────────────────────────────────────────────

    private function hasMetadataServer(): bool
    {
        $ch = curl_init('http://metadata.google.internal/');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 1,
            CURLOPT_CONNECTTIMEOUT => 1,
            CURLOPT_HTTPHEADER     => ['Metadata-Flavor: Google'],
        ]);
        curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code > 0;
    }

    /**
     * Extract the GCS object path from a full URL or a relative path.
     */
    private function extractObjectPath(string $pathOrUrl): string
    {
        // Full GCS URL
        if (str_contains($pathOrUrl, 'storage.googleapis.com')) {
            $prefix = $this->publicUrl . '/';
            if (str_starts_with($pathOrUrl, $prefix)) {
                return substr($pathOrUrl, strlen($prefix));
            }
            // Try to extract from generic URL
            $pattern = '/storage\.googleapis\.com\/' . preg_quote($this->bucket, '/') . '\/(.+)/';
            if (preg_match($pattern, $pathOrUrl, $m)) {
                return $m[1];
            }
        }

        // Local path like /files/avatars/user_1.jpg
        if (str_starts_with($pathOrUrl, '/files/')) {
            return substr($pathOrUrl, 7); // strip /files/
        }

        return $pathOrUrl;
    }
}
