<?php
declare(strict_types=1);

namespace App\Controller;

use MonkeysLegion\Http\Message\Response;
use MonkeysLegion\Http\Message\Stream;
use Psr\Http\Message\ServerRequestInterface;

abstract class AbstractController
{
    /**
     * Get the authenticated user ID from the request.
     */
    protected function userId(ServerRequestInterface $request): ?string
    {
        $uid = $request->getAttribute('user_id');
        if ($uid) {
            return (string) $uid;
        }

        // Fallback: decode JWT payload directly from Authorization header
        $auth = $request->getHeaderLine('Authorization');
        if (str_starts_with($auth, 'Bearer ')) {
            $token = substr($auth, 7);
            $parts = explode('.', $token);
            if (count($parts) === 3) {
                $payload = json_decode(base64_decode(strtr($parts[1], '-_', '+/')), true);
                if (isset($payload['sub'])) {
                    return (string) $payload['sub'];
                }
            }
        }

        return null;
    }

    /**
     * Return a JSON response.
     */
    protected function json(mixed $data, int $status = 200): Response
    {
        $body = Stream::createFromString(json_encode($data));
        return new Response($body, $status, ['Content-Type' => 'application/json']);
    }
}
