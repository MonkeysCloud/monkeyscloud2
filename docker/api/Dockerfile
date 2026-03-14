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
    linux-headers

# Install PHP extensions using install-php-extensions (pre-compiled binaries)
ADD https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN chmod +x /usr/local/bin/install-php-extensions && \
    install-php-extensions \
    pdo_pgsql \
    mbstring \
    zip \
    gd \
    intl \
    opcache \
    pcntl \
    bcmath \
    sockets \
    redis \
    uuid

# Install Terraform CLI for environment provisioning
RUN TERRAFORM_VERSION="1.9.8" \
    && ARCH=$(uname -m | sed 's/aarch64/arm64/' | sed 's/x86_64/amd64/') \
    && wget -q "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_${ARCH}.zip" -O /tmp/terraform.zip \
    && unzip /tmp/terraform.zip -d /usr/local/bin/ \
    && rm /tmp/terraform.zip \
    && chmod +x /usr/local/bin/terraform

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /app

# Copy composer files first (better layer caching)
COPY api/composer.json api/composer.lock* ./

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction --ignore-platform-req=ext-pdo_mysql

# Copy application source
COPY api/ .

# Copy .env.example as fallback (entrypoint.sh will overwrite at runtime)
RUN cp .env.example .env || touch .env

# Custom PHP configuration
COPY docker/api/php.ini /usr/local/etc/php/conf.d/99-monkeyscloud.ini

# Create required directories (routes + psr16 subdirs to avoid mkdir race in FrankenPHP workers)
RUN mkdir -p /app/var/cache/routes /app/var/cache/psr16 /app/var/log /app/var/tmp \
    && chown -R www-data:www-data /app/var

# Copy Caddyfile
COPY docker/api/Caddyfile /etc/caddy/Caddyfile

# Expose FrankenPHP port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Copy entrypoint script
COPY docker/api/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Start via entrypoint (generates .env from env vars, then starts FrankenPHP)
ENTRYPOINT ["/entrypoint.sh"]
