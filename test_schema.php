<?php
require __DIR__ . '/api/vendor/autoload.php';

use MonkeysLegion\Migration\MigrationGenerator;
use MonkeysLegion\Migration\Dialect\PostgreSqlDialect;

$dialect = new PostgreSqlDialect();
$generator = new MigrationGenerator($dialect, 'pgsql');

print_r($generator->generateDiff([], []));
