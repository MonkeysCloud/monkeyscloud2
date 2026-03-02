<?php
$env = $_ENV + $_SERVER;

$dbHost = $env['DB_HOST'];
$dbPort = $env['DB_PORT'] ?? '5432';
$dbName = $env['DB_DATABASE'];

/* recognise BOTH DB_USER and DB_USERNAME, ditto for password */
$dbUser = $env['DB_USERNAME']
    ?? $env['DB_USER']
    ?? 'monkeyscloud';

$dbPass = $env['DB_PASSWORD']
    ?? $env['DB_PASS']
    ?? '';

return [
    'default' => 'pgsql',

    'connections' => [
        'pgsql' => [
            'dsn' => sprintf(
                'pgsql:host=%s;port=%s;dbname=%s',
                $dbHost,
                $dbPort,
                $dbName
            ),
            'username' => $dbUser,
            'password' => $dbPass,
            'options' => [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ],
        ],
    ],
];