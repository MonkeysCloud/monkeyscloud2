<?php
require_once __DIR__ . '/vendor/autoload.php';

$pdo = new PDO('pgsql:host='.getenv('DB_HOST').';dbname='.getenv('DB_DATABASE'), getenv('DB_USERNAME'), getenv('DB_PASSWORD'));

// 1. Find a valid user and organization
$stmt = $pdo->query('SELECT ou.user_id, ou.organization_id FROM organization_users ou LIMIT 1');
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row) die('No users found in organizations');

// 2. Generate a JWT token
use Firebase\JWT\JWT;
$payload = [
    'sub' => $row['user_id'],
    'iat' => time(),
    'exp' => time() + 3600
];
$token = JWT::encode($payload, getenv('JWT_SECRET'), 'HS256');

$orgId = $row['organization_id'];

// 3. Create a project using cURL
$c = curl_init('http://localhost:8000/api/v1/organizations/' . $orgId . '/projects');
curl_setopt($c, CURLOPT_POST, 1);
curl_setopt($c, CURLOPT_POSTFIELDS, json_encode(['name' => 'Prod Test Create', 'slug' => 'prod-test-create']));
curl_setopt($c, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Authorization: Bearer ' . $token]);
curl_setopt($c, CURLOPT_RETURNTRANSFER, true);
$res = curl_exec($c);

echo 'Create POST Code: ' . curl_getinfo($c, CURLINFO_HTTP_CODE) . PHP_EOL;
echo 'Create POST Body: ' . $res . PHP_EOL;

$data = json_decode($res, true);
if (isset($data['data']['id'])) {
    $id = $data['data']['id'];
    
    // 4. Delete the project using cURL
    echo "\nTesting Deletion for ID: " . $id . PHP_EOL;
    $d = curl_init('http://localhost:8000/api/v1/projects/' . $id);
    curl_setopt($d, CURLOPT_CUSTOMREQUEST, 'DELETE');
    curl_setopt($d, CURLOPT_HTTPHEADER, ['Authorization: Bearer ' . $token]);
    curl_setopt($d, CURLOPT_RETURNTRANSFER, true);
    $dRes = curl_exec($d);
    
    echo 'Delete DELETE Code: ' . curl_getinfo($d, CURLINFO_HTTP_CODE) . PHP_EOL;
    echo 'Delete DELETE Body: ' . $dRes . PHP_EOL;
}
