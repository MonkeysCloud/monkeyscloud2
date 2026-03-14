<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Router\Attributes\RoutePrefix;
use MonkeysLegion\Router\Attributes\Middleware;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use MonkeysLegion\Auth\Service\AuthService;
use MonkeysLegion\Auth\Service\TwoFactorService;
use MonkeysLegion\Auth\Exception\TwoFactorInvalidException;
use App\Repository\UserRepository;
use Psr\Http\Message\ServerRequestInterface;

/**
 * Manages 2FA setup, verification, and recovery codes.
 */
#[RoutePrefix('/api/v1')]
final class TwoFactorController
{
    public function __construct(
        private AuthService $authService,
        private TwoFactorService $twoFactorService,
        private UserRepository $userRepo,
    ) {
    }

    #[Route(methods: 'POST', path: '/auth/2fa/enable', name: '2fa.enable', summary: 'Generate TOTP secret + QR code', tags: ['Auth', '2FA'])]
    #[Middleware(['auth'])]
    public function enable(ServerRequestInterface $request): Response
    {
        $user = $request->getAttribute('user');
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        if ($user->two_factor_enabled) {
            return $this->json(['error' => '2FA is already enabled'], 409);
        }

        $setup = $this->twoFactorService->generateSetup($user->email);

        // Store secret temporarily (not yet verified)
        $user->two_factor_secret = $setup['secret'];
        $user->two_factor_recovery_codes = $setup['recovery_codes'];
        $this->userRepo->save($user);

        return $this->json([
            'secret' => $setup['secret'],
            'qr_code' => $setup['qr_code'],
            'provisioning_uri' => $setup['provisioning_uri'],
            'recovery_codes' => $setup['recovery_codes'],
        ]);
    }

    #[Route(methods: 'POST', path: '/auth/2fa/verify', name: '2fa.verify', summary: 'Verify TOTP code to activate 2FA', tags: ['Auth', '2FA'])]
    #[Middleware(['auth'])]
    public function verify(ServerRequestInterface $request): Response
    {
        $user = $request->getAttribute('user');
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        $data = $this->body($request);
        $code = $data['code'] ?? '';

        if (!$code) {
            return $this->json(['error' => 'code is required'], 422);
        }

        $secret = $user->two_factor_secret;
        if (!$secret) {
            return $this->json(['error' => 'Call enable first to generate a secret'], 400);
        }

        try {
            $this->twoFactorService->enable(
                $secret,
                $code,
                $user->getAuthIdentifier(),
                $this->ip($request),
            );
        } catch (TwoFactorInvalidException) {
            return $this->json(['error' => 'Invalid verification code'], 422);
        }

        // Mark 2FA as fully enabled
        $user->two_factor_enabled = true;
        $this->userRepo->save($user);

        return $this->json(['message' => '2FA enabled successfully']);
    }

    #[Route(methods: 'POST', path: '/auth/2fa/disable', name: '2fa.disable', summary: 'Disable 2FA (requires TOTP confirmation)', tags: ['Auth', '2FA'])]
    #[Middleware(['auth'])]
    public function disable(ServerRequestInterface $request): Response
    {
        $user = $request->getAttribute('user');
        if (!$user) {
            return $this->json(['error' => 'Unauthorized'], 401);
        }

        if (!$user->two_factor_enabled) {
            return $this->json(['error' => '2FA is not enabled'], 400);
        }

        $data = $this->body($request);
        $code = $data['code'] ?? '';

        if (!$code) {
            return $this->json(['error' => 'code is required to disable 2FA'], 422);
        }

        // Verify the TOTP code before disabling
        if (!$this->twoFactorService->verify($user->two_factor_secret, $code)) {
            return $this->json(['error' => 'Invalid verification code'], 422);
        }

        // Clear 2FA
        $user->two_factor_secret = null;
        $user->two_factor_enabled = false;
        $user->two_factor_recovery_codes = null;
        $this->userRepo->save($user);

        $this->twoFactorService->disable($user->getAuthIdentifier(), $this->ip($request));

        return $this->json(['message' => '2FA disabled']);
    }

    #[Route(methods: 'POST', path: '/auth/2fa/backup', name: '2fa.backup', summary: 'Auth via backup code (public - no auth needed)', tags: ['Auth', '2FA'])]
    public function useBackupCode(ServerRequestInterface $request): Response
    {
        $data = $this->body($request);
        $challengeToken = $data['challenge_token'] ?? '';
        $code = $data['code'] ?? '';

        if (!$challengeToken || !$code) {
            return $this->json(['error' => 'challenge_token and code are required'], 422);
        }

        try {
            $result = $this->authService->verify2FA(
                $challengeToken,
                $code,
                $this->ip($request),
                $request->getHeaderLine('User-Agent'),
            );
        } catch (TwoFactorInvalidException) {
            return $this->json(['error' => 'Invalid backup code'], 401);
        } catch (\Throwable $e) {
            return $this->json(['error' => $e->getMessage()], 401);
        }

        return $this->json([
            'user' => $this->userPayload($result->user),
            'tokens' => $result->tokens->toArray(),
        ]);
    }

    // ─── Helpers ──────────────────────────────────────────────────

    private function body(ServerRequestInterface $request): array
    {
        return json_decode((string) $request->getBody(), true) ?? [];
    }

    private function ip(ServerRequestInterface $request): ?string
    {
        return $request->getServerParams()['REMOTE_ADDR'] ?? null;
    }

    private function userPayload(mixed $user): array
    {
        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'avatar_url' => $user->avatar_url ?? null,
            'two_factor_enabled' => $user->two_factor_enabled ?? false,
            'created_at' => $user->created_at->format('c'),
        ];
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
