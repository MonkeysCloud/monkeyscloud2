INSERT INTO stack_configs (name, display_name, category, docker_image, scaffold_command, gitignore_template, enabled, created_at, updated_at) VALUES
('drupal', 'Drupal', 'PHP', 'composer:2', 'composer create-project drupal/recommended-project . --no-interaction --prefer-dist', '/vendor/
/web/sites/default/files/
/.env
.DS_Store', true, NOW(), NOW()),

('php-generic', 'PHP Generic', 'PHP', 'composer:2', 'composer init --name=app/app --no-interaction && mkdir -p public && printf "<?php\nphpinfo();\n" > public/index.php', '/vendor/
/.env
.DS_Store', true, NOW(), NOW()),

('remix', 'Remix', 'Node.js', 'node:20', 'npx -y create-remix@latest . --no-git-init --no-install && npm install', '/node_modules/
/build/
/.env
.DS_Store', true, NOW(), NOW()),

('sveltekit', 'SvelteKit', 'Node.js', 'node:20', 'npx -y create-svelte@latest . --no-git && npm install', '/node_modules/
/build/
/.svelte-kit/
/.env
.DS_Store', true, NOW(), NOW()),

('astro', 'Astro', 'Node.js', 'node:20', 'npx -y create-astro@latest . --no-git --install --template basics', '/node_modules/
/dist/
/.env
.DS_Store', true, NOW(), NOW()),

('streamlit', 'Streamlit', 'Python', 'python:3.12', 'pip install streamlit && pip freeze > requirements.txt && printf "import streamlit as st\n\nst.title(\"Hello World\")\nst.write(\"Welcome to Streamlit!\")\n" > app.py', '__pycache__/
*.py[cod]
/venv/
/.env
.DS_Store', true, NOW(), NOW()),

('python-generic', 'Python Generic', 'Python', 'python:3.12', 'printf "#!/usr/bin/env python3\n\ndef main():\n    print(\"Hello World\")\n\nif __name__ == \"__main__\":\n    main()\n" > main.py && printf "# requirements\n" > requirements.txt', '__pycache__/
*.py[cod]
/venv/
/.env
.DS_Store', true, NOW(), NOW()),

('ruby-generic', 'Ruby Generic', 'Ruby', 'ruby:3.3', 'bundle init && printf "source \"https://rubygems.org\"\n" > Gemfile && printf "puts \"Hello World\"\n" > app.rb', '/vendor/bundle/
/.env
.DS_Store', true, NOW(), NOW()),

('java-generic', 'Java Generic', 'Java', 'maven:3.9-eclipse-temurin-21', 'mvn archetype:generate -DgroupId=com.app -DartifactId=app -DarchetypeArtifactId=maven-archetype-quickstart -DinteractiveMode=false && mv app/* . && mv app/.* . 2>/dev/null; rmdir app', '/target/
*.class
*.jar
/.idea/
.DS_Store', true, NOW(), NOW()),

('phoenix', 'Phoenix', 'Elixir', 'elixir:1.16', 'mix local.hex --force && mix local.rebar --force && mix archive.install hex phx_new --force && mix phx.new . --app app --no-ecto --no-git --install', '/_build/
/deps/
/.elixir_ls/
/.env
.DS_Store', true, NOW(), NOW()),

('docker-compose', 'Docker Compose', 'Other', 'alpine:3.19', 'printf "services:\n  app:\n    build: .\n    ports:\n      - \"8080:8080\"\n" > docker-compose.yml && printf "FROM alpine:3.19\nWORKDIR /app\nCOPY . .\nCMD [\"echo\", \"Hello World\"]\n" > Dockerfile', '.DS_Store', true, NOW(), NOW())

ON CONFLICT (name) DO NOTHING;
