<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Router\Attributes\Route;
use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use Psr\Http\Message\ServerRequestInterface;

final class HealthController
{
    #[Route(methods: 'GET', path: '/health', name: 'health.check', summary: 'Health check endpoint', tags: ['System'])]
    public function check(ServerRequestInterface $request): Response
    {
        return new Response(
            Stream::createFromString(json_encode(['status' => 'ok'])),
            200,
            ['Content-Type' => 'application/json']
        );
    }
}
