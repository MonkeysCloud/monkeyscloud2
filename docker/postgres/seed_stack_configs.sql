INSERT INTO stack_configs (name, display_name, category, docker_image, scaffold_command, gitignore_template, enabled, created_at, updated_at) VALUES
('monkeyslegion', 'MonkeysLegion', 'PHP', 'composer:2', 'composer create-project monkeyscloud/monkeyslegion-skeleton . --no-interaction --prefer-dist', '/vendor/
/node_modules/
/.env
/storage/logs/*.log
/storage/cache/*
/.idea/
/.vscode/
.DS_Store', true, NOW(), NOW()),

('laravel', 'Laravel', 'PHP', 'composer:2', 'composer create-project laravel/laravel . --no-interaction --prefer-dist', '/vendor/
/node_modules/
/.env
/storage/*.key
/storage/logs/*.log
/bootstrap/cache/*
/.idea/
/.vscode/
.DS_Store', true, NOW(), NOW()),

('symfony', 'Symfony', 'PHP', 'composer:2', 'composer create-project symfony/skeleton . --no-interaction --prefer-dist', '/vendor/
/var/
/.env.local
/.idea/
/.vscode/
.DS_Store', true, NOW(), NOW()),

('wordpress', 'WordPress', 'PHP', 'composer:2', 'composer create-project johnpbloch/wordpress . --no-interaction --prefer-dist', '/vendor/
/wp-content/uploads/
/.env
.DS_Store', true, NOW(), NOW()),

('nextjs', 'Next.js', 'Node.js', 'node:20', 'npx -y create-next-app@latest . --ts --app --tailwind --eslint --src-dir --no-git --use-npm', '/node_modules/
/.next/
/out/
/.env.local
.DS_Store', true, NOW(), NOW()),

('nuxtjs', 'Nuxt.js', 'Node.js', 'node:20', 'npx -y nuxi@latest init . --no-git', '/node_modules/
/.nuxt/
/.output/
/.env
.DS_Store', true, NOW(), NOW()),

('react', 'React (Vite)', 'Node.js', 'node:20', 'npx -y create-vite@latest . --template react-ts && npm install', '/node_modules/
/dist/
/.env.local
.DS_Store', true, NOW(), NOW()),

('vue', 'Vue (Vite)', 'Node.js', 'node:20', 'npx -y create-vite@latest . --template vue-ts && npm install', '/node_modules/
/dist/
/.env.local
.DS_Store', true, NOW(), NOW()),

('angular', 'Angular', 'Node.js', 'node:20', 'npx -y @angular/cli@latest new app --directory . --skip-git --defaults', '/node_modules/
/dist/
/.angular/
.DS_Store', true, NOW(), NOW()),

('express', 'Express', 'Node.js', 'node:20', 'npx -y express-generator --no-view . && npm install', '/node_modules/
/.env
.DS_Store', true, NOW(), NOW()),

('nestjs', 'NestJS', 'Node.js', 'node:20', 'npx -y @nestjs/cli@latest new . --skip-git --package-manager npm', '/node_modules/
/dist/
/.env
.DS_Store', true, NOW(), NOW()),

('django', 'Django', 'Python', 'python:3.12', 'pip install django && django-admin startproject app . && pip freeze > requirements.txt', '__pycache__/
*.py[cod]
*.so
/venv/
/.env
db.sqlite3
.DS_Store', true, NOW(), NOW()),

('fastapi', 'FastAPI', 'Python', 'python:3.12', 'pip install fastapi uvicorn && pip freeze > requirements.txt && mkdir -p app && printf "from fastapi import FastAPI\napp = FastAPI()\n\n@app.get(\"/\")\ndef root():\n    return {\"message\": \"Hello World\"}\n" > app/main.py', '__pycache__/
*.py[cod]
/venv/
/.env
.DS_Store', true, NOW(), NOW()),

('flask', 'Flask', 'Python', 'python:3.12', 'pip install flask && pip freeze > requirements.txt && printf "from flask import Flask\napp = Flask(__name__)\n\n@app.route(\"/\")\ndef hello():\n    return \"Hello World\"\n" > app.py', '__pycache__/
*.py[cod]
/venv/
/.env
.DS_Store', true, NOW(), NOW()),

('go', 'Go', 'Go', 'golang:1.22', 'go mod init app && mkdir -p cmd/server && printf "package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello World\")\n}\n" > cmd/server/main.go', '/vendor/
*.exe
*.test
*.out
.DS_Store', true, NOW(), NOW()),

('rust', 'Rust', 'Rust', 'rust:1.77', 'cargo init --name app .', '/target/
Cargo.lock
.DS_Store', true, NOW(), NOW()),

('spring-boot', 'Spring Boot', 'Java', 'maven:3.9-eclipse-temurin-21', 'curl -sL https://start.spring.io/starter.tgz -d type=maven-project -d language=java -d bootVersion=3.2.5 -d groupId=com.app -d artifactId=app -d name=app | tar -xzf - --strip-components=1', '/target/
*.class
*.jar
*.war
/.idea/
/.vscode/
.DS_Store', true, NOW(), NOW()),

('dotnet', '.NET', '.NET', 'mcr.microsoft.com/dotnet/sdk:8.0', 'dotnet new webapi -n App -o . --no-https', '/bin/
/obj/
*.user
.DS_Store', true, NOW(), NOW()),

('rails', 'Ruby on Rails', 'Ruby', 'ruby:3.3', 'gem install rails --no-document && rails new . --skip-git --api --database=postgresql', '/log/*
/tmp/
/vendor/bundle/
/.env
.DS_Store', true, NOW(), NOW()),

('static', 'Static Site', 'Other', 'alpine:3.19', 'mkdir -p public && printf "<!DOCTYPE html>\n<html>\n<head><title>Hello</title></head>\n<body><h1>Hello World</h1></body>\n</html>\n" > public/index.html', '.DS_Store', true, NOW(), NOW()),

('docker', 'Docker', 'Other', 'alpine:3.19', 'printf "FROM alpine:3.19\nWORKDIR /app\nCOPY . .\nCMD [\"echo\", \"Hello World\"]\n" > Dockerfile', '.DS_Store', true, NOW(), NOW())

ON CONFLICT (name) DO NOTHING;
