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

    // Queue infrastructure
    \MonkeysLegion\Queue\Factory\QueueFactory::class => static function ($c) {
        $config = require ML_BASE_PATH . '/config/queue.php';
        $conn = $c->get(\MonkeysLegion\Database\Contracts\ConnectionInterface::class);
        return new \MonkeysLegion\Queue\Factory\QueueFactory($config, $conn);
    },

    \MonkeysLegion\Queue\Contracts\QueueInterface::class => static function ($c) {
        return $c->get(\MonkeysLegion\Queue\Factory\QueueFactory::class)->make();
    },

    \MonkeysLegion\Queue\Dispatcher\QueueDispatcher::class => static function ($c) {
        return new \MonkeysLegion\Queue\Dispatcher\QueueDispatcher(
            $c->get(\MonkeysLegion\Queue\Contracts\QueueInterface::class)
        );
    },
];