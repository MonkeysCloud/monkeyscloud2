#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════
# MonkeysCloud VM Startup Script
# Provisioned by Terraform for: ${org_slug}/${project_slug}/${env_slug}
# SSL is handled by GCP-managed certificates + HTTPS Load Balancer
# ═══════════════════════════════════════════════════════════════════

export DEBIAN_FRONTEND=noninteractive

STACK="${stack}"
SSH_USER="${ssh_user}"
HOME_DIR="/home/$SSH_USER"
APP_DIR="$HOME_DIR/app"
DOMAIN="${hostname}"
GIT_REPO_URL="${git_repo_url}"
GIT_BRANCH="${git_branch}"

echo "▶ [1/6] Setting up deploy user..."
if ! id "$SSH_USER" &>/dev/null; then
    useradd -m -s /bin/bash -G sudo "$SSH_USER"
fi
echo "$SSH_USER:${ssh_password}" | chpasswd
mkdir -p "$APP_DIR"

# Allow passwordless sudo for deploy user
echo "$SSH_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$SSH_USER

# Enable password-based SSH
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd

echo "▶ [2/8] Cloning project repo..."
if [ -n "$GIT_REPO_URL" ]; then
    su - $SSH_USER -c "git clone -b $GIT_BRANCH $GIT_REPO_URL $APP_DIR" || {
        echo "WARN: git clone failed, directory may already exist"
        # If dir already has content, just fetch and checkout
        if [ -d "$APP_DIR/.git" ]; then
            su - $SSH_USER -c "cd $APP_DIR && git fetch origin && git checkout $GIT_BRANCH && git pull origin $GIT_BRANCH"
        fi
    }
else
    echo "NOTE: No git repo URL provided, skipping clone"
    mkdir -p "$APP_DIR"
fi
chown -R $SSH_USER:$SSH_USER "$APP_DIR"

echo "▶ [3/8] Updating system & installing base packages..."
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
    git curl wget unzip zip \
    build-essential software-properties-common \
    nginx \
    ufw htop supervisor \
    postgresql-client mysql-client \
    redis-tools \
    jq acl logrotate

# Firewall
ufw allow OpenSSH
ufw allow "Nginx Full"
ufw --force enable

echo "▶ [4/8] Installing runtime for stack: $STACK ..."

# ═══════════════════════════════════════════════════════════════════
#  STACK-SPECIFIC INSTALLATION
# ═══════════════════════════════════════════════════════════════════

case "$STACK" in

    # ── PHP Stacks ───────────────────────────────────────────────
    monkeyslegion|laravel|symfony|drupal|wordpress|php-generic)
        add-apt-repository -y ppa:ondrej/php
        apt-get update -qq
        apt-get install -y -qq \
            php8.4 php8.4-fpm php8.4-cli php8.4-common \
            php8.4-mysql php8.4-pgsql php8.4-sqlite3 \
            php8.4-curl php8.4-gd php8.4-mbstring php8.4-xml \
            php8.4-zip php8.4-bcmath php8.4-intl php8.4-redis \
            php8.4-opcache php8.4-soap php8.4-imagick php8.4-readline

        # Composer
        curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

        # Node 22 (for frontend assets / mix / vite)
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y -qq nodejs

        # PHP-FPM tuning
        sed -i 's/^pm = dynamic/pm = ondemand/' /etc/php/8.4/fpm/pool.d/www.conf
        sed -i 's/^pm.max_children = .*/pm.max_children = 20/' /etc/php/8.4/fpm/pool.d/www.conf
        sed -i "s/^user = www-data/user = $SSH_USER/" /etc/php/8.4/fpm/pool.d/www.conf
        sed -i "s/^group = www-data/group = $SSH_USER/" /etc/php/8.4/fpm/pool.d/www.conf
        sed -i "s|^listen.owner = www-data|listen.owner = $SSH_USER|" /etc/php/8.4/fpm/pool.d/www.conf
        sed -i "s|^listen.group = www-data|listen.group = $SSH_USER|" /etc/php/8.4/fpm/pool.d/www.conf
        systemctl restart php8.4-fpm

        # Laravel/Symfony scheduler cron
        if [[ "$STACK" == "laravel" ]]; then
            (crontab -u $SSH_USER -l 2>/dev/null; echo "* * * * * cd $APP_DIR && php artisan schedule:run >> /dev/null 2>&1") | crontab -u $SSH_USER -
        fi
        ;;

    # ── Node.js SSR Stacks (proxy to app) ────────────────────────
    nextjs|nuxtjs|remix|sveltekit|astro|express|nestjs)
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y -qq nodejs
        npm install -g pm2

        # PM2 startup (survive reboot)
        env PATH=$PATH:/usr/bin pm2 startup systemd -u $SSH_USER --hp $HOME_DIR
        ;;

    # ── Node.js SPA Stacks (static build → nginx) ───────────────
    react|vue|angular)
        curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
        apt-get install -y -qq nodejs
        # These build to static files — no PM2 needed, nginx serves directly
        ;;

    # ── Python Stacks ────────────────────────────────────────────
    django|fastapi|flask|streamlit|python-generic)
        add-apt-repository -y ppa:deadsnakes/ppa
        apt-get update -qq
        apt-get install -y -qq python3.13 python3.13-venv python3.13-dev python3-pip
        update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.13 1

        # Create virtualenv
        su - $SSH_USER -c "python3 -m venv $APP_DIR/venv"

        # Install process manager
        case "$STACK" in
            django|flask)
                su - $SSH_USER -c "$APP_DIR/venv/bin/pip install gunicorn"
                ;;
            fastapi)
                su - $SSH_USER -c "$APP_DIR/venv/bin/pip install uvicorn[standard]"
                ;;
            streamlit)
                su - $SSH_USER -c "$APP_DIR/venv/bin/pip install streamlit"
                ;;
        esac

        # Supervisor config for Python apps
        cat > /etc/supervisor/conf.d/app.conf <<SUPERVISOR
[program:app]
directory=$APP_DIR
user=$SSH_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
SUPERVISOR

        case "$STACK" in
            django)
                echo "command=$APP_DIR/venv/bin/gunicorn app.wsgi:application -b 127.0.0.1:8000 --workers 3" >> /etc/supervisor/conf.d/app.conf
                ;;
            flask)
                echo "command=$APP_DIR/venv/bin/gunicorn app:app -b 127.0.0.1:8000 --workers 3" >> /etc/supervisor/conf.d/app.conf
                ;;
            fastapi)
                echo "command=$APP_DIR/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 3" >> /etc/supervisor/conf.d/app.conf
                ;;
            streamlit)
                echo "command=$APP_DIR/venv/bin/streamlit run app.py --server.port 8501 --server.headless true" >> /etc/supervisor/conf.d/app.conf
                ;;
        esac
        supervisorctl reread
        ;;

    # ── Ruby Stacks ──────────────────────────────────────────────
    rails|ruby-generic)
        apt-get install -y -qq ruby-full ruby-dev libpq-dev libmysqlclient-dev
        gem install bundler

        if [[ "$STACK" == "rails" ]]; then
            gem install rails --no-document

            # Puma supervisor config
            cat > /etc/supervisor/conf.d/app.conf <<SUPERVISOR
[program:app]
command=bash -lc 'cd $APP_DIR && bundle exec puma -C config/puma.rb -b tcp://127.0.0.1:3000'
directory=$APP_DIR
user=$SSH_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
SUPERVISOR
            supervisorctl reread
        fi
        ;;

    # ── Go ───────────────────────────────────────────────────────
    go)
        GO_VERSION="1.24.1"
        wget -q "https://go.dev/dl/go$GO_VERSION.linux-amd64.tar.gz"
        tar -C /usr/local -xzf "go$GO_VERSION.linux-amd64.tar.gz"
        rm "go$GO_VERSION.linux-amd64.tar.gz"
        echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh
        echo "export GOPATH=$HOME_DIR/go" >> /etc/profile.d/go.sh
        source /etc/profile.d/go.sh

        # Supervisor config for Go binary
        cat > /etc/supervisor/conf.d/app.conf <<SUPERVISOR
[program:app]
command=$APP_DIR/app
directory=$APP_DIR
user=$SSH_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
environment=PORT="8080"
SUPERVISOR
        supervisorctl reread
        ;;

    # ── Rust ─────────────────────────────────────────────────────
    rust)
        su - $SSH_USER -c 'curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y'

        # Supervisor config for Rust binary
        cat > /etc/supervisor/conf.d/app.conf <<SUPERVISOR
[program:app]
command=$APP_DIR/target/release/app
directory=$APP_DIR
user=$SSH_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
environment=PORT="8080"
SUPERVISOR
        supervisorctl reread
        ;;

    # ── Java / Spring Boot ───────────────────────────────────────
    spring-boot|java-generic)
        apt-get install -y -qq default-jdk maven gradle

        # Supervisor config for Java app
        cat > /etc/supervisor/conf.d/app.conf <<SUPERVISOR
[program:app]
command=java -jar $APP_DIR/target/app.jar --server.port=8080
directory=$APP_DIR
user=$SSH_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
environment=JAVA_HOME="/usr/lib/jvm/default-java"
SUPERVISOR
        supervisorctl reread
        ;;

    # ── .NET ─────────────────────────────────────────────────────
    dotnet)
        # Microsoft .NET 9 SDK
        wget -q https://packages.microsoft.com/config/ubuntu/24.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
        dpkg -i packages-microsoft-prod.deb
        rm packages-microsoft-prod.deb
        apt-get update -qq
        apt-get install -y -qq dotnet-sdk-9.0

        # Supervisor config
        cat > /etc/supervisor/conf.d/app.conf <<SUPERVISOR
[program:app]
command=dotnet run --urls http://127.0.0.1:5000
directory=$APP_DIR
user=$SSH_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
SUPERVISOR
        supervisorctl reread
        ;;

    # ── Phoenix (Elixir) ────────────────────────────────────────
    phoenix)
        # Erlang + Elixir
        apt-get install -y -qq erlang elixir
        su - $SSH_USER -c "mix local.hex --force && mix local.rebar --force"

        # Supervisor config
        cat > /etc/supervisor/conf.d/app.conf <<SUPERVISOR
[program:app]
command=bash -lc 'cd $APP_DIR && MIX_ENV=prod mix phx.server'
directory=$APP_DIR
user=$SSH_USER
autostart=true
autorestart=true
stderr_logfile=/var/log/app.err.log
stdout_logfile=/var/log/app.out.log
environment=PORT="4000",MIX_ENV="prod"
SUPERVISOR
        supervisorctl reread
        ;;

    # ── Docker / Docker Compose ──────────────────────────────────
    docker|docker-compose)
        curl -fsSL https://get.docker.com | sh
        usermod -aG docker $SSH_USER
        apt-get install -y -qq docker-compose-plugin
        ;;

    # ── Static (nginx only) ──────────────────────────────────────
    static)
        # Nginx is already installed — no extra runtime needed
        ;;

    *)
        echo "WARNING: Unknown stack '$STACK' — only base packages installed"
        ;;
esac

echo "▶ [5/8] Configuring Nginx for stack: $STACK ..."

# ═══════════════════════════════════════════════════════════════════
#  NGINX CONFIG — stack-specific
# ═══════════════════════════════════════════════════════════════════

# Determine app port and type for nginx
case "$STACK" in

    # PHP stacks → PHP-FPM
    monkeyslegion|laravel|symfony|drupal|wordpress|php-generic)
        WEBROOT="$APP_DIR/public"
        if [[ "$STACK" == "wordpress" ]]; then
            WEBROOT="$APP_DIR"
        fi

        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    root $WEBROOT;
    index index.php index.html;

    client_max_body_size 100M;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \$uri \$uri/ /index.php?\$query_string;
    }

    location ~ \.php\$ {
        include fastcgi_params;
        fastcgi_pass unix:/var/run/php/php8.4-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME \$document_root\$fastcgi_script_name;
        fastcgi_read_timeout 300;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)\$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\. { deny all; }
}
NGINX
        ;;

    # Node SSR stacks → proxy to PM2 app on port 3000
    nextjs|nuxtjs|remix|sveltekit|astro|express|nestjs)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    client_max_body_size 50M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 60;
    }

    location /_next/static/ {
        alias $APP_DIR/.next/static/;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX
        ;;

    # Node SPA stacks → static files served by nginx
    react|vue|angular)
        BUILD_DIR="$APP_DIR/dist"
        if [[ "$STACK" == "angular" ]]; then
            BUILD_DIR="$APP_DIR/dist/app/browser"
        elif [[ "$STACK" == "react" || "$STACK" == "vue" ]]; then
            BUILD_DIR="$APP_DIR/dist"
        fi

        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    root $BUILD_DIR;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)\$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX
        ;;

    # Python stacks → proxy to gunicorn/uvicorn on 8000 (streamlit on 8501)
    django|fastapi|flask)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    client_max_body_size 50M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location /static/ {
        alias $APP_DIR/static/;
        expires 30d;
    }

    location /media/ {
        alias $APP_DIR/media/;
        expires 30d;
    }

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }
}
NGINX
        ;;

    streamlit)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    location / {
        proxy_pass http://127.0.0.1:8501;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 86400;
    }

    location /_stcore/stream {
        proxy_pass http://127.0.0.1:8501/_stcore/stream;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX
        ;;

    python-generic)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
        ;;

    # Ruby — Puma on 3000
    rails|ruby-generic)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    root $APP_DIR/public;
    client_max_body_size 50M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \$uri @app;
    }

    location @app {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)\$ {
        expires 30d;
        add_header Cache-Control "public";
    }
}
NGINX
        ;;

    # Go / Rust / Java / .NET → proxy to 8080 (or 5000 for .NET)
    go|rust|spring-boot|java-generic)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    client_max_body_size 50M;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300;
    }
}
NGINX
        ;;

    dotnet)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
        ;;

    # Phoenix (Elixir) → port 4000
    phoenix)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
        ;;

    # Docker stacks → proxy to container on port 80
    docker|docker-compose)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
        ;;

    # Static → serve files directly
    static)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;

    root $APP_DIR/public;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        try_files \$uri \$uri/ =404;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)\$ {
        expires 365d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX
        ;;

    # Fallback
    *)
        cat > /etc/nginx/sites-available/app <<NGINX
server {
    listen 80;
    server_name $DOMAIN _;
    root $APP_DIR/public;
    index index.html;
    location / { try_files \$uri \$uri/ =404; }
}
NGINX
        ;;
esac

# Enable nginx site
ln -sf /etc/nginx/sites-available/app /etc/nginx/sites-enabled/app
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "▶ [6/8] Installing project dependencies..."
cd $APP_DIR

case "$STACK" in
    monkeyslegion|laravel|symfony|drupal|wordpress|php-generic)
        if [ -f composer.json ]; then
            su - $SSH_USER -c "cd $APP_DIR && composer install --no-interaction --prefer-dist --optimize-autoloader --no-scripts 2>&1" || echo "WARN: composer install had issues"
        fi
        if [ -f package.json ]; then
            su - $SSH_USER -c "cd $APP_DIR && npm install && npm run build 2>&1" || echo "WARN: npm build had issues"
        fi
        ;;
    nextjs|nuxtjs|remix|sveltekit|astro|express|nestjs)
        if [ -f package.json ]; then
            su - $SSH_USER -c "cd $APP_DIR && npm install && npm run build 2>&1" || echo "WARN: npm build had issues"
            su - $SSH_USER -c "cd $APP_DIR && pm2 start npm --name app -- start"
            su - $SSH_USER -c "pm2 save"
        fi
        ;;
    react|vue|angular)
        if [ -f package.json ]; then
            su - $SSH_USER -c "cd $APP_DIR && npm install && npm run build 2>&1" || echo "WARN: npm build had issues"
        fi
        ;;
    django|fastapi|flask|streamlit|python-generic)
        if [ -f requirements.txt ]; then
            su - $SSH_USER -c "cd $APP_DIR && $APP_DIR/venv/bin/pip install -r requirements.txt 2>&1" || echo "WARN: pip install had issues"
        fi
        supervisorctl update
        supervisorctl start app || true
        ;;
    rails)
        if [ -f Gemfile ]; then
            su - $SSH_USER -c "cd $APP_DIR && bundle install 2>&1" || echo "WARN: bundle install had issues"
        fi
        supervisorctl update
        supervisorctl start app || true
        ;;
    go)
        if [ -f go.mod ]; then
            su - $SSH_USER -c "cd $APP_DIR && /usr/local/go/bin/go build -o $APP_DIR/app ./cmd/server 2>&1" || echo "WARN: go build had issues"
        fi
        supervisorctl update
        supervisorctl start app || true
        ;;
    rust)
        if [ -f Cargo.toml ]; then
            su - $SSH_USER -c "cd $APP_DIR && ~/.cargo/bin/cargo build --release 2>&1" || echo "WARN: cargo build had issues"
        fi
        supervisorctl update
        supervisorctl start app || true
        ;;
    spring-boot|java-generic)
        if [ -f pom.xml ]; then
            su - $SSH_USER -c "cd $APP_DIR && mvn package -DskipTests 2>&1" || echo "WARN: mvn build had issues"
        fi
        supervisorctl update
        supervisorctl start app || true
        ;;
    dotnet)
        su - $SSH_USER -c "cd $APP_DIR && dotnet build 2>&1" || echo "WARN: dotnet build had issues"
        supervisorctl update
        supervisorctl start app || true
        ;;
    docker-compose)
        if [ -f docker-compose.yml ]; then
            su - $SSH_USER -c "cd $APP_DIR && docker compose up -d 2>&1" || echo "WARN: docker compose had issues"
        fi
        ;;
    docker)
        if [ -f Dockerfile ]; then
            su - $SSH_USER -c "cd $APP_DIR && docker build -t app . && docker run -d --name app -p 8080:8080 app 2>&1" || echo "WARN: docker run had issues"
        fi
        ;;
esac

echo "▶ [7/8] Setting permissions & log directories..."

# Ownership
chown -R $SSH_USER:$SSH_USER "$APP_DIR"
chmod -R 755 "$APP_DIR"

# Log directories
mkdir -p /var/log/app
chown $SSH_USER:$SSH_USER /var/log/app

# App log rotation
cat > /etc/logrotate.d/app <<LOGROTATE
/var/log/app/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 $SSH_USER $SSH_USER
}
LOGROTATE

echo "▶ [8/8] Writing environment info..."

# Store metadata on the VM for reference
cat > /etc/monkeyscloud.json <<JSON
{
  "org": "${org_slug}",
  "project": "${project_slug}",
  "environment": "${env_slug}",
  "domain": "$DOMAIN",
  "stack": "$STACK",
  "user": "$SSH_USER",
  "provisioned_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
JSON

echo "✅ MonkeysCloud VM ready"
echo "   Domain: $DOMAIN"
echo "   Stack:  $STACK"
echo "   User:   $SSH_USER"
echo "   App:    $APP_DIR"
