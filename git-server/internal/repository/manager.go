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

// InitBare creates a new bare repository.
func (m *Manager) InitBare(org, project string) error {
	repoPath := m.RepoPath(org, project)

	if err := os.MkdirAll(repoPath, 0755); err != nil {
		return fmt.Errorf("mkdir: %w", err)
	}

	_, err := git.PlainInit(repoPath, true)
	if err != nil {
		return fmt.Errorf("init bare: %w", err)
	}

	log.Info().Str("org", org).Str("project", project).Msg("Initialized bare repository")
	return nil
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

	head, _ := repo.Head()
	var defaultBranch string
	if head != nil {
		defaultBranch = head.Name().Short()
	}

	var branches []BranchInfo
	err = refs.ForEach(func(ref *plumbing.Reference) error {
		if ref.Name().IsBranch() {
			commit, err := repo.CommitObject(ref.Hash())
			updatedAt := time.Now()
			if err == nil {
				updatedAt = commit.Author.When
			}

			branches = append(branches, BranchInfo{
				Name:      ref.Name().Short(),
				CommitSHA: ref.Hash().String(),
				IsDefault: ref.Name().Short() == defaultBranch,
				UpdatedAt: updatedAt,
			})
		}
		return nil
	})

	sort.Slice(branches, func(i, j int) bool {
		return branches[i].UpdatedAt.After(branches[j].UpdatedAt)
	})

	return branches, err
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
	Name  string `json:"name"`
	Path  string `json:"path"`
	Type  string `json:"type"` // "file" | "dir"
	Size  int64  `json:"size,omitempty"`
	Mode  string `json:"mode"`
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

	return file.Contents()
}

// =============================================================================
// Write Operations (exec — merge, rebase need full git binary)
// =============================================================================

// MergeResult contains the result of a merge operation.
type MergeResult struct {
	Success    bool   `json:"success"`
	MergeSHA   string `json:"merge_sha,omitempty"`
	Message    string `json:"message"`
	Conflicts  []string `json:"conflicts,omitempty"`
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
