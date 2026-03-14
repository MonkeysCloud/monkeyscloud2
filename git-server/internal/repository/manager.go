package repository

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/go-git/go-git/v5/plumbing/object"
	"github.com/rs/zerolog/log"
)

// Manager handles Git repository operations.
// Uses go-git for reads (fast, no subprocess) and exec("git") for write
// operations like merge/rebase that go-git doesn't fully support.
type Manager struct {
	basePath string
}

// NewManager creates a repository manager rooted at basePath.
func NewManager(basePath string) *Manager {
	return &Manager{basePath: basePath}
}

// RepoPath returns the filesystem path for an org/project bare repo.
func (m *Manager) RepoPath(org, project string) string {
	return filepath.Join(m.basePath, org, project+".git")
}

// =============================================================================
// Repository Lifecycle
// =============================================================================

// TemplatesRepoPath returns the path to the system templates bare repo.
func (m *Manager) TemplatesRepoPath() string {
	return filepath.Join(m.basePath, "_system", "templates.git")
}

// knownStacks returns all supported stack identifiers.
func knownStacks() []string {
	return []string{
		"monkeyslegion", "laravel", "symfony", "wordpress", "drupal", "php-generic",
		"nextjs", "nuxtjs", "remix", "sveltekit", "astro",
		"express", "nestjs", "react", "vue", "angular",
		"django", "fastapi", "flask", "streamlit", "python-generic",
		"rails", "ruby-generic",
		"go", "rust",
		"spring-boot", "java-generic",
		"dotnet", "phoenix", "static",
		"docker", "docker-compose",
	}
}

// InitTemplatesRepo ensures the _system/templates.git repo exists and every
// known stack has a branch. Call once at server startup.
func (m *Manager) InitTemplatesRepo() error {
	tmplPath := m.TemplatesRepoPath()

	// Create bare repo if it doesn't exist (use git CLI for proper structure)
	if _, err := os.Stat(filepath.Join(tmplPath, "HEAD")); err != nil {
		if err := os.MkdirAll(tmplPath, 0755); err != nil {
			return fmt.Errorf("mkdir templates: %w", err)
		}
		cmd := exec.Command("git", "init", "--bare", tmplPath)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("init templates repo: %s: %w", string(out), err)
		}
		log.Info().Msg("Created templates repository")
	}

	// Seed any missing stack branches
	seeded := 0
	stacks := knownStacks()
	for _, stack := range stacks {
		if m.templateBranchExists(stack) {
			continue
		}
		files := stackFiles("{{ORG}}", "{{PROJECT}}", stack)
		if err := m.seedTemplateBranch(stack, files); err != nil {
			log.Warn().Err(err).Str("stack", stack).Msg("Failed to seed template branch")
		} else {
			seeded++
		}
	}

	// Set HEAD to the first stack branch so upload-pack works for cloning
	if len(stacks) > 0 {
		cmd := exec.Command("git", "-C", tmplPath, "symbolic-ref", "HEAD", "refs/heads/"+stacks[0])
		_ = cmd.Run()
	}

	if seeded > 0 {
		log.Info().Int("seeded", seeded).Msg("Seeded new template branches")
	} else {
		log.Info().Msg("All template branches up to date")
	}

	return nil
}

// seedTemplateBranch creates an orphan branch in the templates repo with the given files.
func (m *Manager) seedTemplateBranch(stack string, files map[string]string) error {
	tmplPath := m.TemplatesRepoPath()
	tmpDir, err := os.MkdirTemp("", "mc-tmpl-seed-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	// Init a fresh repo (not a clone — we need an orphan branch)
	cmd := exec.Command("git", "init", tmpDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("init: %s: %w", string(out), err)
	}

	// Write template files
	for path, content := range files {
		fullPath := filepath.Join(tmpDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return err
		}
	}

	// Create orphan branch with the stack name
	cmd = exec.Command("git", "-C", tmpDir, "checkout", "--orphan", stack)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("orphan: %s: %w", string(out), err)
	}

	// Stage and commit
	cmd = exec.Command("git", "-C", tmpDir, "add", "-A")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("add: %s: %w", string(out), err)
	}

	cmd = exec.Command("git", "-C", tmpDir,
		"-c", "user.name=MonkeysCloud",
		"-c", "user.email=noreply@monkeys.cloud",
		"commit", "-m", "Template: "+stack)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("commit: %s: %w", string(out), err)
	}

	// Push the orphan branch to the bare templates repo
	cmd = exec.Command("git", "-C", tmpDir, "remote", "add", "origin", tmplPath)
	cmd.Run()

	cmd = exec.Command("git", "-C", tmpDir, "push", "origin", stack)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("push: %s: %w", string(out), err)
	}

	return nil
}

// =============================================================================
// Template CRUD (for admin API)
// =============================================================================

// TemplateInfo represents a template branch with metadata.
type TemplateInfo struct {
	Name      string `json:"name"`
	FileCount int    `json:"file_count"`
	CommitSHA string `json:"commit_sha"`
	UpdatedAt string `json:"updated_at"`
}

// ListTemplates returns all template branches with metadata.
func (m *Manager) ListTemplates() ([]TemplateInfo, error) {
	tmplPath := m.TemplatesRepoPath()
	if _, err := os.Stat(filepath.Join(tmplPath, "HEAD")); err != nil {
		return nil, fmt.Errorf("templates repo not initialized")
	}

	// List branches
	cmd := exec.Command("git", "-C", tmplPath, "branch", "--format=%(refname:short)")
	out, err := cmd.Output()
	if err != nil {
		return []TemplateInfo{}, nil
	}

	var templates []TemplateInfo
	for _, name := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		ti := TemplateInfo{Name: name}

		// Get commit SHA and date
		cmd = exec.Command("git", "-C", tmplPath, "log", "-1", "--format=%H%n%aI", name)
		logOut, err := cmd.Output()
		if err == nil {
			parts := strings.SplitN(strings.TrimSpace(string(logOut)), "\n", 2)
			if len(parts) >= 1 {
				ti.CommitSHA = parts[0]
			}
			if len(parts) >= 2 {
				ti.UpdatedAt = parts[1]
			}
		}

		// Count files
		cmd = exec.Command("git", "-C", tmplPath, "ls-tree", "-r", "--name-only", name)
		treeOut, err := cmd.Output()
		if err == nil {
			lines := strings.Split(strings.TrimSpace(string(treeOut)), "\n")
			if len(lines) == 1 && lines[0] == "" {
				ti.FileCount = 0
			} else {
				ti.FileCount = len(lines)
			}
		}

		templates = append(templates, ti)
	}

	return templates, nil
}

// TemplateFileEntry represents a file in a template.
type TemplateFileEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"` // "file" or "dir"
	Size int64  `json:"size,omitempty"`
}

// GetTemplateFiles returns the file tree for a template branch.
func (m *Manager) GetTemplateFiles(stack string) ([]TemplateFileEntry, error) {
	tmplPath := m.TemplatesRepoPath()
	cmd := exec.Command("git", "-C", tmplPath, "ls-tree", "-r", "--long", stack)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("stack %q not found", stack)
	}

	var entries []TemplateFileEntry
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if line == "" {
			continue
		}
		// Format: <mode> <type> <hash> <size>\t<path>
		parts := strings.SplitN(line, "\t", 2)
		if len(parts) != 2 {
			continue
		}
		path := parts[1]
		meta := strings.Fields(parts[0])
		var size int64
		if len(meta) >= 4 {
			fmt.Sscanf(meta[3], "%d", &size)
		}
		entries = append(entries, TemplateFileEntry{
			Name: filepath.Base(path),
			Path: path,
			Type: "file",
			Size: size,
		})
	}

	return entries, nil
}

// GetTemplateFileContent returns the content of a file in a template branch.
func (m *Manager) GetTemplateFileContent(stack, path string) (string, error) {
	tmplPath := m.TemplatesRepoPath()
	cmd := exec.Command("git", "-C", tmplPath, "show", stack+":"+path)
	out, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("file %q not found in template %q", path, stack)
	}
	return string(out), nil
}

// UpdateTemplateFile updates or creates a file in a template branch.
func (m *Manager) UpdateTemplateFile(stack, path, content, commitMsg string) error {
	tmplPath := m.TemplatesRepoPath()

	tmpDir, err := os.MkdirTemp("", "mc-tmpl-edit-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	// Clone the branch
	cmd := exec.Command("git", "clone", "--single-branch", "--branch", stack, tmplPath, tmpDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("clone: %s: %w", string(out), err)
	}

	// Write the file
	fullPath := filepath.Join(tmpDir, path)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
		return err
	}

	// Stage, commit, push
	exec.Command("git", "-C", tmpDir, "add", "-A").Run()

	// Check if there are changes
	cmd = exec.Command("git", "-C", tmpDir, "diff", "--cached", "--quiet")
	if cmd.Run() == nil {
		return nil // no changes
	}

	if commitMsg == "" {
		commitMsg = "Update " + path
	}
	cmd = exec.Command("git", "-C", tmpDir,
		"-c", "user.name=MonkeysCloud",
		"-c", "user.email=noreply@monkeys.cloud",
		"commit", "-m", commitMsg)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("commit: %s: %w", string(out), err)
	}

	cmd = exec.Command("git", "-C", tmpDir, "push", "origin", stack)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("push: %s: %w", string(out), err)
	}

	return nil
}

// DeleteTemplateFile deletes a file from a template branch.
func (m *Manager) DeleteTemplateFile(stack, path string) error {
	tmplPath := m.TemplatesRepoPath()

	tmpDir, err := os.MkdirTemp("", "mc-tmpl-del-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	cmd := exec.Command("git", "clone", "--single-branch", "--branch", stack, tmplPath, tmpDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("clone: %s: %w", string(out), err)
	}

	fullPath := filepath.Join(tmpDir, path)
	if err := os.Remove(fullPath); err != nil {
		return fmt.Errorf("file not found: %w", err)
	}

	exec.Command("git", "-C", tmpDir, "add", "-A").Run()
	cmd = exec.Command("git", "-C", tmpDir,
		"-c", "user.name=MonkeysCloud",
		"-c", "user.email=noreply@monkeys.cloud",
		"commit", "-m", "Delete "+path)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("commit: %s: %w", string(out), err)
	}

	cmd = exec.Command("git", "-C", tmpDir, "push", "origin", stack)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("push: %s: %w", string(out), err)
	}
	return nil
}

// CreateTemplate creates a new template branch. If sourceStack is set, duplicates it.
func (m *Manager) CreateTemplate(stack, sourceStack string) error {
	if m.templateBranchExists(stack) {
		return fmt.Errorf("template %q already exists", stack)
	}

	tmplPath := m.TemplatesRepoPath()
	tmpDir, err := os.MkdirTemp("", "mc-tmpl-new-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	if sourceStack != "" && m.templateBranchExists(sourceStack) {
		// Duplicate from existing branch
		cmd := exec.Command("git", "clone", "--single-branch", "--branch", sourceStack, tmplPath, tmpDir)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("clone source: %s: %w", string(out), err)
		}

		// Create orphan branch from current files
		cmd = exec.Command("git", "-C", tmpDir, "checkout", "--orphan", stack)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("orphan: %s: %w", string(out), err)
		}

		exec.Command("git", "-C", tmpDir, "add", "-A").Run()
		cmd = exec.Command("git", "-C", tmpDir,
			"-c", "user.name=MonkeysCloud",
			"-c", "user.email=noreply@monkeys.cloud",
			"commit", "-m", "Template: "+stack+" (from "+sourceStack+")")
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("commit: %s: %w", string(out), err)
		}
	} else {
		// Create empty template with just README
		cmd := exec.Command("git", "init", tmpDir)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("init: %s: %w", string(out), err)
		}

		readme := "# {{PROJECT}}\n\n> Created with MonkeysCloud\n"
		gitignore := "# General\n.DS_Store\n*.log\n.env\n"
		os.WriteFile(filepath.Join(tmpDir, "README.md"), []byte(readme), 0644)
		os.WriteFile(filepath.Join(tmpDir, ".gitignore"), []byte(gitignore), 0644)

		cmd = exec.Command("git", "-C", tmpDir, "checkout", "--orphan", stack)
		cmd.Run()
		exec.Command("git", "-C", tmpDir, "add", "-A").Run()
		cmd = exec.Command("git", "-C", tmpDir,
			"-c", "user.name=MonkeysCloud",
			"-c", "user.email=noreply@monkeys.cloud",
			"commit", "-m", "Template: "+stack)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("commit: %s: %w", string(out), err)
		}
	}

	// Push to templates repo
	exec.Command("git", "-C", tmpDir, "remote", "remove", "origin").Run()
	exec.Command("git", "-C", tmpDir, "remote", "add", "origin", tmplPath).Run()

	cmd := exec.Command("git", "-C", tmpDir, "push", "origin", stack)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("push: %s: %w", string(out), err)
	}

	return nil
}

// DeleteTemplate removes a template branch.
func (m *Manager) DeleteTemplate(stack string) error {
	if !m.templateBranchExists(stack) {
		return fmt.Errorf("template %q not found", stack)
	}

	tmplPath := m.TemplatesRepoPath()
	cmd := exec.Command("git", "-C", tmplPath, "branch", "-D", stack)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("delete branch: %s: %w", string(out), err)
	}
	return nil
}

// InitBare creates a new bare repository.
func (m *Manager) InitBare(org, project string) error {
	repoPath := m.RepoPath(org, project)

	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	cmd := exec.Command("git", "init", "--bare", repoPath)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("init bare: %s: %w", string(out), err)
	}

	log.Info().Str("org", org).Str("project", project).Msg("Initialized bare repository")
	return nil
}

// InitBareWithStack creates a new bare repository and seeds it from the
// templates repo branch matching the stack name. (Legacy — use ScaffoldProject instead.)
func (m *Manager) InitBareWithStack(org, project, stack string) error {
	if err := m.InitBare(org, project); err != nil {
		return err
	}

	if stack == "" {
		return nil
	}

	// Clone from templates repo
	if m.templateBranchExists(stack) {
		repoPath := m.RepoPath(org, project)
		if err := m.initFromTemplate(repoPath, org, project, stack); err != nil {
			log.Warn().Err(err).Str("stack", stack).Msg("Template clone failed, repo remains empty")
		}
	} else {
		log.Warn().Str("stack", stack).Msg("No template branch found, repo created empty")
	}

	return nil
}

// ScaffoldProject creates a bare repo, runs a Docker container with the specified
// scaffold command, writes .gitignore, and pushes the result as the initial commit.
// Uses docker create + docker cp (not volume mounts) to work inside Docker-in-Docker.
func (m *Manager) ScaffoldProject(org, project, dockerImage, scaffoldCmd, gitignore string) error {
	repoPath := m.RepoPath(org, project)

	// 1. Create bare repo
	if err := m.InitBare(org, project); err != nil {
		return err
	}

	// If no scaffold command, leave empty repo
	if dockerImage == "" || scaffoldCmd == "" {
		return nil
	}

	// 2. Create temp working directory (for git operations after docker cp)
	tmpDir, err := os.MkdirTemp("", "scaffold-"+org+"-"+project+"-")
	if err != nil {
		return fmt.Errorf("create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	containerName := fmt.Sprintf("scaffold-%s-%s-%d", org, project, time.Now().UnixNano())

	log.Info().
		Str("org", org).
		Str("project", project).
		Str("image", dockerImage).
		Str("container", containerName).
		Msg("Scaffolding project via Docker")

	// 3. Create container (don't start yet)
	createCmd := exec.Command("docker", "create",
		"--name", containerName,
		"-w", "/app",
		"--network", "host",
		dockerImage,
		"sh", "-c", "mkdir -p /app && cd /app && "+scaffoldCmd,
	)
	createOut, createErr := createCmd.CombinedOutput()
	if createErr != nil {
		return fmt.Errorf("docker create: %s: %w", string(createOut), createErr)
	}

	// Ensure cleanup
	defer func() {
		rmCmd := exec.Command("docker", "rm", "-f", containerName)
		rmCmd.Run()
	}()

	// 4. Start container and wait for it to finish
	startCmd := exec.Command("docker", "start", "-a", containerName)
	startOut, startErr := startCmd.CombinedOutput()
	if startErr != nil {
		log.Error().
			Err(startErr).
			Str("output", string(startOut)).
			Str("image", dockerImage).
			Msg("Docker scaffold failed")
		return fmt.Errorf("scaffold docker run: %s: %w", string(startOut), startErr)
	}

	log.Info().
		Str("org", org).
		Str("project", project).
		Msg("Scaffold command completed")

	// 5. Copy files from container to temp dir
	cpCmd := exec.Command("docker", "cp", containerName+":/app/.", tmpDir)
	if cpOut, cpErr := cpCmd.CombinedOutput(); cpErr != nil {
		return fmt.Errorf("docker cp: %s: %w", string(cpOut), cpErr)
	}

	// 6. Write .gitignore
	if gitignore != "" {
		ignPath := filepath.Join(tmpDir, ".gitignore")
		if err := os.WriteFile(ignPath, []byte(gitignore+"\n"), 0644); err != nil {
			log.Warn().Err(err).Msg("Failed to write .gitignore")
		}
	}

	// 7. Git init, add, commit, push to bare repo
	cmds := []struct {
		name string
		args []string
	}{
		{"init", []string{"git", "init", "-b", "main"}},
		{"add", []string{"git", "add", "-A"}},
		{"commit", []string{"git", "commit", "-m", "Initial scaffold", "--author", "MonkeysCloud <platform@monkeys.cloud>"}},
		{"push", []string{"git", "push", repoPath, "main"}},
	}

	for _, c := range cmds {
		cmd := exec.Command(c.args[0], c.args[1:]...)
		cmd.Dir = tmpDir
		cmd.Env = append(os.Environ(),
			"GIT_AUTHOR_NAME=MonkeysCloud",
			"GIT_AUTHOR_EMAIL=platform@monkeys.cloud",
			"GIT_COMMITTER_NAME=MonkeysCloud",
			"GIT_COMMITTER_EMAIL=platform@monkeys.cloud",
		)
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("git %s: %s: %w", c.name, string(out), err)
		}
	}

	log.Info().
		Str("org", org).
		Str("project", project).
		Msg("Scaffold committed and pushed to bare repo")

	return nil
}

// templateBranchExists checks if the templates repo has a branch for this stack.
func (m *Manager) templateBranchExists(stack string) bool {
	tmplRepo := m.TemplatesRepoPath()
	if _, err := os.Stat(filepath.Join(tmplRepo, "HEAD")); err != nil {
		return false // templates repo doesn't exist yet
	}
	cmd := exec.Command("git", "-C", tmplRepo, "rev-parse", "--verify", "refs/heads/"+stack)
	return cmd.Run() == nil
}

// initFromTemplate clones the template branch into the new repo, replaces
// {{PROJECT}} and {{ORG}} placeholders, commits, and pushes.
func (m *Manager) initFromTemplate(bareRepoPath, org, project, stack string) error {
	tmpDir, err := os.MkdirTemp("", "mc-tmpl-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	tmplRepo := m.TemplatesRepoPath()

	// Clone single branch from templates repo
	cmd := exec.Command("git", "clone", "--single-branch", "--branch", stack, tmplRepo, tmpDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("clone template: %s: %w", string(out), err)
	}

	// Replace placeholders in all files
	if err := m.replacePlaceholders(tmpDir, org, project); err != nil {
		return fmt.Errorf("replace placeholders: %w", err)
	}

	// Change remote to the new bare repo
	exec.Command("git", "-C", tmpDir, "remote", "remove", "origin").Run()
	cmd = exec.Command("git", "-C", tmpDir, "remote", "add", "origin", bareRepoPath)
	cmd.Run()

	// Stage all changes (placeholder replacements)
	cmd = exec.Command("git", "-C", tmpDir, "add", "-A")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("add: %s: %w", string(out), err)
	}

	// Amend the commit if there are changes, otherwise use existing commit
	cmd = exec.Command("git", "-C", tmpDir, "diff", "--cached", "--quiet")
	if cmd.Run() != nil {
		// There are staged changes (placeholders were replaced)
		cmd = exec.Command("git", "-C", tmpDir,
			"-c", "user.name=MonkeysCloud",
			"-c", "user.email=noreply@monkeys.cloud",
			"commit", "--amend", "--no-edit")
		if out, err := cmd.CombinedOutput(); err != nil {
			return fmt.Errorf("amend: %s: %w", string(out), err)
		}
	}

	// Push to the new bare repo
	cmd = exec.Command("git", "-C", tmpDir, "push", "origin", "HEAD:refs/heads/main")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("push: %s: %w", string(out), err)
	}

	// Set HEAD to main
	cmd = exec.Command("git", "-C", bareRepoPath, "symbolic-ref", "HEAD", "refs/heads/main")
	cmd.Run()

	log.Info().Str("stack", stack).Msg("Initialized from template branch")
	return nil
}

// replacePlaceholders walks all files in dir, replacing {{PROJECT}} and {{ORG}}.
func (m *Manager) replacePlaceholders(dir, org, project string) error {
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		// Skip .git directory and non-files
		if info.IsDir() {
			if info.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}
		// Skip binary files (simple heuristic: skip files > 1MB or with no extension)
		if info.Size() > 1024*1024 {
			return nil
		}

		content, err := os.ReadFile(path)
		if err != nil {
			return err
		}

		original := string(content)
		replaced := strings.ReplaceAll(original, "{{PROJECT}}", project)
		replaced = strings.ReplaceAll(replaced, "{{ORG}}", org)

		if replaced != original {
			return os.WriteFile(path, []byte(replaced), info.Mode())
		}
		return nil
	})
}

// seedInitialCommit clones the bare repo to a temp dir, writes files, commits, pushes.
func (m *Manager) seedInitialCommit(bareRepoPath string, files map[string]string) error {
	tmpDir, err := os.MkdirTemp("", "mc-seed-*")
	if err != nil {
		return err
	}
	defer os.RemoveAll(tmpDir)

	// Clone bare repo into temp
	cmd := exec.Command("git", "clone", bareRepoPath, tmpDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("clone: %s: %w", string(out), err)
	}

	// Write files
	for path, content := range files {
		fullPath := filepath.Join(tmpDir, path)
		if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
			return err
		}
		if err := os.WriteFile(fullPath, []byte(content), 0644); err != nil {
			return err
		}
	}

	// Stage all
	cmd = exec.Command("git", "-C", tmpDir, "add", "-A")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("add: %s: %w", string(out), err)
	}

	// Commit
	cmd = exec.Command("git", "-C", tmpDir,
		"-c", "user.name=MonkeysCloud",
		"-c", "user.email=noreply@monkeys.cloud",
		"commit", "-m", "Initial commit — project scaffolding")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("commit: %s: %w", string(out), err)
	}

	// Push back to bare repo
	cmd = exec.Command("git", "-C", tmpDir, "push", "origin", "HEAD:refs/heads/main")
	if out, err := cmd.CombinedOutput(); err != nil {
		return fmt.Errorf("push: %s: %w", string(out), err)
	}

	// Update bare repo HEAD to point to main
	cmd = exec.Command("git", "-C", bareRepoPath, "symbolic-ref", "HEAD", "refs/heads/main")
	cmd.Run() // best effort

	log.Info().Int("files", len(files)).Msg("Seeded initial commit")
	return nil
}

// stackFiles returns the initial files for a given stack.
func stackFiles(org, project, stack string) map[string]string {
	files := map[string]string{}

	// README.md — always
	files["README.md"] = fmt.Sprintf("# %s\n\n> Project managed by [MonkeysCloud](https://monkeys.cloud)\n", project)

	switch stack {

	// ── PHP ──────────────────────────────────────────────────────────────
	case "monkeyslegion":
		files[".gitignore"] = phpGitignore()
		files["composer.json"] = fmt.Sprintf(`{
  "name": "%s/%s",
  "description": "MonkeysLegion application",
  "type": "project",
  "license": "proprietary",
  "minimum-stability": "stable",
  "require": {
    "php": "^8.2",
    "monkeyscloud/monkeyslegion": "*"
  },
  "autoload": { "psr-4": { "App\\": "app/" } },
  "config": { "optimize-autoloader": true, "sort-packages": true }
}`, org, project)
		files["public/index.php"] = "<?php\ndeclare(strict_types=1);\nrequire __DIR__ . '/../vendor/autoload.php';\n"
		files["app/Controller/.gitkeep"] = ""
		files["app/Entity/.gitkeep"] = ""
		files["app/Repository/.gitkeep"] = ""
		files["app/Middleware/.gitkeep"] = ""
		files["config/.gitkeep"] = ""
		files["storage/logs/.gitkeep"] = ""
		files["storage/cache/.gitkeep"] = ""
		files[".env.example"] = "APP_ENV=local\nAPP_DEBUG=true\nAPP_KEY=\n\nDB_HOST=127.0.0.1\nDB_PORT=5432\nDB_DATABASE=" + project + "\nDB_USERNAME=root\nDB_PASSWORD=\n"
		files["Dockerfile"] = "FROM php:8.2-fpm-alpine\nWORKDIR /var/www\nRUN apk add --no-cache libpq-dev && docker-php-ext-install pdo pdo_pgsql\nCOPY --from=composer:latest /usr/bin/composer /usr/bin/composer\nCOPY . .\nRUN composer install --no-dev --optimize-autoloader\nEXPOSE 9000\nCMD [\"php-fpm\"]\n"

	case "laravel":
		files[".gitignore"] = phpGitignore() + "\nstorage/*.key\n.env\nbootstrap/cache/*.php\n"
		files["composer.json"] = fmt.Sprintf(`{
  "name": "%s/%s",
  "type": "project",
  "require": { "php": "^8.2", "laravel/framework": "^11.0" },
  "autoload": { "psr-4": { "App\\": "app/", "Database\\": "database/" } },
  "config": { "optimize-autoloader": true, "sort-packages": true }
}`, org, project)
		files["artisan"] = "#!/usr/bin/env php\n<?php\nrequire __DIR__ . '/vendor/autoload.php';\n$app = require_once __DIR__ . '/bootstrap/app.php';\n$kernel = $app->make(Illuminate\\Contracts\\Console\\Kernel::class);\n$status = $kernel->handle(new Symfony\\Component\\Console\\Input\\ArgvInput, new Symfony\\Component\\Console\\Output\\ConsoleOutput);\nexit($status);\n"
		files["public/index.php"] = "<?php\nrequire __DIR__ . '/../vendor/autoload.php';\n$app = require_once __DIR__ . '/../bootstrap/app.php';\n$app->run();\n"
		files["app/Models/.gitkeep"] = ""
		files["app/Http/Controllers/.gitkeep"] = ""
		files["database/migrations/.gitkeep"] = ""
		files["resources/views/.gitkeep"] = ""
		files["routes/web.php"] = "<?php\nuse Illuminate\\Support\\Facades\\Route;\nRoute::get('/', fn() => view('welcome'));\n"
		files["storage/app/.gitkeep"] = ""
		files["storage/logs/.gitkeep"] = ""
		files["bootstrap/cache/.gitkeep"] = ""
		files[".env.example"] = "APP_NAME=" + project + "\nAPP_ENV=local\nAPP_KEY=\nAPP_DEBUG=true\nAPP_URL=http://localhost\n\nDB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432\nDB_DATABASE=" + project + "\nDB_USERNAME=root\nDB_PASSWORD=\n"
		files["Dockerfile"] = "FROM php:8.2-fpm-alpine\nWORKDIR /var/www\nRUN apk add --no-cache libpq-dev && docker-php-ext-install pdo pdo_pgsql\nCOPY --from=composer:latest /usr/bin/composer /usr/bin/composer\nCOPY . .\nRUN composer install --no-dev --optimize-autoloader\nEXPOSE 9000\nCMD [\"php-fpm\"]\n"

	case "symfony":
		files[".gitignore"] = phpGitignore() + "\n.env.local\n.env.*.local\nvar/\npublic/bundles/\n"
		files["composer.json"] = fmt.Sprintf(`{
  "name": "%s/%s",
  "type": "project",
  "require": { "php": "^8.2", "symfony/framework-bundle": "^7.0", "symfony/runtime": "^7.0" },
  "autoload": { "psr-4": { "App\\": "src/" } },
  "config": { "optimize-autoloader": true, "sort-packages": true }
}`, org, project)
		files["public/index.php"] = "<?php\nuse App\\Kernel;\nrequire_once dirname(__DIR__) . '/vendor/autoload_runtime.php';\nreturn fn(array $context) => new Kernel($context['APP_ENV'], (bool) $context['APP_DEBUG']);\n"
		files["src/Controller/.gitkeep"] = ""
		files["src/Entity/.gitkeep"] = ""
		files["config/packages/.gitkeep"] = ""
		files["config/routes.yaml"] = "controllers:\n    resource: ../src/Controller/\n    type: attribute\n"
		files[".env"] = "APP_ENV=dev\nAPP_SECRET=change_me\n"

	case "wordpress":
		files[".gitignore"] = phpGitignore() + "\nwp-config.php\nwp-content/uploads/\nwp-content/upgrade/\nwp-content/cache/\n*.sql\n"
		files["wp-content/themes/.gitkeep"] = ""
		files["wp-content/plugins/.gitkeep"] = ""
		files["wp-content/mu-plugins/.gitkeep"] = ""
		files["wp-config-sample.php"] = "<?php\ndefine('DB_NAME', '" + project + "');\ndefine('DB_USER', 'root');\ndefine('DB_PASSWORD', '');\ndefine('DB_HOST', 'localhost');\ndefine('DB_CHARSET', 'utf8mb4');\n$table_prefix = 'wp_';\ndefine('WP_DEBUG', false);\n"

	case "drupal":
		files[".gitignore"] = phpGitignore() + "\nsites/default/files/\nsites/default/settings.local.php\n"
		files["composer.json"] = fmt.Sprintf(`{
  "name": "%s/%s",
  "type": "project",
  "require": { "drupal/core-recommended": "^10" }
}`, org, project)
		files["web/sites/default/.gitkeep"] = ""
		files["web/modules/custom/.gitkeep"] = ""
		files["web/themes/custom/.gitkeep"] = ""

	case "php-generic":
		files[".gitignore"] = phpGitignore()
		files["composer.json"] = fmt.Sprintf(`{
  "name": "%s/%s",
  "type": "project",
  "require": { "php": "^8.1" },
  "autoload": { "psr-4": { "App\\": "src/" } }
}`, org, project)
		files["public/index.php"] = "<?php\nrequire __DIR__ . '/../vendor/autoload.php';\necho 'Hello, World!';\n"
		files["src/.gitkeep"] = ""
		files["Dockerfile"] = "FROM php:8.2-fpm-alpine\nWORKDIR /var/www\nCOPY --from=composer:latest /usr/bin/composer /usr/bin/composer\nCOPY . .\nRUN composer install --no-dev --optimize-autoloader\nEXPOSE 9000\nCMD [\"php-fpm\"]\n"

	// ── Node / JS ────────────────────────────────────────────────────────
	case "nextjs":
		files[".gitignore"] = nodeGitignore() + "\n.next/\nout/\nnext-env.d.ts\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "version": "0.1.0",
  "private": true,
  "scripts": { "dev": "next dev", "build": "next build", "start": "next start", "lint": "next lint" },
  "dependencies": { "next": "^14", "react": "^18", "react-dom": "^18" },
  "devDependencies": { "typescript": "^5", "@types/react": "^18", "@types/node": "^20" }
}`, project)
		files["next.config.js"] = "/** @type {import('next').NextConfig} */\nconst nextConfig = {};\nmodule.exports = nextConfig;\n"
		files["tsconfig.json"] = "{\n  \"compilerOptions\": {\n    \"target\": \"ES2017\",\n    \"lib\": [\"dom\", \"dom.iterable\", \"esnext\"],\n    \"allowJs\": true,\n    \"skipLibCheck\": true,\n    \"strict\": true,\n    \"noEmit\": true,\n    \"module\": \"esnext\",\n    \"moduleResolution\": \"bundler\",\n    \"jsx\": \"preserve\",\n    \"incremental\": true,\n    \"paths\": { \"@/*\": [\"./src/*\"] }\n  },\n  \"include\": [\"next-env.d.ts\", \"**/*.ts\", \"**/*.tsx\"],\n  \"exclude\": [\"node_modules\"]\n}\n"
		files["src/app/layout.tsx"] = "export const metadata = { title: '" + project + "' };\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html lang=\"en\"><body>{children}</body></html>;\n}\n"
		files["src/app/page.tsx"] = "export default function Home() {\n  return <main><h1>Welcome to " + project + "</h1></main>;\n}\n"
		files["public/.gitkeep"] = ""
		files["Dockerfile"] = nodeDockerfile()

	case "nuxtjs":
		files[".gitignore"] = nodeGitignore() + "\n.nuxt/\n.output/\n.data/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "scripts": { "dev": "nuxt dev", "build": "nuxt build", "generate": "nuxt generate", "preview": "nuxt preview" },
  "dependencies": { "nuxt": "^3", "vue": "^3" },
  "devDependencies": { "typescript": "^5" }
}`, project)
		files["nuxt.config.ts"] = "export default defineNuxtConfig({\n  devtools: { enabled: true },\n});\n"
		files["app.vue"] = "<template>\n  <div><h1>Welcome to " + project + "</h1><NuxtPage /></div>\n</template>\n"
		files["pages/index.vue"] = "<template>\n  <div><p>Home page</p></div>\n</template>\n"
		files["server/api/.gitkeep"] = ""
		files["Dockerfile"] = nodeDockerfile()

	case "remix":
		files[".gitignore"] = nodeGitignore() + "\nbuild/\n.cache/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "sideEffects": false,
  "scripts": { "dev": "remix vite:dev", "build": "remix vite:build", "start": "remix-serve ./build/server/index.js" },
  "dependencies": { "@remix-run/node": "^2", "@remix-run/react": "^2", "@remix-run/serve": "^2", "react": "^18", "react-dom": "^18" },
  "devDependencies": { "@remix-run/dev": "^2", "vite": "^5", "typescript": "^5" }
}`, project)
		files["app/root.tsx"] = "import { Links, Meta, Outlet, Scripts } from '@remix-run/react';\nexport default function App() {\n  return <html><head><Meta /><Links /></head><body><Outlet /><Scripts /></body></html>;\n}\n"
		files["app/routes/_index.tsx"] = "export default function Index() {\n  return <h1>Welcome to " + project + "</h1>;\n}\n"
		files["Dockerfile"] = nodeDockerfile()

	case "sveltekit":
		files[".gitignore"] = nodeGitignore() + "\n.svelte-kit/\nbuild/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "scripts": { "dev": "vite dev", "build": "vite build", "preview": "vite preview" },
  "devDependencies": { "@sveltejs/adapter-auto": "^3", "@sveltejs/kit": "^2", "svelte": "^4", "vite": "^5" }
}`, project)
		files["svelte.config.js"] = "import adapter from '@sveltejs/adapter-auto';\nexport default { kit: { adapter: adapter() } };\n"
		files["vite.config.js"] = "import { sveltekit } from '@sveltejs/kit/vite';\nexport default { plugins: [sveltekit()] };\n"
		files["src/routes/+page.svelte"] = "<h1>Welcome to " + project + "</h1>\n"
		files["src/app.html"] = "<!DOCTYPE html>\n<html lang=\"en\">\n<head><meta charset=\"utf-8\" /><meta name=\"viewport\" content=\"width=device-width\" />%sveltekit.head%</head>\n<body>%sveltekit.body%</body>\n</html>\n"
		files["Dockerfile"] = nodeDockerfile()

	case "astro":
		files[".gitignore"] = nodeGitignore() + "\ndist/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "scripts": { "dev": "astro dev", "build": "astro build", "preview": "astro preview" },
  "dependencies": { "astro": "^4" }
}`, project)
		files["astro.config.mjs"] = "import { defineConfig } from 'astro/config';\nexport default defineConfig({});\n"
		files["src/pages/index.astro"] = "---\n---\n<html lang=\"en\">\n<head><title>" + project + "</title></head>\n<body><h1>Welcome to " + project + "</h1></body>\n</html>\n"
		files["public/.gitkeep"] = ""
		files["Dockerfile"] = nodeDockerfile()

	case "express":
		files[".gitignore"] = nodeGitignore()
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "version": "1.0.0",
  "main": "src/index.js",
  "scripts": { "start": "node src/index.js", "dev": "nodemon src/index.js" },
  "dependencies": { "express": "^4", "cors": "^2", "dotenv": "^16" },
  "devDependencies": { "nodemon": "^3" }
}`, project)
		files["src/index.js"] = "require('dotenv').config();\nconst express = require('express');\nconst cors = require('cors');\nconst app = express();\napp.use(cors());\napp.use(express.json());\napp.get('/', (req, res) => res.json({ message: 'Hello from " + project + "' }));\napp.get('/health', (req, res) => res.json({ status: 'ok' }));\nconst PORT = process.env.PORT || 3000;\napp.listen(PORT, () => console.log(`Server on port ${PORT}`));\n"
		files["src/routes/.gitkeep"] = ""
		files[".env.example"] = "PORT=3000\nNODE_ENV=development\n"
		files["Dockerfile"] = nodeDockerfile()

	case "nestjs":
		files[".gitignore"] = nodeGitignore() + "\ndist/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "scripts": { "start": "nest start", "dev": "nest start --watch", "build": "nest build", "start:prod": "node dist/main" },
  "dependencies": { "@nestjs/core": "^10", "@nestjs/common": "^10", "@nestjs/platform-express": "^10", "reflect-metadata": "^0.2", "rxjs": "^7" },
  "devDependencies": { "@nestjs/cli": "^10", "typescript": "^5", "@types/node": "^20" }
}`, project)
		files["tsconfig.json"] = "{\n  \"compilerOptions\": {\n    \"module\": \"commonjs\",\n    \"declaration\": true,\n    \"emitDecoratorMetadata\": true,\n    \"experimentalDecorators\": true,\n    \"target\": \"ES2021\",\n    \"outDir\": \"./dist\",\n    \"rootDir\": \"./src\",\n    \"strict\": true\n  }\n}\n"
		files["src/main.ts"] = "import { NestFactory } from '@nestjs/core';\nimport { AppModule } from './app.module';\nasync function bootstrap() {\n  const app = await NestFactory.create(AppModule);\n  await app.listen(3000);\n}\nbootstrap();\n"
		files["src/app.module.ts"] = "import { Module } from '@nestjs/common';\n@Module({ imports: [], controllers: [], providers: [] })\nexport class AppModule {}\n"
		files["Dockerfile"] = nodeDockerfile()

	case "react":
		files[".gitignore"] = nodeGitignore() + "\ndist/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "scripts": { "dev": "vite", "build": "tsc && vite build", "preview": "vite preview" },
  "dependencies": { "react": "^18", "react-dom": "^18" },
  "devDependencies": { "vite": "^5", "@vitejs/plugin-react": "^4", "typescript": "^5", "@types/react": "^18", "@types/react-dom": "^18" }
}`, project)
		files["vite.config.ts"] = "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nexport default defineConfig({ plugins: [react()] });\n"
		files["tsconfig.json"] = "{ \"compilerOptions\": { \"target\": \"ES2020\", \"module\": \"ESNext\", \"moduleResolution\": \"bundler\", \"jsx\": \"react-jsx\", \"strict\": true } }\n"
		files["index.html"] = "<!DOCTYPE html>\n<html lang=\"en\">\n<head><meta charset=\"UTF-8\" /><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" /><title>" + project + "</title></head>\n<body><div id=\"root\"></div><script type=\"module\" src=\"/src/main.tsx\"></script></body>\n</html>\n"
		files["src/main.tsx"] = "import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\nReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);\n"
		files["src/App.tsx"] = "export default function App() {\n  return <div><h1>" + project + "</h1></div>;\n}\n"
		files["Dockerfile"] = nodeDockerfile()

	case "vue":
		files[".gitignore"] = nodeGitignore() + "\ndist/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "vue": "^3" },
  "devDependencies": { "vite": "^5", "@vitejs/plugin-vue": "^5", "typescript": "^5" }
}`, project)
		files["vite.config.ts"] = "import { defineConfig } from 'vite';\nimport vue from '@vitejs/plugin-vue';\nexport default defineConfig({ plugins: [vue()] });\n"
		files["index.html"] = "<!DOCTYPE html>\n<html lang=\"en\">\n<head><meta charset=\"UTF-8\" /><title>" + project + "</title></head>\n<body><div id=\"app\"></div><script type=\"module\" src=\"/src/main.ts\"></script></body>\n</html>\n"
		files["src/main.ts"] = "import { createApp } from 'vue';\nimport App from './App.vue';\ncreateApp(App).mount('#app');\n"
		files["src/App.vue"] = "<script setup lang=\"ts\"></script>\n<template><h1>" + project + "</h1></template>\n"
		files["Dockerfile"] = nodeDockerfile()

	case "angular":
		files[".gitignore"] = nodeGitignore() + "\ndist/\n.angular/\n"
		files["package.json"] = fmt.Sprintf(`{
  "name": "%s",
  "private": true,
  "scripts": { "start": "ng serve", "build": "ng build", "test": "ng test" },
  "dependencies": { "@angular/core": "^17", "@angular/common": "^17", "@angular/compiler": "^17", "@angular/platform-browser": "^17", "@angular/router": "^17", "rxjs": "^7", "zone.js": "^0.14", "tslib": "^2" },
  "devDependencies": { "@angular/cli": "^17", "@angular/compiler-cli": "^17", "typescript": "^5" }
}`, project)
		files["tsconfig.json"] = "{\n  \"compilerOptions\": {\n    \"target\": \"ES2022\",\n    \"module\": \"ES2022\",\n    \"moduleResolution\": \"bundler\",\n    \"strict\": true,\n    \"experimentalDecorators\": true\n  }\n}\n"
		files["src/main.ts"] = "import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';\nimport { AppModule } from './app/app.module';\nplatformBrowserDynamic().bootstrapModule(AppModule);\n"
		files["src/app/app.module.ts"] = "import { NgModule } from '@angular/core';\nimport { BrowserModule } from '@angular/platform-browser';\n@NgModule({ imports: [BrowserModule], bootstrap: [] })\nexport class AppModule {}\n"
		files["Dockerfile"] = nodeDockerfile()

	// ── Python ───────────────────────────────────────────────────────────
	case "django":
		files[".gitignore"] = pythonGitignore() + "\ndb.sqlite3\nstaticfiles/\nmedia/\n"
		files["requirements.txt"] = "django>=5.0\ndjango-environ>=0.11\ngunicorn>=22.0\npsycopg2-binary>=2.9\n"
		files["manage.py"] = "#!/usr/bin/env python3\nimport os, sys\nos.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')\nif __name__ == '__main__':\n    from django.core.management import execute_from_command_line\n    execute_from_command_line(sys.argv)\n"
		files["config/__init__.py"] = ""
		files["config/settings.py"] = "from pathlib import Path\nimport os\nBASE_DIR = Path(__file__).resolve().parent.parent\nSECRET_KEY = os.environ.get('SECRET_KEY', 'change-me')\nDEBUG = os.environ.get('DEBUG', 'True') == 'True'\nALLOWED_HOSTS = ['*']\nROOT_URLCONF = 'config.urls'\nSTATIC_URL = '/static/'\nDEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'\n"
		files["config/urls.py"] = "from django.contrib import admin\nfrom django.urls import path\nurlpatterns = [path('admin/', admin.site.urls)]\n"
		files[".env.example"] = "SECRET_KEY=change-me\nDEBUG=True\nDATABASE_URL=postgres://user:pass@localhost:5432/" + project + "\n"
		files["Dockerfile"] = pythonDockerfile()

	case "fastapi":
		files[".gitignore"] = pythonGitignore()
		files["requirements.txt"] = "fastapi>=0.110\nuvicorn[standard]>=0.29\npydantic>=2.0\npython-dotenv>=1.0\n"
		files["app/__init__.py"] = ""
		files["app/main.py"] = "from fastapi import FastAPI\nfrom fastapi.middleware.cors import CORSMiddleware\napp = FastAPI(title='" + project + "')\napp.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])\n\n@app.get('/')\ndef root():\n    return {'message': 'Hello from " + project + "'}\n\n@app.get('/health')\ndef health():\n    return {'status': 'ok'}\n"
		files["app/routers/.gitkeep"] = ""
		files[".env.example"] = "DATABASE_URL=postgresql://user:pass@localhost:5432/" + project + "\n"
		files["Dockerfile"] = pythonDockerfile()

	case "flask":
		files[".gitignore"] = pythonGitignore() + "\ninstance/\n"
		files["requirements.txt"] = "flask>=3.0\ngunicorn>=22.0\npython-dotenv>=1.0\nflask-cors>=4.0\n"
		files["app/__init__.py"] = "from flask import Flask\ndef create_app():\n    app = Flask(__name__)\n    from . import routes\n    app.register_blueprint(routes.bp)\n    return app\n"
		files["app/routes.py"] = "from flask import Blueprint, jsonify\nbp = Blueprint('main', __name__)\n\n@bp.route('/')\ndef index():\n    return jsonify(message='Hello from " + project + "')\n"
		files["wsgi.py"] = "from app import create_app\napp = create_app()\nif __name__ == '__main__':\n    app.run(debug=True)\n"
		files[".env.example"] = "FLASK_APP=wsgi.py\nFLASK_DEBUG=1\n"
		files["Dockerfile"] = pythonDockerfile()

	case "streamlit":
		files[".gitignore"] = pythonGitignore()
		files["requirements.txt"] = "streamlit>=1.32\npandas>=2.0\n"
		files["app.py"] = "import streamlit as st\nst.set_page_config(page_title='" + project + "', layout='wide')\nst.title('" + project + "')\nst.write('Welcome to your Streamlit app!')\n"
		files[".streamlit/config.toml"] = "[theme]\nprimaryColor = '#1f77b4'\n"
		files["pages/.gitkeep"] = ""

	case "python-generic":
		files[".gitignore"] = pythonGitignore()
		files["requirements.txt"] = "# Add your dependencies here\n"
		files["src/__init__.py"] = ""
		files["src/main.py"] = "def main():\n    print('Hello from " + project + "')\n\nif __name__ == '__main__':\n    main()\n"
		files["tests/__init__.py"] = ""
		files["Dockerfile"] = pythonDockerfile()

	// ── Ruby ─────────────────────────────────────────────────────────────
	case "rails":
		files[".gitignore"] = "# Ruby / Rails\n/log/*\n!/log/.keep\n/tmp/*\n!/tmp/.keep\n/storage/*\n!/storage/.keep\n/public/assets\n.byebug_history\n/config/master.key\n/config/credentials/*.key\nnode_modules/\n.env\n"
		files["Gemfile"] = "source 'https://rubygems.org'\nruby '>= 3.2'\ngem 'rails', '~> 7.1'\ngem 'pg'\ngem 'puma', '~> 6.0'\n"
		files["config.ru"] = "require_relative 'config/environment'\nrun Rails.application\n"
		files["app/controllers/.gitkeep"] = ""
		files["app/models/.gitkeep"] = ""
		files["config/routes.rb"] = "Rails.application.routes.draw do\n  root 'home#index'\nend\n"
		files["db/migrate/.gitkeep"] = ""
		files["log/.gitkeep"] = ""
		files["tmp/.gitkeep"] = ""
		files["Dockerfile"] = "FROM ruby:3.2-slim\nWORKDIR /app\nCOPY Gemfile* ./\nRUN bundle install\nCOPY . .\nEXPOSE 3000\nCMD [\"rails\", \"server\", \"-b\", \"0.0.0.0\"]\n"

	case "ruby-generic":
		files[".gitignore"] = "# Ruby\n*.gem\n*.rbc\n.bundle/\nvendor/bundle\nGemfile.lock\n.env\n"
		files["Gemfile"] = "source 'https://rubygems.org'\nruby '>= 3.2'\n"
		files["lib/.gitkeep"] = ""
		files["spec/.gitkeep"] = ""

	// ── Go ───────────────────────────────────────────────────────────────
	case "go":
		files[".gitignore"] = "# Go\n/bin/\n/vendor/\n*.exe\n*.test\n*.out\n.env\ncoverage.out\n"
		files["go.mod"] = fmt.Sprintf("module github.com/%s/%s\n\ngo 1.22\n", org, project)
		files["main.go"] = "package main\n\nimport (\n\t\"fmt\"\n\t\"log\"\n\t\"net/http\"\n)\n\nfunc main() {\n\thttp.HandleFunc(\"/\", func(w http.ResponseWriter, r *http.Request) { fmt.Fprintf(w, \"Hello\") })\n\tlog.Println(\"Server starting on :8080\")\n\tlog.Fatal(http.ListenAndServe(\":8080\", nil))\n}\n"
		files["Makefile"] = "build:\n\tgo build -o bin/" + project + " .\n\nrun:\n\tgo run .\n\ntest:\n\tgo test ./...\n"
		files["Dockerfile"] = "FROM golang:1.22-alpine AS builder\nWORKDIR /app\nCOPY go.mod go.sum* ./\nRUN go mod download\nCOPY . .\nRUN CGO_ENABLED=0 go build -o /app/server .\n\nFROM alpine:latest\nCOPY --from=builder /app/server /server\nEXPOSE 8080\nCMD [\"/server\"]\n"

	// ── Rust ─────────────────────────────────────────────────────────────
	case "rust":
		files[".gitignore"] = "# Rust\n/target/\n.env\n"
		files["Cargo.toml"] = fmt.Sprintf("[package]\nname = \"%s\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n[dependencies]\n", project)
		files["src/main.rs"] = "fn main() {\n    println!(\"Hello from " + project + "!\");\n}\n"
		files["Dockerfile"] = "FROM rust:1.77 AS builder\nWORKDIR /app\nCOPY . .\nRUN cargo build --release\n\nFROM debian:bookworm-slim\nCOPY --from=builder /app/target/release/" + project + " /usr/local/bin/\nCMD [\"" + project + "\"]\n"

	// ── Java ─────────────────────────────────────────────────────────────
	case "spring-boot":
		files[".gitignore"] = "# Java\n*.class\n*.jar\n*.war\n/target/\n/build/\n.gradle/\n.idea/\n*.iml\n.DS_Store\n"
		files["pom.xml"] = fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.0</version>
  </parent>
  <groupId>com.%s</groupId>
  <artifactId>%s</artifactId>
  <version>0.1.0</version>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
  </dependencies>
</project>`, org, project)
		files["src/main/resources/application.properties"] = "server.port=8080\nspring.application.name=" + project + "\n"
		files["src/main/java/.gitkeep"] = ""
		files["src/test/java/.gitkeep"] = ""
		files["Dockerfile"] = "FROM eclipse-temurin:21-jdk AS builder\nWORKDIR /app\nCOPY . .\nRUN ./mvnw package -DskipTests || true\n\nFROM eclipse-temurin:21-jre\nCOPY --from=builder /app/target/*.jar /app.jar\nEXPOSE 8080\nCMD [\"java\", \"-jar\", \"/app.jar\"]\n"

	case "java-generic":
		files[".gitignore"] = "# Java\n*.class\n*.jar\n/target/\n/build/\n.gradle/\n.idea/\n*.iml\n"
		files["pom.xml"] = fmt.Sprintf(`<?xml version="1.0"?>
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.%s</groupId>
  <artifactId>%s</artifactId>
  <version>0.1.0</version>
  <properties>
    <maven.compiler.source>21</maven.compiler.source>
    <maven.compiler.target>21</maven.compiler.target>
  </properties>
</project>`, org, project)
		files["src/main/java/Main.java"] = "public class Main {\n    public static void main(String[] args) {\n        System.out.println(\"Hello from " + project + "\");\n    }\n}\n"
		files["src/test/java/.gitkeep"] = ""

	// ── .NET ─────────────────────────────────────────────────────────────
	case "dotnet":
		files[".gitignore"] = "# .NET\nbin/\nobj/\n*.user\n*.suo\n.vs/\n.env\n"
		files[project+".csproj"] = "<Project Sdk=\"Microsoft.NET.Sdk.Web\">\n  <PropertyGroup>\n    <TargetFramework>net8.0</TargetFramework>\n  </PropertyGroup>\n</Project>\n"
		files["Program.cs"] = "var builder = WebApplication.CreateBuilder(args);\nvar app = builder.Build();\napp.MapGet(\"/\", () => \"Hello from " + project + "\");\napp.MapGet(\"/health\", () => Results.Ok(new { status = \"ok\" }));\napp.Run();\n"
		files["appsettings.json"] = "{\n  \"Logging\": { \"LogLevel\": { \"Default\": \"Information\" } }\n}\n"
		files["Dockerfile"] = "FROM mcr.microsoft.com/dotnet/sdk:8.0 AS builder\nWORKDIR /app\nCOPY . .\nRUN dotnet publish -c Release -o /out\n\nFROM mcr.microsoft.com/dotnet/aspnet:8.0\nCOPY --from=builder /out .\nEXPOSE 8080\nCMD [\"dotnet\", \"" + project + ".dll\"]\n"

	// ── Phoenix ──────────────────────────────────────────────────────────
	case "phoenix":
		files[".gitignore"] = "# Elixir / Phoenix\n/_build/\n/deps/\n/*.ez\n/cover/\nerl_crash.dump\n*.beam\n.env\n"
		files["mix.exs"] = fmt.Sprintf("defmodule %s.MixProject do\n  use Mix.Project\n  def project do\n    [app: :%s, version: \"0.1.0\", elixir: \"~> 1.14\", start_permanent: Mix.env() == :prod, deps: deps()]\n  end\n  defp deps do\n    [{:phoenix, \"~> 1.7\"}, {:plug_cowboy, \"~> 2.7\"}]\n  end\nend\n", capitalize(project), project)
		files["config/config.exs"] = "import Config\nconfig :" + project + ", :generators, binary_id: true\n"
		files["lib/"+project+"/.gitkeep"] = ""
		files["lib/"+project+"_web/.gitkeep"] = ""
		files["test/.gitkeep"] = ""

	// ── Static ───────────────────────────────────────────────────────────
	case "static":
		files[".gitignore"] = "# Static\n.DS_Store\nnode_modules/\n*.log\n"
		files["index.html"] = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"UTF-8\" />\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n  <title>" + project + "</title>\n  <link rel=\"stylesheet\" href=\"css/style.css\" />\n</head>\n<body>\n  <h1>Welcome to " + project + "</h1>\n  <script src=\"js/main.js\"></script>\n</body>\n</html>\n"
		files["css/style.css"] = "/* Base styles */\n* { margin: 0; padding: 0; box-sizing: border-box; }\nbody { font-family: system-ui, sans-serif; }\n"
		files["js/main.js"] = "// Main JavaScript\nconsole.log('" + project + " loaded');\n"
		files["images/.gitkeep"] = ""

	// ── Docker ───────────────────────────────────────────────────────────
	case "docker":
		files[".gitignore"] = "# Docker\n.env\n*.log\ntmp/\n"
		files["Dockerfile"] = "FROM alpine:latest\nWORKDIR /app\nCOPY . .\nEXPOSE 8080\nCMD [\"echo\", \"Hello from " + project + "\"]\n"
		files[".dockerignore"] = ".git\n.env\n*.md\nnode_modules/\nvendor/\n"
		files[".env.example"] = "# Environment variables\n"

	case "docker-compose":
		files[".gitignore"] = "# Docker\n.env\n*.log\ntmp/\ndata/\n"
		files["Dockerfile"] = "FROM alpine:latest\nWORKDIR /app\nCOPY . .\nEXPOSE 8080\nCMD [\"echo\", \"Hello from " + project + "\"]\n"
		files["docker-compose.yml"] = "version: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - '8080:8080'\n    env_file: .env\n    depends_on:\n      - db\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_DB: " + project + "\n      POSTGRES_USER: postgres\n      POSTGRES_PASSWORD: postgres\n    volumes:\n      - db_data:/var/lib/postgresql/data\n    ports:\n      - '5432:5432'\nvolumes:\n  db_data:\n"
		files[".dockerignore"] = ".git\n.env\n*.md\nnode_modules/\nvendor/\n"
		files[".env.example"] = "POSTGRES_DB=" + project + "\nPOSTGRES_USER=postgres\nPOSTGRES_PASSWORD=postgres\n"

	default:
		files[".gitignore"] = "# General\n.DS_Store\n*.log\n.env\nnode_modules/\nvendor/\ntmp/\n"
	}

	return files
}

// capitalize returns string with first letter uppercased.
func capitalize(s string) string {
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}

// ── Dockerfile templates ─────────────────────────────────────────────────────

func nodeDockerfile() string {
	return "FROM node:20-alpine AS builder\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci\nCOPY . .\nRUN npm run build\n\nFROM node:20-alpine\nWORKDIR /app\nCOPY --from=builder /app .\nEXPOSE 3000\nCMD [\"npm\", \"start\"]\n"
}

func pythonDockerfile() string {
	return "FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD [\"python\", \"-m\", \"gunicorn\", \"--bind\", \"0.0.0.0:8000\", \"wsgi:app\"]\n"
}

// ── .gitignore templates ─────────────────────────────────────────────────────

func phpGitignore() string {
	return `/vendor/
.env
.phpunit.result.cache
composer.lock
*.cache
.idea/
.vscode/
.DS_Store
`
}

func nodeGitignore() string {
	return `node_modules/
.env
.env.local
dist/
*.log
.DS_Store
.idea/
.vscode/
`
}

func pythonGitignore() string {
	return `__pycache__/
*.py[cod]
*.egg-info/
.eggs/
dist/
build/
.env
.venv/
venv/
*.log
.DS_Store
`
}

// Delete removes a repository from disk.
func (m *Manager) Delete(org, project string) error {
	repoPath := m.RepoPath(org, project)
	return os.RemoveAll(repoPath)
}

// Exists checks if a repository exists.
func (m *Manager) Exists(org, project string) bool {
	repoPath := m.RepoPath(org, project)
	_, err := os.Stat(filepath.Join(repoPath, "HEAD"))
	return err == nil
}

// Open returns a go-git Repository handle for reads.
func (m *Manager) Open(org, project string) (*git.Repository, error) {
	return git.PlainOpen(m.RepoPath(org, project))
}

// CreateBranch creates a new branch from a source ref.
func (m *Manager) CreateBranch(org, project, branchName, sourceRef string) error {
	repo, err := m.Open(org, project)
	if err != nil {
		return fmt.Errorf("failed to open repository: %w", err)
	}

	// Resolve source ref to a hash
	var hash plumbing.Hash

	// Try as branch first
	ref, err := repo.Reference(plumbing.NewBranchReferenceName(sourceRef), true)
	if err == nil {
		hash = ref.Hash()
	} else {
		// Try as a full ref or tag
		ref, err = repo.Reference(plumbing.ReferenceName(sourceRef), true)
		if err == nil {
			hash = ref.Hash()
		} else {
			// Try as a commit hash
			hash = plumbing.NewHash(sourceRef)
			if _, err := repo.CommitObject(hash); err != nil {
				return fmt.Errorf("source ref '%s' not found", sourceRef)
			}
		}
	}

	// Check if branch already exists
	newRefName := plumbing.NewBranchReferenceName(branchName)
	if _, err := repo.Reference(newRefName, false); err == nil {
		return fmt.Errorf("branch '%s' already exists", branchName)
	}

	// Create the new branch reference
	newRef := plumbing.NewHashReference(newRefName, hash)
	return repo.Storer.SetReference(newRef)
}

// =============================================================================
// Read Operations (go-git — fast, no subprocess)
// =============================================================================

// BranchInfo represents a Git branch with metadata.
type BranchInfo struct {
	Name      string    `json:"name"`
	CommitSHA string    `json:"commit_sha"`
	IsDefault bool      `json:"is_default"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BranchDetail extends BranchInfo with ahead/behind counts and author info.
type BranchDetail struct {
	Name        string    `json:"name"`
	CommitSHA   string    `json:"commit_sha"`
	IsDefault   bool      `json:"is_default"`
	UpdatedAt   time.Time `json:"updated_at"`
	Ahead       int       `json:"ahead"`
	Behind      int       `json:"behind"`
	AuthorName  string    `json:"author_name"`
	AuthorEmail string    `json:"author_email"`
}

// ListBranches returns all branches in a repository.
func (m *Manager) ListBranches(org, project string) ([]BranchInfo, error) {
	repo, err := m.Open(org, project)
	if err != nil {
		return nil, err
	}

	refs, err := repo.References()
	if err != nil {
		return nil, err
	}

	// First pass: collect branches
	type branchRef struct {
		name string
		hash plumbing.Hash
	}
	var branchRefs []branchRef
	err = refs.ForEach(func(ref *plumbing.Reference) error {
		if ref.Name().IsBranch() {
			branchRefs = append(branchRefs, branchRef{name: ref.Name().Short(), hash: ref.Hash()})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Determine default branch with fallback
	head, _ := repo.Head()
	var defaultBranch string
	if head != nil {
		headBranch := head.Name().Short()
		for _, br := range branchRefs {
			if br.name == headBranch {
				defaultBranch = headBranch
				break
			}
		}
	}
	if defaultBranch == "" {
		for _, br := range branchRefs {
			if br.name == "main" {
				defaultBranch = "main"
				break
			}
		}
	}
	if defaultBranch == "" && len(branchRefs) > 0 {
		defaultBranch = branchRefs[0].name
	}

	var branches []BranchInfo
	for _, br := range branchRefs {
		commit, err := repo.CommitObject(br.hash)
		updatedAt := time.Now()
		if err == nil {
			updatedAt = commit.Author.When
		}

		branches = append(branches, BranchInfo{
			Name:      br.name,
			CommitSHA: br.hash.String(),
			IsDefault: br.name == defaultBranch,
			UpdatedAt: updatedAt,
		})
	}

	sort.Slice(branches, func(i, j int) bool {
		return branches[i].UpdatedAt.After(branches[j].UpdatedAt)
	})

	return branches, nil
}

// ListBranchesDetailed returns all branches with ahead/behind counts relative to default branch.
func (m *Manager) ListBranchesDetailed(org, project string) ([]BranchDetail, error) {
	repo, err := m.Open(org, project)
	if err != nil {
		return nil, err
	}

	refs, err := repo.References()
	if err != nil {
		return nil, err
	}

	// First pass: collect all branch refs
	type branchRef struct {
		name string
		hash plumbing.Hash
	}
	var branchRefs []branchRef
	err = refs.ForEach(func(ref *plumbing.Reference) error {
		if ref.Name().IsBranch() {
			branchRefs = append(branchRefs, branchRef{name: ref.Name().Short(), hash: ref.Hash()})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	// Determine default branch: try HEAD, fallback to "main", then first branch
	head, _ := repo.Head()
	var defaultBranch string
	var defaultHash plumbing.Hash

	if head != nil {
		headBranch := head.Name().Short()
		// Check if HEAD's branch actually exists
		for _, br := range branchRefs {
			if br.name == headBranch {
				defaultBranch = headBranch
				defaultHash = br.hash
				break
			}
		}
	}

	// Fallback: try "main"
	if defaultBranch == "" {
		for _, br := range branchRefs {
			if br.name == "main" {
				defaultBranch = "main"
				defaultHash = br.hash
				break
			}
		}
	}

	// Fallback: first branch
	if defaultBranch == "" && len(branchRefs) > 0 {
		defaultBranch = branchRefs[0].name
		defaultHash = branchRefs[0].hash
	}

	var branches []BranchDetail
	for _, br := range branchRefs {
		commit, cerr := repo.CommitObject(br.hash)
		updatedAt := time.Now()
		authorName := ""
		authorEmail := ""
		if cerr == nil {
			updatedAt = commit.Author.When
			authorName = commit.Author.Name
			authorEmail = commit.Author.Email
		}

		bd := BranchDetail{
			Name:        br.name,
			CommitSHA:   br.hash.String(),
			IsDefault:   br.name == defaultBranch,
			UpdatedAt:   updatedAt,
			AuthorName:  authorName,
			AuthorEmail: authorEmail,
		}

		// Calculate ahead/behind relative to default branch
		if !bd.IsDefault && defaultHash != plumbing.ZeroHash {
			ahead, behind := m.countDivergence(repo, br.hash, defaultHash)
			bd.Ahead = ahead
			bd.Behind = behind
		}

		branches = append(branches, bd)
	}

	sort.Slice(branches, func(i, j int) bool {
		return branches[i].UpdatedAt.After(branches[j].UpdatedAt)
	})

	return branches, err
}

// countDivergence counts how many commits branchHash is ahead of and behind baseHash.
func (m *Manager) countDivergence(repo *git.Repository, branchHash, baseHash plumbing.Hash) (ahead, behind int) {
	// Collect all ancestors of branch
	branchAncestors := make(map[plumbing.Hash]bool)
	branchCommit, err := repo.CommitObject(branchHash)
	if err != nil {
		return 0, 0
	}
	iter := object.NewCommitIterCTime(branchCommit, nil, nil)
	_ = iter.ForEach(func(c *object.Commit) error {
		branchAncestors[c.Hash] = true
		return nil
	})

	// Collect all ancestors of base
	baseAncestors := make(map[plumbing.Hash]bool)
	baseCommit, err := repo.CommitObject(baseHash)
	if err != nil {
		return 0, 0
	}
	iter = object.NewCommitIterCTime(baseCommit, nil, nil)
	_ = iter.ForEach(func(c *object.Commit) error {
		baseAncestors[c.Hash] = true
		return nil
	})

	// Ahead = commits in branch but not in base
	for h := range branchAncestors {
		if !baseAncestors[h] {
			ahead++
		}
	}

	// Behind = commits in base but not in branch
	for h := range baseAncestors {
		if !branchAncestors[h] {
			behind++
		}
	}

	return ahead, behind
}

// TagInfo represents a Git tag with metadata.
type TagInfo struct {
	Name        string `json:"name"`
	SHA         string `json:"sha"`
	Message     string `json:"message"`
	Tagger      string `json:"tagger"`
	TaggerEmail string `json:"tagger_email"`
	Date        string `json:"date"`
	IsAnnotated bool   `json:"is_annotated"`
}

// ListTags returns all tags with commit info.
func (m *Manager) ListTags(org, project string) ([]TagInfo, error) {
	repoPath := m.RepoPath(org, project)

	// List all tags
	cmd := exec.Command("git", "-C", repoPath, "tag", "--sort=-creatordate")
	out, err := cmd.Output()
	if err != nil {
		return []TagInfo{}, nil // no tags yet
	}

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	var tags []TagInfo

	for _, name := range lines {
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}

		tag := TagInfo{Name: name}

		// Get tag details: sha, message, author, date
		detailCmd := exec.Command("git", "-C", repoPath, "tag", "-l", name,
			"--format=%(objecttype)%0a%(*objectname)%0a%(objectname)%0a%(contents:subject)%0a%(taggername)%0a%(taggeremail)%0a%(creatordate:iso8601)")
		detailOut, err := detailCmd.Output()
		if err == nil {
			parts := strings.SplitN(strings.TrimSpace(string(detailOut)), "\n", 7)
			objType := ""
			if len(parts) >= 1 {
				objType = parts[0]
			}
			tag.IsAnnotated = objType == "tag"

			// For annotated tags, *objectname is the commit; for lightweight, objectname is
			if len(parts) >= 2 && parts[1] != "" {
				tag.SHA = parts[1] // dereferenced commit
			} else if len(parts) >= 3 {
				tag.SHA = parts[2] // objectname (lightweight)
			}

			if len(parts) >= 4 {
				tag.Message = parts[3]
			}
			if len(parts) >= 5 {
				tag.Tagger = parts[4]
			}
			if len(parts) >= 6 {
				tag.TaggerEmail = strings.Trim(parts[5], "<>")
			}
			if len(parts) >= 7 {
				tag.Date = parts[6]
			}
		}

		// If SHA is still empty, resolve it
		if tag.SHA == "" {
			shaCmd := exec.Command("git", "-C", repoPath, "rev-parse", name+"^{commit}")
			shaOut, err := shaCmd.Output()
			if err == nil {
				tag.SHA = strings.TrimSpace(string(shaOut))
			}
		}

		// If no message, get from commit
		if tag.Message == "" && tag.SHA != "" {
			msgCmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%s", tag.SHA)
			msgOut, err := msgCmd.Output()
			if err == nil {
				tag.Message = strings.TrimSpace(string(msgOut))
			}
		}

		// If no tagger, get from commit author
		if tag.Tagger == "" && tag.SHA != "" {
			authorCmd := exec.Command("git", "-C", repoPath, "log", "-1", "--format=%an%n%ae%n%aI", tag.SHA)
			authorOut, err := authorCmd.Output()
			if err == nil {
				aParts := strings.SplitN(strings.TrimSpace(string(authorOut)), "\n", 3)
				if len(aParts) >= 1 {
					tag.Tagger = aParts[0]
				}
				if len(aParts) >= 2 {
					tag.TaggerEmail = aParts[1]
				}
				if len(aParts) >= 3 && tag.Date == "" {
					tag.Date = aParts[2]
				}
			}
		}

		tags = append(tags, tag)
	}

	return tags, nil
}

// CreateTag creates a new tag at a given ref.
func (m *Manager) CreateTag(org, project, name, ref, message string) error {
	repoPath := m.RepoPath(org, project)

	var cmd *exec.Cmd
	if message != "" {
		// Annotated tag — pass user config inline so it works in Docker without global config
		cmd = exec.Command("git", "-C", repoPath,
			"-c", "user.name=MonkeysCloud",
			"-c", "user.email=noreply@monkeys.cloud",
			"tag", "-a", name, ref, "-m", message)
	} else {
		// Lightweight tag
		cmd = exec.Command("git", "-C", repoPath, "tag", name, ref)
	}

	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to create tag: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// DeleteTag deletes a tag.
func (m *Manager) DeleteTag(org, project, name string) error {
	repoPath := m.RepoPath(org, project)
	cmd := exec.Command("git", "-C", repoPath, "tag", "-d", name)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to delete tag: %s", strings.TrimSpace(string(out)))
	}
	return nil
}

// CommitDetailInfo represents a full commit with diff.
type CommitDetailInfo struct {
	SHA          string    `json:"sha"`
	Message      string    `json:"message"`
	AuthorName   string    `json:"author_name"`
	AuthorEmail  string    `json:"author_email"`
	CommittedAt  time.Time `json:"committed_at"`
	FilesChanged int       `json:"files_changed"`
	Additions    int       `json:"additions"`
	Deletions    int       `json:"deletions"`
	ParentSHAs   []string  `json:"parent_shas"`
	Diff         string    `json:"diff"`
}

// GetCommitDetail returns full commit info plus its diff.
func (m *Manager) GetCommitDetail(org, project, sha string) (*CommitDetailInfo, error) {
	repo, err := m.Open(org, project)
	if err != nil {
		return nil, err
	}

	hash := plumbing.NewHash(sha)
	commit, err := repo.CommitObject(hash)
	if err != nil {
		return nil, fmt.Errorf("commit %q not found: %w", sha, err)
	}

	stats, _ := commit.Stats()
	var additions, deletions, filesChanged int
	for _, s := range stats {
		additions += s.Addition
		deletions += s.Deletion
		filesChanged++
	}

	var parentSHAs []string
	for _, p := range commit.ParentHashes {
		parentSHAs = append(parentSHAs, p.String())
	}

	// Get diff via git CLI for proper unified diff output
	repoPath := m.RepoPath(org, project)
	var diffOut []byte
	if len(commit.ParentHashes) == 0 {
		// Root commit: diff against empty tree
		cmd := exec.Command("git", "-C", repoPath, "diff-tree", "-p", "--root", sha)
		diffOut, _ = cmd.Output()
	} else {
		cmd := exec.Command("git", "-C", repoPath, "diff", commit.ParentHashes[0].String(), sha)
		diffOut, _ = cmd.Output()
	}

	return &CommitDetailInfo{
		SHA:          commit.Hash.String(),
		Message:      strings.TrimSpace(commit.Message),
		AuthorName:   commit.Author.Name,
		AuthorEmail:  commit.Author.Email,
		CommittedAt:  commit.Author.When,
		FilesChanged: filesChanged,
		Additions:    additions,
		Deletions:    deletions,
		ParentSHAs:   parentSHAs,
		Diff:         string(diffOut),
	}, nil
}

// CommitInfo represents a Git commit with metadata.
type CommitInfo struct {
	SHA          string    `json:"sha"`
	Message      string    `json:"message"`
	AuthorName   string    `json:"author_name"`
	AuthorEmail  string    `json:"author_email"`
	CommittedAt  time.Time `json:"committed_at"`
	FilesChanged int       `json:"files_changed"`
	Additions    int       `json:"additions"`
	Deletions    int       `json:"deletions"`
}

// ListCommits returns commits on a branch, with pagination.
func (m *Manager) ListCommits(org, project, branch string, limit, offset int) ([]CommitInfo, error) {
	repo, err := m.Open(org, project)
	if err != nil {
		return nil, err
	}

	ref, err := repo.Reference(plumbing.NewBranchReferenceName(branch), true)
	if err != nil {
		return nil, fmt.Errorf("branch %q not found: %w", branch, err)
	}

	commitIter, err := repo.Log(&git.LogOptions{From: ref.Hash()})
	if err != nil {
		return nil, err
	}
	defer commitIter.Close()

	var commits []CommitInfo
	idx := 0
	err = commitIter.ForEach(func(c *object.Commit) error {
		if idx < offset {
			idx++
			return nil
		}
		if len(commits) >= limit {
			return fmt.Errorf("done") // stop iteration
		}

		stats, _ := c.Stats()
		var additions, deletions, filesChanged int
		for _, s := range stats {
			additions += s.Addition
			deletions += s.Deletion
			filesChanged++
		}

		commits = append(commits, CommitInfo{
			SHA:          c.Hash.String(),
			Message:      strings.TrimSpace(c.Message),
			AuthorName:   c.Author.Name,
			AuthorEmail:  c.Author.Email,
			CommittedAt:  c.Author.When,
			FilesChanged: filesChanged,
			Additions:    additions,
			Deletions:    deletions,
		})
		idx++
		return nil
	})

	// "done" error is expected for pagination
	if err != nil && err.Error() != "done" {
		return nil, err
	}

	return commits, nil
}

// FileEntry represents a file or directory in the repository tree.
type FileEntry struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Type string `json:"type"` // "file" | "dir"
	Size int64  `json:"size,omitempty"`
	Mode string `json:"mode"`
}

// FileTree returns the directory listing at a given ref and path.
func (m *Manager) FileTree(org, project, ref, path string) ([]FileEntry, error) {
	repo, err := m.Open(org, project)
	if err != nil {
		return nil, err
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return nil, fmt.Errorf("ref %q not found: %w", ref, err)
	}

	commit, err := repo.CommitObject(*hash)
	if err != nil {
		return nil, err
	}

	tree, err := commit.Tree()
	if err != nil {
		return nil, err
	}

	// Navigate to subdirectory if path is specified
	if path != "" && path != "/" {
		tree, err = tree.Tree(strings.TrimPrefix(path, "/"))
		if err != nil {
			return nil, fmt.Errorf("path %q not found: %w", path, err)
		}
	}

	var entries []FileEntry
	for _, entry := range tree.Entries {
		fe := FileEntry{
			Name: entry.Name,
			Path: filepath.Join(path, entry.Name),
			Mode: entry.Mode.String(),
		}
		if entry.Mode.IsFile() {
			fe.Type = "file"
			blob, err := repo.BlobObject(entry.Hash)
			if err == nil {
				fe.Size = blob.Size
			}
		} else {
			fe.Type = "dir"
		}
		entries = append(entries, fe)
	}

	// Sort: dirs first, then files, alphabetical
	sort.Slice(entries, func(i, j int) bool {
		if entries[i].Type != entries[j].Type {
			return entries[i].Type == "dir"
		}
		return entries[i].Name < entries[j].Name
	})

	return entries, nil
}

// TreeEntryCommit holds the last commit info for a single tree entry.
type TreeEntryCommit struct {
	Path        string `json:"path"`
	SHA         string `json:"sha"`
	Message     string `json:"message"`
	AuthorName  string `json:"author_name"`
	AuthorEmail string `json:"author_email"`
	Date        string `json:"date"`
}

// TreeCommits returns the last commit that touched each entry in a directory.
func (m *Manager) TreeCommits(org, project, ref, dirPath string) ([]TreeEntryCommit, error) {
	// First get the list of entries
	entries, err := m.FileTree(org, project, ref, dirPath)
	if err != nil {
		return nil, err
	}

	repoPath := m.RepoPath(org, project)
	var results []TreeEntryCommit

	for _, entry := range entries {
		entryPath := entry.Path
		if entryPath == "" {
			entryPath = entry.Name
		}

		// git log -1 --format='%H%n%s%n%an%n%ae%n%aI' <ref> -- <path>
		cmd := exec.Command("git", "-C", repoPath, "log", "-1",
			"--format=%H%n%s%n%an%n%ae%n%aI",
			ref, "--", entryPath)
		out, err := cmd.Output()
		if err != nil || len(out) == 0 {
			// No commit found for this path — skip
			results = append(results, TreeEntryCommit{Path: entryPath})
			continue
		}

		parts := strings.SplitN(strings.TrimSpace(string(out)), "\n", 5)
		tc := TreeEntryCommit{Path: entryPath}
		if len(parts) >= 1 {
			tc.SHA = parts[0]
		}
		if len(parts) >= 2 {
			tc.Message = parts[1]
		}
		if len(parts) >= 3 {
			tc.AuthorName = parts[2]
		}
		if len(parts) >= 4 {
			tc.AuthorEmail = parts[3]
		}
		if len(parts) >= 5 {
			tc.Date = parts[4]
		}
		results = append(results, tc)
	}

	return results, nil
}

// FileContent returns the content of a file at a given ref and path.
func (m *Manager) FileContent(org, project, ref, path string) ([]byte, error) {
	repo, err := m.Open(org, project)
	if err != nil {
		return nil, err
	}

	hash, err := repo.ResolveRevision(plumbing.Revision(ref))
	if err != nil {
		return nil, err
	}

	commit, err := repo.CommitObject(*hash)
	if err != nil {
		return nil, err
	}

	file, err := commit.File(strings.TrimPrefix(path, "/"))
	if err != nil {
		return nil, fmt.Errorf("file %q not found: %w", path, err)
	}

	content, err := file.Contents()
	if err != nil {
		return nil, err
	}
	return []byte(content), nil
}

// =============================================================================
// Write Operations (exec — merge, rebase need full git binary)
// =============================================================================

// MergeResult contains the result of a merge operation.
type MergeResult struct {
	Success   bool     `json:"success"`
	MergeSHA  string   `json:"merge_sha,omitempty"`
	Message   string   `json:"message"`
	Conflicts []string `json:"conflicts,omitempty"`
}

// Merge performs a merge of source into target branch using the specified strategy.
// strategy: "merge" | "squash" | "rebase"
func (m *Manager) Merge(org, project, sourceBranch, targetBranch, strategy, authorName, authorEmail string) (*MergeResult, error) {
	repoPath := m.RepoPath(org, project)

	switch strategy {
	case "squash":
		return m.squashMerge(repoPath, sourceBranch, targetBranch, authorName, authorEmail)
	case "rebase":
		return m.rebaseMerge(repoPath, sourceBranch, targetBranch)
	default: // "merge"
		return m.standardMerge(repoPath, sourceBranch, targetBranch, authorName, authorEmail)
	}
}

func (m *Manager) standardMerge(repoPath, source, target, authorName, authorEmail string) (*MergeResult, error) {
	// Create a temporary worktree for the merge
	tmpDir, err := os.MkdirTemp("", "mc-merge-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	// Clone bare repo to temp
	cmd := exec.Command("git", "clone", "--branch", target, repoPath, tmpDir)
	if out, err := cmd.CombinedOutput(); err != nil {
		return &MergeResult{Success: false, Message: string(out)}, nil
	}

	// Merge
	cmd = exec.Command("git", "-C", tmpDir, "merge", "--no-ff",
		fmt.Sprintf("origin/%s", source),
		"-m", fmt.Sprintf("Merge branch '%s' into %s", source, target),
	)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("GIT_AUTHOR_NAME=%s", authorName),
		fmt.Sprintf("GIT_AUTHOR_EMAIL=%s", authorEmail),
		fmt.Sprintf("GIT_COMMITTER_NAME=%s", authorName),
		fmt.Sprintf("GIT_COMMITTER_EMAIL=%s", authorEmail),
	)

	if out, err := cmd.CombinedOutput(); err != nil {
		return &MergeResult{Success: false, Message: string(out)}, nil
	}

	// Push back to bare repo
	cmd = exec.Command("git", "-C", tmpDir, "push", "origin", target)
	if out, err := cmd.CombinedOutput(); err != nil {
		return &MergeResult{Success: false, Message: string(out)}, nil
	}

	// Get merge commit SHA
	cmd = exec.Command("git", "-C", tmpDir, "rev-parse", "HEAD")
	sha, _ := cmd.Output()

	return &MergeResult{
		Success:  true,
		MergeSHA: strings.TrimSpace(string(sha)),
		Message:  fmt.Sprintf("Merged '%s' into '%s'", source, target),
	}, nil
}

func (m *Manager) squashMerge(repoPath, source, target, authorName, authorEmail string) (*MergeResult, error) {
	tmpDir, err := os.MkdirTemp("", "mc-squash-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	cmds := [][]string{
		{"git", "clone", "--branch", target, repoPath, tmpDir},
		{"git", "-C", tmpDir, "merge", "--squash", fmt.Sprintf("origin/%s", source)},
	}

	for _, args := range cmds {
		cmd := exec.Command(args[0], args[1:]...)
		if out, err := cmd.CombinedOutput(); err != nil {
			return &MergeResult{Success: false, Message: string(out)}, nil
		}
	}

	// Commit squash
	cmd := exec.Command("git", "-C", tmpDir, "commit",
		"-m", fmt.Sprintf("Squashed merge of '%s' into %s", source, target),
	)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("GIT_AUTHOR_NAME=%s", authorName),
		fmt.Sprintf("GIT_AUTHOR_EMAIL=%s", authorEmail),
		fmt.Sprintf("GIT_COMMITTER_NAME=%s", authorName),
		fmt.Sprintf("GIT_COMMITTER_EMAIL=%s", authorEmail),
	)
	if out, err := cmd.CombinedOutput(); err != nil {
		return &MergeResult{Success: false, Message: string(out)}, nil
	}

	cmd = exec.Command("git", "-C", tmpDir, "push", "origin", target)
	if out, err := cmd.CombinedOutput(); err != nil {
		return &MergeResult{Success: false, Message: string(out)}, nil
	}

	cmd = exec.Command("git", "-C", tmpDir, "rev-parse", "HEAD")
	sha, _ := cmd.Output()

	return &MergeResult{
		Success:  true,
		MergeSHA: strings.TrimSpace(string(sha)),
		Message:  fmt.Sprintf("Squash-merged '%s' into '%s'", source, target),
	}, nil
}

func (m *Manager) rebaseMerge(repoPath, source, target string) (*MergeResult, error) {
	tmpDir, err := os.MkdirTemp("", "mc-rebase-*")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tmpDir)

	cmds := [][]string{
		{"git", "clone", "--branch", source, repoPath, tmpDir},
		{"git", "-C", tmpDir, "rebase", fmt.Sprintf("origin/%s", target)},
		{"git", "-C", tmpDir, "push", "origin", fmt.Sprintf("HEAD:%s", target)},
	}

	for _, args := range cmds {
		cmd := exec.Command(args[0], args[1:]...)
		if out, err := cmd.CombinedOutput(); err != nil {
			return &MergeResult{Success: false, Message: string(out)}, nil
		}
	}

	cmd := exec.Command("git", "-C", tmpDir, "rev-parse", "HEAD")
	sha, _ := cmd.Output()

	return &MergeResult{
		Success:  true,
		MergeSHA: strings.TrimSpace(string(sha)),
		Message:  fmt.Sprintf("Rebased '%s' onto '%s'", source, target),
	}, nil
}

// Diff generates a unified diff between two refs.
func (m *Manager) Diff(org, project, base, head string) (string, error) {
	repoPath := m.RepoPath(org, project)
	cmd := exec.Command("git", "-C", repoPath, "diff", base, head, "--stat", "--patch")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("diff error: %s", string(out))
	}
	return string(out), nil
}
