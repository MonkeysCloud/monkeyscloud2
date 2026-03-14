-- Fix php-generic: --ignore-platform-reqs was appended after the printf redirect
UPDATE stack_configs SET scaffold_command = 'composer init --name=app/app --no-interaction --ignore-platform-reqs && mkdir -p public && printf "<?php\nphpinfo();\n" > public/index.php' WHERE name = 'php-generic';

-- Fix nuxtjs: nuxi init needs --force for non-interactive
UPDATE stack_configs SET scaffold_command = 'npx -y nuxi@latest init . --force --no-git' WHERE name = 'nuxtjs';

-- Fix remix: create-remix needs --yes for non-interactive
UPDATE stack_configs SET scaffold_command = 'npx -y create-remix@latest . --yes --no-git-init --no-install && npm install' WHERE name = 'remix';

-- Fix sveltekit: use sv create instead of create-svelte (interactive)
UPDATE stack_configs SET scaffold_command = 'npx -y sv create . --template minimal --types ts --no-install --no-add-ons && npm install' WHERE name = 'sveltekit';

-- Fix angular: add --style=css --routing for non-interactive
UPDATE stack_configs SET scaffold_command = 'npx -y @angular/cli@latest new app --directory . --skip-git --defaults --style=css --routing' WHERE name = 'angular';

-- Fix ruby-generic: remove bundle init (needs bundler), just write files
UPDATE stack_configs SET scaffold_command = E'printf "source \\\"https://rubygems.org\\\"\\n" > Gemfile && printf "puts \\\"Hello World\\\"\\n" > app.rb' WHERE name = 'ruby-generic';

-- Fix java-generic: mv app/.* fails with glob, use cp -r instead
UPDATE stack_configs SET scaffold_command = 'mvn archetype:generate -DgroupId=com.app -DartifactId=app -DarchetypeArtifactId=maven-archetype-quickstart -DinteractiveMode=false && cp -r app/* . && cp -r app/.[!.]* . 2>/dev/null; rm -rf app' WHERE name = 'java-generic';

-- Fix phoenix: use alpine image, skip install (avoids native compilation issues)
UPDATE stack_configs SET docker_image = 'elixir:1.16-alpine', scaffold_command = 'mix local.hex --force && mix local.rebar --force && mix archive.install hex phx_new --force && mix phx.new . --app app --no-ecto --no-git --no-install' WHERE name = 'phoenix';

-- Fix rails: skip bundle to avoid native extension issues in minimal container
UPDATE stack_configs SET scaffold_command = 'gem install rails --no-document && rails new . --skip-git --api --skip-bundle' WHERE name = 'rails';

-- Fix astro: add --skip-houston for non-interactive
UPDATE stack_configs SET scaffold_command = 'npx -y create-astro@latest . --template basics --install --no-git --typescript strict --skip-houston' WHERE name = 'astro';

-- Fix nestjs: skip-install then npm install to avoid issues
UPDATE stack_configs SET scaffold_command = 'npx -y @nestjs/cli@latest new . --skip-git --skip-install --package-manager npm && npm install' WHERE name = 'nestjs';

-- Fix nextjs: add --import-alias to avoid interactive prompt
UPDATE stack_configs SET scaffold_command = E'npx -y create-next-app@latest . --ts --app --tailwind --eslint --src-dir --no-git --use-npm --import-alias "@/*"' WHERE name = 'nextjs';
