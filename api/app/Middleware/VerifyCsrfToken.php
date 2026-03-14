<?php
declare(strict_types=1);

namespace App\Middleware;

use MonkeysLegion\Session\Middleware\VerifyCsrfToken as BaseVerifyCsrfToken;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;

/**
 * Extends the framework CSRF middleware to exclude API routes.
 * API routes use JWT authentication, not session-based CSRF tokens.
 */
class VerifyCsrfToken extends BaseVerifyCsrfToken
{
    /**
     * Paths that should be excluded from CSRF verification.
     */
    protected array $except = [
        '/api/*',
        '/auth/*',
        '/webhooks/*',
    ];

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        if ($this->isExcluded($request)) {
            return $handler->handle($request);
        }

        return parent::process($request, $handler);
    }

    protected function isExcluded(ServerRequestInterface $request): bool
    {
        $path = $request->getUri()->getPath();

        foreach ($this->except as $pattern) {
            if ($pattern === $path) {
                return true;
            }

            if (str_ends_with($pattern, '*')) {
                $prefix = rtrim($pattern, '*');
                if (str_starts_with($path, $prefix)) {
                    return true;
                }
            }
        }

        return false;
    }
}
