# =============================================================================
# MonkeysCloud API — MonkeysLegion on FrankenPHP
# =============================================================================
FROM dunglas/frankenphp:1-php8.4-alpine

# Install system dependencies
RUN apk add --no-cache \
    git \
    unzip \
    curl \
    icu-dev \
    libzip-dev \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    oniguruma-dev \
    postgresql-dev \
    linux-headers \
    $PHPIZE_DEPS

# Install PHP extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
    pdo_pgsql \
    mbstring \
    zip \
    gd \
    intl \
    opcache \
    pcntl \
    bcmath \
    sockets

# Install Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Install UUID extension
RUN apk add --no-cache util-linux-dev \
    && pecl install uuid && docker-php-ext-enable uuid

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy composer files first (better layer caching)
COPY api/composer.json api/composer.lock* ./

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction 2>/dev/null || true

# Copy application source
COPY api/ .

# Custom PHP configuration
COPY docker/api/php.ini /usr/local/etc/php/conf.d/99-monkeyscloud.ini

# Create required directories
RUN mkdir -p /app/var/cache /app/var/log /app/var/tmp \
    && chown -R www-data:www-data /app/var

# Expose FrankenPHP port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Start FrankenPHP in worker mode
ENTRYPOINT ["frankenphp", "php-server", "--listen", ":8000"]
