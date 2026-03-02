<?php

return [
    'default' => $_ENV['QUEUE_DRIVER'] ?? 'redis',

    'settings' => [
        'queue' => $_ENV['QUEUE_NAME'] ?? 'default',
        'retry_after' => (int) ($_ENV['QUEUE_RETRY_AFTER'] ?? 90),
        'max_attempts' => (int) ($_ENV['QUEUE_MAX_ATTEMPTS'] ?? 3),
        'backoff' => (int) ($_ENV['QUEUE_BACKOFF'] ?? 5),
    ],

    'stores' => [
        'redis' => [
            'host' => $_ENV['REDIS_HOST'] ?? '127.0.0.1',
            'port' => (int) ($_ENV['REDIS_PORT'] ?? 6379),
            'timeout' => 2.0,
            'database' => (int) ($_ENV['QUEUE_REDIS_DB'] ?? 1),
        ],
        'database' => [
            'table' => 'jobs',
            'failed_table' => 'failed_jobs',
        ],
    ],
];
