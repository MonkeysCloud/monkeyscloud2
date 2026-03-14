#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# MonkeysCloud — Initialize Git Repo with Stack Skeleton
# Usage: ./init-repo.sh <stack> <app_dir> [git_repo_url] [project_name]
#
# Creates a runnable project skeleton, .gitignore, .env template,
# deployment config, and pushes to the Git server if URL is provided.
# ═══════════════════════════════════════════════════════════════════
set -euo pipefail

STACK="$1"
APP_DIR="$2"
GIT_REPO_URL="${3:-}"
PROJECT_NAME="${4:-app}"

cd "$APP_DIR"

echo "▶ Initializing project skeleton for stack: $STACK"

# ═══════════════════════════════════════════════════════════════════
#  Helper: create a standard .gitignore
# ═══════════════════════════════════════════════════════════════════
create_gitignore() {
    cat > .gitignore <<'GITIGNORE'
# OS
.DS_Store
Thumbs.db

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# Env
.env
.env.local
.env.production
.env.*.local

GITIGNORE

    # Stack-specific ignores
    case "$STACK" in
        monkeyslegion|laravel|symfony|drupal|php-generic)
            cat >> .gitignore <<'GITIGNORE'
# PHP
/vendor/
composer.lock
*.cache
/storage/logs/
/bootstrap/cache/
GITIGNORE
            ;;
        wordpress)
            cat >> .gitignore <<'GITIGNORE'
# WordPress
/wp-content/uploads/
/wp-content/upgrade/
/wp-content/cache/
wp-config.php
GITIGNORE
            ;;
        nextjs|nuxtjs|remix|sveltekit|astro|express|nestjs|react|vue|angular)
            cat >> .gitignore <<'GITIGNORE'
# Node
node_modules/
dist/
build/
.next/
.nuxt/
.output/
.svelte-kit/
.astro/
*.tsbuildinfo
npm-debug.log*
GITIGNORE
            ;;
        django|fastapi|flask|streamlit|python-generic)
            cat >> .gitignore <<'GITIGNORE'
# Python
venv/
__pycache__/
*.py[cod]
*.egg-info/
dist/
build/
*.db
*.sqlite3
GITIGNORE
            ;;
        rails|ruby-generic)
            cat >> .gitignore <<'GITIGNORE'
# Ruby
/log/
/tmp/
/storage/
.bundle/
/vendor/bundle/
GITIGNORE
            ;;
        go)
            cat >> .gitignore <<'GITIGNORE'
# Go
/app
/bin/
*.exe
GITIGNORE
            ;;
        rust)
            cat >> .gitignore <<'GITIGNORE'
# Rust
/target/
Cargo.lock
GITIGNORE
            ;;
        spring-boot|java-generic)
            cat >> .gitignore <<'GITIGNORE'
# Java
/target/
*.class
*.jar
*.war
.gradle/
build/
GITIGNORE
            ;;
        dotnet)
            cat >> .gitignore <<'GITIGNORE'
# .NET
bin/
obj/
*.user
*.suo
GITIGNORE
            ;;
        docker|docker-compose)
            cat >> .gitignore <<'GITIGNORE'
# Docker
.docker/
*.log
GITIGNORE
            ;;
    esac
}

# ═══════════════════════════════════════════════════════════════════
#  Helper: create deploy.sh for each stack
# ═══════════════════════════════════════════════════════════════════
create_deploy_script() {
    cat > deploy.sh <<DEPLOY
#!/bin/bash
# MonkeysCloud deploy script — $STACK
set -euo pipefail
cd "\$(dirname "\$0")"

echo "▶ Pulling latest code..."
git pull origin \$(git rev-parse --abbrev-ref HEAD)

DEPLOY

    case "$STACK" in
        monkeyslegion|laravel|symfony|drupal|php-generic)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing PHP dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction

echo "▶ Building frontend assets..."
if [ -f package.json ]; then
    npm ci --production=false
    npm run build 2>/dev/null || true
fi

echo "▶ Running migrations..."
php artisan migrate --force 2>/dev/null || true

echo "▶ Clearing caches..."
php artisan config:cache 2>/dev/null || true
php artisan route:cache 2>/dev/null || true
php artisan view:cache 2>/dev/null || true

echo "▶ Restarting PHP-FPM..."
sudo systemctl restart php8.4-fpm
DEPLOY
            ;;
        wordpress)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Setting permissions..."
sudo chown -R deploy:deploy .
sudo chmod -R 755 wp-content/

echo "✅ WordPress updated"
DEPLOY
            ;;
        nextjs)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
npm ci

echo "▶ Building..."
npm run build

echo "▶ Restarting app..."
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
DEPLOY
            ;;
        nuxtjs)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
npm ci

echo "▶ Building..."
npm run build

echo "▶ Restarting app..."
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
DEPLOY
            ;;
        remix|sveltekit|astro)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
npm ci

echo "▶ Building..."
npm run build

echo "▶ Restarting app..."
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
DEPLOY
            ;;
        express|nestjs)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
npm ci --production

echo "▶ Building..."
npm run build 2>/dev/null || true

echo "▶ Restarting app..."
pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
DEPLOY
            ;;
        react|vue|angular)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
npm ci

echo "▶ Building..."
npm run build

echo "▶ Reloading nginx..."
sudo systemctl reload nginx
DEPLOY
            ;;
        django|flask)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "▶ Running migrations..."
python manage.py migrate 2>/dev/null || true

echo "▶ Collecting static files..."
python manage.py collectstatic --noinput 2>/dev/null || true

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        fastapi)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        streamlit)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        python-generic)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
source venv/bin/activate
pip install -r requirements.txt --quiet

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        rails)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
bundle install --deployment --without development test

echo "▶ Running migrations..."
RAILS_ENV=production bundle exec rails db:migrate

echo "▶ Precompiling assets..."
RAILS_ENV=production bundle exec rails assets:precompile

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        ruby-generic)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
bundle install
DEPLOY
            ;;
        go)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Building..."
go build -o app .

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        rust)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Building..."
source $HOME/.cargo/env
cargo build --release

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        spring-boot)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Building..."
./mvnw clean package -DskipTests

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        java-generic)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Building..."
mvn clean package -DskipTests 2>/dev/null || javac -d bin src/main/java/*.java

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        dotnet)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Building..."
dotnet publish -c Release -o out

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        phoenix)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Installing dependencies..."
MIX_ENV=prod mix deps.get --only prod
MIX_ENV=prod mix compile

echo "▶ Running migrations..."
MIX_ENV=prod mix ecto.migrate 2>/dev/null || true

echo "▶ Restarting app..."
sudo supervisorctl restart app
DEPLOY
            ;;
        docker|docker-compose)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Building and starting containers..."
docker compose down
docker compose up -d --build

echo "✅ Containers running"
DEPLOY
            ;;
        static)
            cat >> deploy.sh <<'DEPLOY'
echo "▶ Reloading nginx..."
sudo systemctl reload nginx
DEPLOY
            ;;
    esac

    cat >> deploy.sh <<'DEPLOY'

echo "✅ Deploy complete"
DEPLOY

    chmod +x deploy.sh
}

# ═══════════════════════════════════════════════════════════════════
#  STACK SKELETONS
# ═══════════════════════════════════════════════════════════════════

case "$STACK" in

    # ── MonkeysLegion ───────────────────────────────────────────
    monkeyslegion)
        composer create-project monkeyscloud/monkeyslegion-skeleton . --no-interaction --prefer-dist
        ;;

    # ── Laravel ─────────────────────────────────────────────────
    laravel)
        composer create-project laravel/laravel . --no-interaction --prefer-dist
        cp .env.example .env 2>/dev/null || true
        php artisan key:generate --force 2>/dev/null || true
        ;;

    # ── Symfony ─────────────────────────────────────────────────
    symfony)
        composer create-project symfony/skeleton . --no-interaction --prefer-dist
        composer require webapp --no-interaction 2>/dev/null || true
        ;;

    # ── WordPress ───────────────────────────────────────────────
    wordpress)
        curl -sO https://wordpress.org/latest.tar.gz
        tar xz --strip-components=1
        rm -f latest.tar.gz

        # wp-config template
        cp wp-config-sample.php wp-config.php
        sed -i "s/database_name_here/\${DB_NAME:-wordpress}/" wp-config.php
        sed -i "s/username_here/\${DB_USERNAME:-root}/" wp-config.php
        sed -i "s/password_here/\${DB_PASSWORD:-}/" wp-config.php
        sed -i "s/localhost/\${DB_HOST:-localhost}/" wp-config.php

        # Generate salts
        SALTS=$(curl -s https://api.wordpress.org/secret-key/1.1/salt/)
        # Replace the placeholder salts block
        sed -i '/AUTH_KEY/d; /SECURE_AUTH_KEY/d; /LOGGED_IN_KEY/d; /NONCE_KEY/d; /AUTH_SALT/d; /SECURE_AUTH_SALT/d; /LOGGED_IN_SALT/d; /NONCE_SALT/d' wp-config.php
        echo "$SALTS" >> wp-config.php

        mkdir -p wp-content/uploads
        chmod 755 wp-content/uploads
        ;;

    # ── Drupal ──────────────────────────────────────────────────
    drupal)
        composer create-project drupal/recommended-project . --no-interaction --prefer-dist
        mkdir -p web/sites/default/files
        chmod 755 web/sites/default/files
        cp web/sites/default/default.settings.php web/sites/default/settings.php 2>/dev/null || true
        ;;

    # ── PHP Generic ─────────────────────────────────────────────
    php-generic)
        composer init --no-interaction --name="monkeyscloud/$PROJECT_NAME"
        mkdir -p public src

        cat > public/index.php <<'EOF'
<?php
declare(strict_types=1);

require_once __DIR__ . '/../vendor/autoload.php';

header('Content-Type: text/html; charset=utf-8');
?>
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title><?= htmlspecialchars($projectName ?? 'MonkeysCloud App') ?></title></head>
<body>
    <h1>MonkeysCloud App</h1>
    <p>PHP <?= PHP_VERSION ?> | Server time: <?= date('Y-m-d H:i:s') ?></p>
</body>
</html>
EOF
        ;;

    # ── Next.js ─────────────────────────────────────────────────
    nextjs)
        npx -y create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-git

        # PM2 ecosystem file
        cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: 'npm',
    args: 'start',
    cwd: '$APP_DIR',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
        ;;

    # ── Nuxt.js ─────────────────────────────────────────────────
    nuxtjs)
        npx -y nuxi@latest init . --force --packageManager npm --no-git-init
        npm install

        cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: '.output/server/index.mjs',
    cwd: '$APP_DIR',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      NITRO_PORT: 3000
    }
  }]
};
EOF
        ;;

    # ── Remix ───────────────────────────────────────────────────
    remix)
        npx -y create-remix@latest . --no-git-init --no-install --template remix-run/remix/templates/remix
        npm install

        cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: 'npm',
    args: 'start',
    cwd: '$APP_DIR',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
        ;;

    # ── SvelteKit ───────────────────────────────────────────────
    sveltekit)
        npx -y sv create . --template minimal --types ts --no-add-ons --no-install
        npm install
        npm install -D @sveltejs/adapter-node

        # Use node adapter for production
        cat > svelte.config.js <<'EOF'
import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build' })
  }
};
EOF

        cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: 'build/index.js',
    cwd: '$APP_DIR',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
        ;;

    # ── Astro ───────────────────────────────────────────────────
    astro)
        npx -y create-astro@latest . --template basics --install --no-git --typescript strict
        npm install @astrojs/node

        cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: './dist/server/entry.mjs',
    cwd: '$APP_DIR',
    env_production: {
      NODE_ENV: 'production',
      HOST: '0.0.0.0',
      PORT: 3000
    }
  }]
};
EOF
        ;;

    # ── Express ─────────────────────────────────────────────────
    express)
        npm init -y
        npm install express cors helmet morgan dotenv
        npm install -D nodemon

        cat > index.js <<'EOF'
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
    res.json({ message: 'MonkeysCloud App', status: 'running', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});
EOF

        # Add scripts to package.json
        node -e "
const pkg = require('./package.json');
pkg.scripts = { ...pkg.scripts, start: 'node index.js', dev: 'nodemon index.js' };
require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2));
"

        cat > .env.example <<'EOF'
PORT=3000
NODE_ENV=production
EOF

        cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: 'index.js',
    cwd: '$APP_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
        ;;

    # ── NestJS ──────────────────────────────────────────────────
    nestjs)
        npx -y @nestjs/cli@latest new . --package-manager npm --skip-git --strict

        cat > ecosystem.config.js <<EOF
module.exports = {
  apps: [{
    name: '$PROJECT_NAME',
    script: 'dist/main.js',
    cwd: '$APP_DIR',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOF
        ;;

    # ── React (Vite) ────────────────────────────────────────────
    react)
        npx -y create-vite@latest . --template react-ts
        npm install
        ;;

    # ── Vue (Vite) ──────────────────────────────────────────────
    vue)
        npx -y create-vite@latest . --template vue-ts
        npm install
        ;;

    # ── Angular ─────────────────────────────────────────────────
    angular)
        npx -y @angular/cli@latest new app --directory . --skip-git --defaults
        ;;

    # ── Django ──────────────────────────────────────────────────
    django)
        python3 -m venv venv
        source venv/bin/activate
        pip install django gunicorn psycopg2-binary mysqlclient python-dotenv whitenoise
        django-admin startproject app .
        pip freeze > requirements.txt

        # Configure Django for production readiness
        cat > .env.example <<'EOF'
DEBUG=False
SECRET_KEY=change-me-to-a-random-string
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
ALLOWED_HOSTS=*
EOF

        # Add whitenoise to settings
        python3 -c "
import re
settings = open('app/settings.py').read()
settings = settings.replace(
    \"'django.middleware.security.SecurityMiddleware',\",
    \"'django.middleware.security.SecurityMiddleware',\n    'whitenoise.middleware.WhiteNoiseMiddleware',\"
)
settings += '''
\nimport os
STATIC_ROOT = os.path.join(BASE_DIR, 'static')
STATICFILES_STORAGE = \"whitenoise.storage.CompressedManifestStaticFilesStorage\"
'''
open('app/settings.py', 'w').write(settings)
"
        mkdir -p static media
        ;;

    # ── FastAPI ─────────────────────────────────────────────────
    fastapi)
        python3 -m venv venv
        source venv/bin/activate
        pip install "fastapi[standard]" uvicorn[standard] python-dotenv sqlalchemy

        cat > main.py <<'EOF'
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MonkeysCloud App")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "MonkeysCloud App", "status": "running"}

@app.get("/health")
def health():
    return {"status": "ok"}
EOF

        cat > .env.example <<'EOF'
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
SECRET_KEY=change-me
EOF

        pip freeze > requirements.txt
        ;;

    # ── Flask ───────────────────────────────────────────────────
    flask)
        python3 -m venv venv
        source venv/bin/activate
        pip install flask gunicorn python-dotenv flask-cors

        cat > app.py <<'EOF'
from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/")
def index():
    return jsonify(message="MonkeysCloud App", status="running")

@app.route("/health")
def health():
    return jsonify(status="ok")

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
EOF

        cat > .env.example <<'EOF'
FLASK_ENV=production
SECRET_KEY=change-me
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
EOF

        pip freeze > requirements.txt
        ;;

    # ── Streamlit ───────────────────────────────────────────────
    streamlit)
        python3 -m venv venv
        source venv/bin/activate
        pip install streamlit pandas plotly

        cat > app.py <<'EOF'
import streamlit as st

st.set_page_config(page_title="MonkeysCloud App", page_icon="🐵", layout="wide")

st.title("🐵 MonkeysCloud App")
st.markdown("Welcome to your Streamlit application!")

col1, col2, col3 = st.columns(3)
col1.metric("Status", "Running ✅")
col2.metric("Framework", "Streamlit")
col3.metric("Python", "3.13")
EOF

        pip freeze > requirements.txt
        ;;

    # ── Python Generic ──────────────────────────────────────────
    python-generic)
        python3 -m venv venv
        source venv/bin/activate
        mkdir -p src

        cat > src/main.py <<'EOF'
"""MonkeysCloud App — Python"""

def main():
    print("MonkeysCloud App running")

if __name__ == "__main__":
    main()
EOF

        cat > requirements.txt <<'EOF'
# Add your dependencies here
EOF
        ;;

    # ── Rails ───────────────────────────────────────────────────
    rails)
        gem install rails --no-document
        rails new . --name "$PROJECT_NAME" --skip-git --database=postgresql --minimal --skip-test
        bundle install

        cat > .env.example <<'EOF'
DATABASE_URL=postgres://user:pass@localhost:5432/dbname
RAILS_ENV=production
SECRET_KEY_BASE=change-me
RAILS_SERVE_STATIC_FILES=true
EOF
        ;;

    # ── Ruby Generic ────────────────────────────────────────────
    ruby-generic)
        bundle init
        mkdir -p lib

        cat > lib/main.rb <<'EOF'
# MonkeysCloud App — Ruby
require 'webrick'

server = WEBrick::HTTPServer.new(Port: 3000)
server.mount_proc '/' do |_req, res|
  res.body = 'MonkeysCloud App'
end
trap('INT') { server.shutdown }
server.start
EOF

        cat >> Gemfile <<'EOF'

gem 'webrick'
EOF
        bundle install
        ;;

    # ── Go ──────────────────────────────────────────────────────
    go)
        go mod init "$PROJECT_NAME"

        cat > main.go <<'EOF'
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"message":   "MonkeysCloud App",
			"status":    "running",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	fmt.Printf("Server running on :%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}
EOF

        cat > Makefile <<'EOF'
.PHONY: build run

build:
	go build -o app .

run: build
	./app
EOF
        ;;

    # ── Rust ────────────────────────────────────────────────────
    rust)
        # Create a web server project with Actix
        cargo init . --name "$PROJECT_NAME"

        # Add actix-web to Cargo.toml
        cat > Cargo.toml <<EOF
[package]
name = "$PROJECT_NAME"
version = "0.1.0"
edition = "2021"

[dependencies]
actix-web = "4"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
EOF

        cat > src/main.rs <<'EOF'
use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use serde::Serialize;

#[derive(Serialize)]
struct Status {
    message: String,
    status: String,
}

async fn index() -> impl Responder {
    HttpResponse::Ok().json(Status {
        message: "MonkeysCloud App".to_string(),
        status: "running".to_string(),
    })
}

async fn health() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    println!("Server running on :{}", port);

    HttpServer::new(|| {
        App::new()
            .route("/", web::get().to(index))
            .route("/health", web::get().to(health))
    })
    .bind(format!("0.0.0.0:{}", port))?
    .run()
    .await
}
EOF
        ;;

    # ── Spring Boot ─────────────────────────────────────────────
    spring-boot)
        curl -s "https://start.spring.io/starter.tgz?type=maven-project&language=java&bootVersion=3.4.0&groupId=cloud.monkeys&artifactId=$PROJECT_NAME&name=$PROJECT_NAME&packageName=cloud.monkeys.app&dependencies=web,actuator&javaVersion=21" | tar xz

        # Add a controller
        mkdir -p src/main/java/cloud/monkeys/app/controller
        cat > src/main/java/cloud/monkeys/app/controller/HomeController.java <<'EOF'
package cloud.monkeys.app.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HomeController {
    @GetMapping("/")
    public Map<String, String> index() {
        return Map.of("message", "MonkeysCloud App", "status", "running");
    }
}
EOF

        cat > .env.example <<'EOF'
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/dbname
SPRING_DATASOURCE_USERNAME=user
SPRING_DATASOURCE_PASSWORD=pass
SERVER_PORT=8080
EOF
        ;;

    # ── Java Generic ────────────────────────────────────────────
    java-generic)
        # Create Maven project structure
        mkdir -p src/main/java/app src/main/resources

        cat > pom.xml <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>cloud.monkeys</groupId>
    <artifactId>$PROJECT_NAME</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>
    <properties>
        <maven.compiler.source>21</maven.compiler.source>
        <maven.compiler.target>21</maven.compiler.target>
    </properties>
    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-jar-plugin</artifactId>
                <version>3.4.1</version>
                <configuration>
                    <archive>
                        <manifest>
                            <mainClass>app.App</mainClass>
                        </manifest>
                    </archive>
                </configuration>
            </plugin>
        </plugins>
    </build>
</project>
EOF

        cat > src/main/java/app/App.java <<'EOF'
package app;

import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class App {
    public static void main(String[] args) throws IOException {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/", exchange -> {
            String response = "{\"message\":\"MonkeysCloud App\",\"status\":\"running\"}";
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });

        server.createContext("/health", exchange -> {
            String response = "{\"status\":\"ok\"}";
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length());
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(response.getBytes());
            }
        });

        System.out.printf("Server running on :%d%n", port);
        server.start();
    }
}
EOF
        ;;

    # ── .NET ────────────────────────────────────────────────────
    dotnet)
        dotnet new web --name "$PROJECT_NAME" --output .

        # Replace minimal API with a proper endpoint
        cat > Program.cs <<'EOF'
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/", () => new { message = "MonkeysCloud App", status = "running" });
app.MapGet("/health", () => new { status = "ok" });

var port = Environment.GetEnvironmentVariable("PORT") ?? "5000";
app.Run($"http://0.0.0.0:{port}");
EOF
        ;;

    # ── Phoenix (Elixir) ───────────────────────────────────────
    phoenix)
        mix local.hex --force
        mix local.rebar --force
        mix archive.install hex phx_new --force
        mix phx.new . --app "$PROJECT_NAME" --no-ecto --no-install

        mix deps.get
        ;;

    # ── Docker ──────────────────────────────────────────────────
    docker)
        mkdir -p public

        cat > Dockerfile <<'EOF'
FROM nginx:alpine
COPY public/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
EOF

        cat > nginx.conf <<'EOF'
server {
    listen 8080;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}
EOF

        cat > docker-compose.yml <<'EOF'
services:
  app:
    build: .
    ports:
      - "8080:8080"
    restart: unless-stopped
EOF

        cat > public/index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MonkeysCloud App</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
        .card { text-align: center; padding: 2rem; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
        h1 { margin: 0; font-size: 2rem; }
        p { color: #94a3b8; }
    </style>
</head>
<body>
    <div class="card">
        <h1>🐵 MonkeysCloud App</h1>
        <p>Your Docker application is running</p>
    </div>
</body>
</html>
EOF

        cat > .dockerignore <<'EOF'
.git
.gitignore
.env
*.md
EOF
        ;;

    # ── Docker Compose ──────────────────────────────────────────
    docker-compose)
        mkdir -p public app

        cat > docker-compose.yml <<'EOF'
services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./public:/usr/share/nginx/html:ro
    restart: unless-stopped

  # Uncomment to add a database
  # db:
  #   image: postgres:16-alpine
  #   environment:
  #     POSTGRES_DB: app
  #     POSTGRES_USER: app
  #     POSTGRES_PASSWORD: secret
  #   volumes:
  #     - pgdata:/var/lib/postgresql/data

# volumes:
#   pgdata:
EOF

        cat > public/index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MonkeysCloud App</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: #e2e8f0; }
        .card { text-align: center; padding: 2rem; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
    </style>
</head>
<body>
    <div class="card">
        <h1>🐵 MonkeysCloud App</h1>
        <p>Docker Compose is running</p>
    </div>
</body>
</html>
EOF

        cat > .dockerignore <<'EOF'
.git
.gitignore
.env
*.md
EOF
        ;;

    # ── Static ──────────────────────────────────────────────────
    static)
        mkdir -p public/css public/js public/img

        cat > public/index.html <<'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MonkeysCloud App</title>
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <div class="container">
        <h1>🐵 MonkeysCloud App</h1>
        <p>Your static website is live</p>
    </div>
    <script src="/js/main.js"></script>
</body>
</html>
EOF

        cat > public/css/style.css <<'EOF'
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: system-ui, -apple-system, sans-serif;
    display: flex; align-items: center; justify-content: center;
    height: 100vh;
    background: linear-gradient(135deg, #0f172a, #1e293b);
    color: #e2e8f0;
}
.container { text-align: center; }
h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
p { color: #94a3b8; font-size: 1.1rem; }
EOF

        cat > public/js/main.js <<'EOF'
console.log('MonkeysCloud App loaded');
EOF
        ;;

    *)
        echo "ERROR: Unknown stack: $STACK"
        exit 1
        ;;
esac

# ═══════════════════════════════════════════════════════════════════
#  Common post-setup
# ═══════════════════════════════════════════════════════════════════

# Create .gitignore
create_gitignore

# Create deploy.sh
create_deploy_script

# Create README
cat > README.md <<README
# $PROJECT_NAME

Powered by [MonkeysCloud](https://monkeys.cloud)

## Stack: $STACK

### Development

\`\`\`bash
# See deploy.sh for deployment commands
chmod +x deploy.sh
./deploy.sh
\`\`\`

### Deploy

Push to the configured branch and auto-deploy will handle the rest, or run:

\`\`\`bash
./deploy.sh
\`\`\`
README

# ── Git setup ──────────────────────────────────────────────────
if [ -n "$GIT_REPO_URL" ]; then
    git init
    git add -A
    git commit -m "🐵 Initial project setup ($STACK) — MonkeysCloud"
    git branch -M main
    git remote add origin "$GIT_REPO_URL"
    git push -u origin main
    echo "✅ Skeleton pushed to git repo"
fi

echo "✅ Stack skeleton initialized: $STACK"
echo "   Directory: $APP_DIR"
echo "   Deploy:    ./deploy.sh"
