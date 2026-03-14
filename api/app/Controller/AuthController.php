<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Router\Attributes\RoutePrefix;
use MonkeysLegion\Router\Attributes\Middleware;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use MonkeysLegion\Auth\Service\AuthService;
use MonkeysLegion\Auth\Exception\UserAlreadyExistsException;
use MonkeysLegion\Auth\Exception\InvalidCredentialsException;
use MonkeysLegion\Auth\Exception\AccountLockedException;
use MonkeysLegion\Auth\Exception\TokenExpiredException;
use MonkeysLegion\Auth\Exception\TokenInvalidException;
use MonkeysLegion\Auth\Exception\TokenRevokedException;
use MonkeysLegion\Auth\Exception\RateLimitException;
use App\Entity\Organization;
use App\Entity\OrganizationMember;
use App\Repository\UserRepository;
use App\Repository\OrganizationRepository;
use App\Repository\OrganizationMemberRepository;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Handles registration, login, logout, token refresh, password management, and profile.
 */
#[RoutePrefix('/api/v1')]
final class AuthController
{
    public function __construct(
        private AuthService $authService,
        private UserRepository $userRepo,
        private OrganizationRepository $orgRepo,
        private OrganizationMemberRepository $memberRepo,
    ) {
    }

    // ─── Public routes (no middleware) ─────────────────────────────

    #[Route(methods: 'POST', path: '/auth/register', name: 'auth.register', summary: 'Register new user + org', tags: ['Auth'])]
    public function register(ServerRequestInterface $request): Response
    {
        $data = $this->body($request);
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';
        $name = trim($data['name'] ?? '');

        if (!$email || !$password || !$name) {
            return $this->json(['error' => 'name, email and password are required'], 422);
        }

        if (strlen($password) < 8) {
            return $this->json(['error' => 'Password must be at least 8 characters'], 422);
        }

        $ip = $this->ip($request);

        try {
            $now = date('Y-m-d H:i:s');
            $user = $this->authService->register($email, $password, [
                'name' => $name,
                'created_at' => $now,
                'updated_at' => $now,
            ], $ip);
        } catch (UserAlreadyExistsException) {
            return $this->json(['error' => 'Email already registered'], 409);
        } catch (RateLimitException $e) {
            return $this->json(['error' => 'Too many attempts', 'retry_after' => $e->getCode()], 429);
        }

        // Issue JWT tokens
        try {
            $tokens = $this->authService->issueTokenPair($user);
        } catch (\Throwable $e) {
            // User was created but token issuance failed — still return success
            return $this->json([
                'user' => $this->userPayload($user),
                'tokens' => null,
            ], 201);
        }

        return $this->json([
            'user' => $this->userPayload($user),
            'tokens' => $tokens->toArray(),
        ], 201);
    }

    #[Route(methods: 'POST', path: '/auth/login', name: 'auth.login', summary: 'Login with email+password', tags: ['Auth'])]
    public function login(ServerRequestInterface $request): Response
    {
        $data = $this->body($request);
        $email = trim($data['email'] ?? '');
        $password = $data['password'] ?? '';

        if (!$email || !$password) {
            return $this->json(['error' => 'email and password are required'], 422);
        }

        try {
            $result = $this->authService->login(
                $email,
                $password,
                $this->ip($request),
                $request->getHeaderLine('User-Agent'),
            );
        } catch (InvalidCredentialsException) {
            return $this->json(['error' => 'Invalid credentials'], 401);
        } catch (AccountLockedException $e) {
            return $this->json([
                'error' => 'Account temporarily locked',
                'locked_until' => $e->getCode(),
            ], 423);
        } catch (RateLimitException $e) {
            return $this->json(['error' => 'Too many attempts', 'retry_after' => $e->getCode()], 429);
        }

        // 2FA challenge
        if ($result->requires2FA) {
            return $this->json([
                'requires_2fa' => true,
                'challenge_token' => $result->challengeToken,
            ]);
        }

        return $this->json([
            'user' => $this->userPayload($result->user),
            'tokens' => $result->tokens->toArray(),
        ]);
    }

    #[Route(methods: 'POST', path: '/auth/refresh', name: 'auth.refresh', summary: 'Refresh JWT tokens', tags: ['Auth'])]
    public function refresh(ServerRequestInterface $request): Response
    {
        $data = $this->body($request);
        $refreshToken = $data['refresh_token'] ?? '';

        if (!$refreshToken) {
            return $this->json(['error' => 'refresh_token is required'], 422);
        }

        try {
            $tokens = $this->authService->refresh($refreshToken, $this->ip($request));
        } catch (TokenExpiredException) {
            return $this->json(['error' => 'Refresh token expired'], 401);
        } catch (TokenRevokedException) {
            return $this->json(['error' => 'Token revoked'], 401);
        } catch (TokenInvalidException) {
            return $this->json(['error' => 'Invalid refresh token'], 401);
        }

        return $this->json(['tokens' => $tokens->toArray()]);
    }

    #[Route(methods: 'POST', path: '/auth/forgot-password', name: 'auth.forgotPassword', summary: 'Send password reset email', tags: ['Auth'])]
    public function forgotPassword(ServerRequestInterface $request): Response
    {
        $data = $this->body($request);
        $email = trim($data['email'] ?? '');

        if (!$email) {
            return $this->json(['error' => 'email is required'], 422);
        }

        // Always return success to prevent email enumeration
        // TODO: dispatch PasswordResetRequested event → queue email
        return $this->json(['message' => 'If the email exists, a reset link has been sent']);
    }

    #[Route(methods: 'POST', path: '/auth/reset-password', name: 'auth.resetPassword', summary: 'Reset password with token', tags: ['Auth'])]
    public function resetPassword(ServerRequestInterface $request): Response
    {
        $data = $this->body($request);
        $token = $data['token'] ?? '';
        $password = $data['password'] ?? '';

        if (!$token || !$password) {
            return $this->json(['error' => 'token and password are required'], 422);
        }

        if (strlen($password) < 8) {
            return $this->json(['error' => 'Password must be at least 8 characters'], 422);
        }

        // TODO: validate reset token, update password
        return $this->json(['message' => 'Password has been reset']);
    }

    #[Route(methods: 'POST', path: '/auth/verify-email', name: 'auth.verifyEmail', summary: 'Verify email token', tags: ['Auth'])]
    public function verifyEmail(ServerRequestInterface $request): Response
    {
        $data = $this->body($request);
        $token = $data['token'] ?? '';

        if (!$token) {
            return $this->json(['error' => 'token is required'], 422);
        }

        // TODO: validate email verification token, mark user as verified
        return $this->json(['message' => 'Email verified']);
    }

    // ─── Authenticated routes ─────────────────────────────────────

    #[Route(methods: 'POST', path: '/auth/logout', name: 'auth.logout', summary: 'Logout / revoke tokens', tags: ['Auth'])]
    #[Middleware(['auth'])]
    public function logout(ServerRequestInterface $request): Response
    {
        $token = $this->bearerToken($request);
        if (!$token) {
            return $this->json(['error' => 'Missing token'], 401);
        }

        $data = $this->body($request);
        $allDevices = (bool) ($data['all_devices'] ?? false);

        $this->authService->logout($token, $allDevices, $this->ip($request));

        return $this->json(null, 204);
    }

    #[Route(methods: 'GET', path: '/auth/me', name: 'auth.me', summary: 'Get current user', tags: ['Auth'])]
    #[Middleware(['auth'])]
    public function me(ServerRequestInterface $request): Response
    {
        $user = $request->getAttribute('user');
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        // Fetch user's organizations with a single JOIN query
        $rows = $this->orgRepo->findWithRoleByUser($user->id);
        $orgs = [];
        foreach ($rows as $row) {
            $orgs[] = [
                'id'   => (int) $row['id'],
                'name' => $row['name'],
                'slug' => $row['slug'],
                'role' => $row['role'] ?? 'member',
            ];
        }

        return $this->json([
            'user' => $this->userPayload($user),
            'organizations' => $orgs,
        ]);
    }

    #[Route(methods: 'PUT', path: '/auth/me', name: 'auth.updateProfile', summary: 'Update user profile', tags: ['Auth'])]
    #[Middleware(['auth'])]
    public function updateProfile(ServerRequestInterface $request): Response
    {
        $user = $request->getAttribute('user');
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $data = $this->body($request);
        $changed = false;

        foreach (['name', 'avatar_url', 'timezone', 'locale'] as $field) {
            if (isset($data[$field])) {
                $user->$field = $data[$field];
                $changed = true;
            }
        }

        if (!$changed) {
            return $this->json(['error' => 'No fields to update'], 422);
        }

        $user->updated_at = new \DateTimeImmutable();
        $this->userRepo->save($user);

        return $this->json(['user' => $this->userPayload($user)]);
    }

    #[Route(methods: 'PUT', path: '/auth/me/password', name: 'auth.changePassword', summary: 'Change password', tags: ['Auth'])]
    #[Middleware(['auth'])]
    public function changePassword(ServerRequestInterface $request): Response
    {
        $user = $request->getAttribute('user');
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $data = $this->body($request);
        $currentPassword = $data['current_password'] ?? '';
        $newPassword = $data['new_password'] ?? '';

        if (!$currentPassword || !$newPassword) {
            return $this->json(['error' => 'current_password and new_password are required'], 422);
        }

        if (strlen($newPassword) < 8) {
            return $this->json(['error' => 'New password must be at least 8 characters'], 422);
        }

        try {
            $this->authService->changePassword(
                $user,
                $currentPassword,
                $newPassword,
                $this->ip($request),
            );
        } catch (InvalidCredentialsException) {
            return $this->json(['error' => 'Current password is incorrect'], 401);
        }

        return $this->json(['message' => 'Password changed successfully']);
    }

    #[Route(methods: 'POST', path: '/auth/me/avatar', name: 'auth.uploadAvatar', summary: 'Upload avatar', tags: ['Auth'])]
    #[Middleware(['auth'])]
    public function uploadAvatar(ServerRequestInterface $request): Response
    {
        $user = $request->getAttribute('user');
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        try {
            $files = $request->getUploadedFiles();
            $raw = $files['avatar'] ?? null;

            if (!$raw) {
                return $this->json(['error' => 'No avatar file provided'], 422);
            }

            // Handle both PSR-7 UploadedFileInterface and raw $_FILES array
            if (is_array($raw)) {
                if ((int) ($raw['error'] ?? 1) !== UPLOAD_ERR_OK) {
                    return $this->json(['error' => 'Upload failed'], 422);
                }
                $tmpPath = $raw['tmp_name'];
                $originalName = $raw['name'] ?? 'avatar.jpg';
            } else {
                if ($raw->getError() !== UPLOAD_ERR_OK) {
                    return $this->json(['error' => 'Upload failed'], 422);
                }
                $tmpPath = $raw->getStream()->getMetadata('uri');
                $originalName = $raw->getClientFilename() ?? 'avatar.jpg';
            }

            // Validate extension
            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
            if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'])) {
                return $this->json(['error' => 'Invalid file type. Allowed: jpg, jpeg, png, gif, webp'], 422);
            }

            $dir = '/app/public/files/avatars';
            if (!is_dir($dir)) {
                mkdir($dir, 0775, true);
            }

            // Delete old avatar if exists
            if ($user->avatar_url) {
                $oldPath = '/app/public' . $user->avatar_url;
                if (file_exists($oldPath)) {
                    unlink($oldPath);
                }
            }

            $filename = 'user_' . $user->id . '_' . time() . '.' . $ext;
            $filePath = $dir . '/' . $filename;

            if (!move_uploaded_file($tmpPath, $filePath) && !rename($tmpPath, $filePath)) {
                return $this->json(['error' => 'Failed to save avatar'], 500);
            }

            $user->avatar_url = '/files/avatars/' . $filename;
            $user->updated_at = new \DateTimeImmutable();
            $this->userRepo->save($user);

            return $this->json(['user' => $this->userPayload($user)]);
        } catch (\Throwable $e) {
            error_log('AVATAR_UPLOAD ERROR: ' . $e->getMessage());
            return $this->json(['error' => 'Upload failed: ' . $e->getMessage()], 500);
        }
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private function body(ServerRequestInterface $request): array
    {
        $body = (string) $request->getBody();
        return json_decode($body, true) ?? [];
    }

    private function bearerToken(ServerRequestInterface $request): ?string
    {
        $auth = $request->getHeaderLine('Authorization');
        return str_starts_with($auth, 'Bearer ') ? substr($auth, 7) : null;
    }

    private function ip(ServerRequestInterface $request): ?string
    {
        $params = $request->getServerParams();
        return $params['REMOTE_ADDR'] ?? null;
    }

    private function userPayload(mixed $user): array
    {
        $createdAt = $user->created_at ?? null;
        if ($createdAt instanceof \DateTimeImmutable) {
            $createdAt = $createdAt->format('c');
        }

        $verifiedAt = $user->email_verified_at ?? null;
        if ($verifiedAt instanceof \DateTimeImmutable) {
            $verifiedAt = $verifiedAt->format('c');
        }

        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url ?? null,
            'timezone' => $user->timezone ?? 'UTC',
            'locale' => $user->locale ?? 'en',
            'status' => $user->status ?? 'active',
            'email_verified_at' => $verifiedAt,
            'two_factor_enabled' => (bool) ($user->two_factor_enabled ?? false),
            'is_admin' => (bool) ($user->is_admin ?? false),
            'created_at' => $createdAt,
        ];
    }

    private function generateSlug(string $name): string
    {
        $slug = strtolower(trim(preg_replace('/[^A-Za-z0-9]+/', '-', $name), '-'));
        return $slug . '-' . substr(bin2hex(random_bytes(3)), 0, 6);
    }

    private function json(mixed $data, int $status = 200): Response
    {
        $body = $status === 204 ? '' : json_encode($data);
        return new Response(
            Stream::createFromString($body),
            $status,
            ['Content-Type' => 'application/json']
        );
    }
}
