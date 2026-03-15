package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/gliderlabs/ssh"
	gossh "golang.org/x/crypto/ssh"
	"github.com/monkeyscloud/git-server/internal/hooks"
	"github.com/monkeyscloud/git-server/internal/repository"
	"github.com/rs/zerolog/log"
)

// GitSSH handles the Git protocol over SSH.
type GitSSH struct {
	repoMgr  *repository.Manager
	hookExec *hooks.Executor
}

func NewGitSSH(repoMgr *repository.Manager, hookExec *hooks.Executor) *GitSSH {
	return &GitSSH{repoMgr: repoMgr, hookExec: hookExec}
}

// PublicKeyHandler authenticates SSH connections against the platform API.
func (h *GitSSH) PublicKeyHandler(ctx ssh.Context, key ssh.PublicKey) bool {
	pubKeyBytes := gossh.MarshalAuthorizedKey(key)
	pubKeyStr := strings.TrimSpace(string(pubKeyBytes))

	apiURL := os.Getenv("PLATFORM_API_URL")
	if apiURL == "" {
		apiURL = "http://api:8000"
	}

	payload, _ := json.Marshal(map[string]string{
		"public_key": pubKeyStr,
	})

	resp, err := http.Post(apiURL+"/api/v1/internal/validate-ssh-key", "application/json", bytes.NewReader(payload))
	if err != nil {
		log.Error().Err(err).Msg("SSH key validation API error")
		return false
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return false
	}

	var result struct {
		Valid          bool     `json:"valid"`
		UserID         int      `json:"user_id"`
		Scopes         []string `json:"scopes"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false
	}

	if result.Valid {
		ctx.SetValue("user_id", result.UserID)
		ctx.SetValue("scopes", result.Scopes)
	}

	return result.Valid
}

// SessionHandler executes git operations for authenticated SSH sessions.
func (h *GitSSH) SessionHandler(s ssh.Session) {
	cmd := s.Command()
	if len(cmd) < 2 {
		fmt.Fprintln(s, "Invalid Git command.")
		s.Exit(1)
		return
	}

	gitCmd := cmd[0]
	if gitCmd != "git-upload-pack" && gitCmd != "git-receive-pack" {
		fmt.Fprintln(s, "Only git-upload-pack and git-receive-pack are supported.")
		s.Exit(1)
		return
	}

	repoPathStr := strings.Trim(cmd[1], "'\"")
	if !strings.HasSuffix(repoPathStr, ".git") {
		repoPathStr += ".git"
	}

	parts := strings.Split(strings.TrimPrefix(repoPathStr, "/"), "/")
	if len(parts) != 2 {
		fmt.Fprintln(s, "Invalid repository path. Use org/project.git")
		s.Exit(1)
		return
	}

	org := parts[0]
	project := strings.TrimSuffix(parts[1], ".git")

	// Scope verification
	requiredScope := "read"
	if gitCmd == "git-receive-pack" {
		requiredScope = "write"
	}

	scopes, ok := s.Context().Value("scopes").([]string)
	if !ok {
		fmt.Fprintln(s, "Missing scopes.")
		s.Exit(1)
		return
	}

	hasScope := false
	for _, scope := range scopes {
		if scope == requiredScope || scope == "admin" { // Assuming admin overrides
			hasScope = true
			break
		}
	}

	if !hasScope {
		fmt.Fprintf(s, "Insufficient permissions to %s.\n", requiredScope)
		s.Exit(1)
		return
	}

	if !h.repoMgr.Exists(org, project) {
		fmt.Fprintln(s, "Repository not found.")
		s.Exit(1)
		return
	}

	repoPath := h.repoMgr.RepoPath(org, project)

	execCmd := exec.Command("git", strings.TrimPrefix(gitCmd, "git-"), repoPath)
	
	// TeeReader lets us capture the payload for hooks if this is a push
	var buf bytes.Buffer
	if gitCmd == "git-receive-pack" {
		execCmd.Stdin = io.TeeReader(s, &buf)
	} else {
		execCmd.Stdin = s
	}
	
	execCmd.Stdout = s
	execCmd.Stderr = s.Stderr()

	if err := execCmd.Run(); err != nil {
		log.Error().Err(err).Str("org", org).Str("project", project).Msg("SSH git cmd failed")
		s.Exit(1)
		return
	}

	// Post-receive hook interception
	if gitCmd == "git-receive-pack" {
		updates := ParseRefUpdates(buf.Bytes())
		if len(updates) > 0 {
			go h.hookExec.PostReceive(org, project, updates)
			log.Info().Str("org", org).Str("project", project).Int("refs", len(updates)).Msg("SSH Push received")
		}
	}

	s.Exit(0)
}
