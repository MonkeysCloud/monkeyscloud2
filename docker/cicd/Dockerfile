# =============================================================================
# MonkeysCloud CI/CD Worker — Build Runner
# =============================================================================
FROM dunglas/frankenphp:1-php8.4-alpine

# Install system dependencies + Docker CLI (for Docker-in-Docker builds)
RUN apk add --no-cache \
    git \
    unzip \
    curl \
    docker-cli \
    icu-dev \
    libzip-dev \
    oniguruma-dev \
    linux-headers \
    $PHPIZE_DEPS

# Install PHP extensions
RUN docker-php-ext-install -j$(nproc) \
    pdo_mysql \
    mbstring \
    zip \
    intl \
    opcache \
    pcntl \
    bcmath \
    sockets

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy composer files
COPY api/composer.json api/composer.lock* ./

# Install dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction 2>/dev/null || true

# Copy application source
COPY api/ .

# Create work directories
RUN mkdir -p /var/lib/cicd/builds /var/lib/cicd/artifacts \
    && chown -R www-data:www-data /var/lib/cicd

# Health check via process presence
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD pgrep -f "queue:work" || exit 1

# Start queue worker (consumes build/deploy jobs from Redis)
CMD ["php", "ml", "queue:work", "--queue=builds,deploys,webhooks,ai,mail", "--tries=3", "--timeout=600"]
