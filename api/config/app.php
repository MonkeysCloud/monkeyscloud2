<?php
declare(strict_types=1);

/**
 * Project-specific overrides for MonkeysLegion DI definitions.
 *
 * Any definitions here will override the framework defaults provided by
 * MonkeysLegion\Config\AppConfig. Add only what you need to customize.
 */
return [
    // Custom CSRF middleware that excludes API routes (they use JWT, not sessions)
    \App\Middleware\VerifyCsrfToken::class => static function ($c) {
        return new \App\Middleware\VerifyCsrfToken(
            $c->get(\MonkeysLegion\Session\SessionManager::class)
        );
    },
];