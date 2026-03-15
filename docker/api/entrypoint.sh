#!/bin/sh
set -e

# Generate .env from environment variables at runtime
# This ensures K8s env vars are available to MonkeysLegion's config readers
cat > /app/.env <<EOF
APP_ENV=${APP_ENV:-production}
APP_DEBUG=${APP_DEBUG:-false}

DB_CONNECTION=${DB_CONNECTION:-pgsql}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_DATABASE=${DB_DATABASE:-monkeyscloud}
DB_USER=${DB_USERNAME:-monkeyscloud}
DB_PASS=${DB_PASSWORD:-}

REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

RABBITMQ_HOST=${RABBITMQ_HOST:-rabbitmq}
RABBITMQ_PORT=${RABBITMQ_PORT:-5672}

JWT_SECRET=${JWT_SECRET:-}

SOCKET_SERVER_URL=${SOCKET_SERVER_URL:-http://socket-server:3002}
GIT_SERVER_URL=${GIT_SERVER_URL:-http://git-server:3001}
GIT_SERVER_PUBLIC_URL=${GIT_SERVER_PUBLIC_URL:-https://git.monkeys.cloud}
EOF

# If arguments were passed (e.g. via docker-compose command), run those instead
# This allows the same image to act as a queue worker: command: ["php", "ml", "queue:work"]
if [ $# -gt 0 ]; then
  exec "$@"
fi

# Default: start FrankenPHP
exec frankenphp run --config /etc/caddy/Caddyfile
