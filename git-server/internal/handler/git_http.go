package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"github.com/monkeyscloud/git-server/internal/hooks"
	"github.com/monkeyscloud/git-server/internal/repository"
)

// GitHTTP handles the Git Smart HTTP Protocol.
// Implements: info/refs, git-upload-pack, git-receive-pack
type GitHTTP struct {
	repoMgr  *repository.Manager
	hookExec *hooks.Executor
}

// NewGitHTTP creates a new Git HTTP handler.
func NewGitHTTP(repoMgr *repository.Manager, hookExec *hooks.Executor) *GitHTTP {
	return &GitHTTP{repoMgr: repoMgr, hookExec: hookExec}
}

// AuthMiddleware validates Git credentials (Basic Auth with API key token).
// The user sends: username=x-token-auth, password=mc_xxxx...
// We validate by calling the platform API's /api/v1/internal/validate-token endpoint.
func (h *GitHTTP) AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract Basic Auth credentials
		_, password, ok := r.BasicAuth()
		if !ok || password == "" {
			w.Header().Set("WWW-Authenticate", `Basic realm="MonkeysCloud Git"`)
			http.Error(w, "Authentication required", http.StatusUnauthorized)
			return
		}

		// Extract org from URL path: /{org}/{project}.git/...
		org := chi.URLParam(r, "org")

		// Determine required scope based on the operation
		requiredScope := "read"
		if strings.Contains(r.URL.Path, "git-receive-pack") {
			requiredScope = "write"
		}

		// Validate token against platform API
		valid, scopes, err := h.validateToken(password, org)
		if err != nil {
			log.Error().Err(err).Msg("Token validation error")
			http.Error(w, "Authentication service unavailable", http.StatusServiceUnavailable)
			return
		}
		if !valid {
			w.Header().Set("WWW-Authenticate", `Basic realm="MonkeysCloud Git"`)
			http.Error(w, "Invalid credentials", http.StatusUnauthorized)
			return
		}

		// Check scope
		hasScope := false
		for _, s := range scopes {
			if s == requiredScope || s == "admin" {
				hasScope = true
				break
			}
		}
		if !hasScope {
			http.Error(w, "Insufficient permissions", http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}

// validateToken calls the platform API to verify an API key token.
func (h *GitHTTP) validateToken(token, org string) (bool, []string, error) {
	apiURL := os.Getenv("PLATFORM_API_URL")
	if apiURL == "" {
		apiURL = "http://api:8000"
	}

	payload := fmt.Sprintf(`{"token":"%s","org":"%s"}`, token, org)
	resp, err := http.Post(apiURL+"/api/v1/internal/validate-token", "application/json", strings.NewReader(payload))
	if err != nil {
		return false, nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return false, nil, nil
	}

	var result struct {
		Valid          bool     `json:"valid"`
		UserID         int      `json:"user_id"`
		OrganizationID int      `json:"organization_id"`
		Scopes         []string `json:"scopes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, nil, err
	}

	return result.Valid, result.Scopes, nil
}

// InfoRefs handles GET /{org}/{project}.git/info/refs?service=git-upload-pack|git-receive-pack
// This is the Smart HTTP discovery endpoint.
func (h *GitHTTP) InfoRefs(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	service := r.URL.Query().Get("service")

	if service != "git-upload-pack" && service != "git-receive-pack" {
		http.Error(w, "Invalid service", http.StatusBadRequest)
		return
	}

	if !h.repoMgr.Exists(org, project) {
		http.Error(w, "Repository not found", http.StatusNotFound)
		return
	}

	repoPath := h.repoMgr.RepoPath(org, project)

	w.Header().Set("Content-Type", fmt.Sprintf("application/x-%s-advertisement", service))
	w.Header().Set("Cache-Control", "no-cache")

	// Write pkt-line header
	header := fmt.Sprintf("# service=%s\n", service)
	pktLine := fmt.Sprintf("%04x%s", len(header)+4, header)
	w.Write([]byte(pktLine))
	w.Write([]byte("0000"))

	// Run git service to get refs
	cmd := exec.Command("git", service[4:], "--stateless-rpc", "--advertise-refs", repoPath)
	cmd.Stdout = w
	if err := cmd.Run(); err != nil {
		log.Error().Err(err).Str("org", org).Str("project", project).Msg("info/refs failed")
	}
}

// UploadPack handles POST /{org}/{project}.git/git-upload-pack (clone/fetch).
func (h *GitHTTP) UploadPack(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	repoPath := h.repoMgr.RepoPath(org, project)

	w.Header().Set("Content-Type", "application/x-git-upload-pack-result")
	w.Header().Set("Cache-Control", "no-cache")

	cmd := exec.Command("git", "upload-pack", "--stateless-rpc", repoPath)
	cmd.Stdin = r.Body
	cmd.Stdout = w

	if err := cmd.Run(); err != nil {
		log.Error().Err(err).Str("org", org).Str("project", project).Msg("upload-pack failed")
	}
}

// ReceivePack handles POST /{org}/{project}.git/git-receive-pack (push).
// This is where hooks fire: pre-receive (validation) and post-receive (notifications).
func (h *GitHTTP) ReceivePack(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	repoPath := h.repoMgr.RepoPath(org, project)

	w.Header().Set("Content-Type", "application/x-git-receive-pack-result")
	w.Header().Set("Cache-Control", "no-cache")

	// Read the push payload to extract ref updates
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request", http.StatusInternalServerError)
		return
	}

	// Pre-receive hook: validate branch protection, required reviewers, etc.
	refUpdates := parseRefUpdates(body)
	if err := h.hookExec.PreReceive(r.Context(), org, project, refUpdates); err != nil {
		// Reject the push
		log.Warn().Err(err).Str("org", org).Str("project", project).Msg("Pre-receive hook rejected push")
		w.WriteHeader(http.StatusForbidden)
		fmt.Fprintf(w, "0033\x02pre-receive hook declined: %s\n", err.Error())
		w.Write([]byte("0000"))
		return
	}

	// Execute git-receive-pack
	cmd := exec.Command("git", "receive-pack", "--stateless-rpc", repoPath)
	cmd.Stdin = strings.NewReader(string(body))
	cmd.Stdout = w

	if err := cmd.Run(); err != nil {
		log.Error().Err(err).Str("org", org).Str("project", project).Msg("receive-pack failed")
		return
	}

	// Post-receive hook: trigger builds, link commits, fire webhooks
	go h.hookExec.PostReceive(org, project, refUpdates)

	log.Info().Str("org", org).Str("project", project).Int("refs", len(refUpdates)).Msg("Push received")
}

// parseRefUpdates extracts ref updates from the receive-pack payload.
// Format: <old-sha> <new-sha> <ref-name>
func parseRefUpdates(body []byte) []hooks.RefUpdate {
	var updates []hooks.RefUpdate
	lines := strings.Split(string(body), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Skip pkt-line headers and empty lines
		if len(line) < 83 || strings.HasPrefix(line, "0000") {
			continue
		}
		// Strip pkt-line length prefix if present (4 hex chars)
		if len(line) > 4 {
			trimmed := line
			if len(trimmed) > 4 && trimmed[0] >= '0' && trimmed[0] <= '9' {
				trimmed = trimmed[4:]
			}
			parts := strings.Fields(trimmed)
			if len(parts) >= 3 {
				updates = append(updates, hooks.RefUpdate{
					OldSHA:  parts[0],
					NewSHA:  parts[1],
					RefName: parts[2],
				})
			}
		}
	}
	return updates
}

// InternalAuthMiddleware validates internal service-to-service calls.
func InternalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// TODO: Validate internal service JWT or shared secret
		token := r.Header.Get("X-Internal-Token")
		if token == "" {
			token = r.Header.Get("Authorization")
		}
		// Accept all in local dev
		next.ServeHTTP(w, r)
	})
}
