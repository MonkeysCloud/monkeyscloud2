package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"github.com/monkeyscloud/git-server/internal/repository"
)

// RepoAPI handles repository management REST API (called by platform API).
type RepoAPI struct {
	repoMgr *repository.Manager
}

func NewRepoAPI(repoMgr *repository.Manager) *RepoAPI {
	return &RepoAPI{repoMgr: repoMgr}
}

type CreateRepoRequest struct {
	Org             string `json:"org"`
	Project         string `json:"project"`
	Stack           string `json:"stack"`            // Legacy: template branch name
	DockerImage     string `json:"docker_image"`     // Scaffold: Docker image to use
	ScaffoldCommand string `json:"scaffold_command"` // Scaffold: command to run in container
	Gitignore       string `json:"gitignore"`        // Scaffold: .gitignore content
}

// Create initializes a new bare repository, optionally scaffolding via Docker.
// Falls back to built-in seed files if Docker is unavailable (e.g. in GKE).
func (h *RepoAPI) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRepoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	var err error
	if req.DockerImage != "" && req.ScaffoldCommand != "" {
		// Try Docker scaffold first
		err = h.repoMgr.ScaffoldProject(req.Org, req.Project, req.DockerImage, req.ScaffoldCommand, req.Gitignore)
		if err != nil {
			// Docker not available (e.g. GKE) — fall back to templates repo
			stack := req.Stack
			if stack == "" {
				stack = inferStack(req.DockerImage)
			}
			log.Warn().Err(err).Str("stack", stack).Msg("Docker scaffold failed, falling back to template repo")
			// Use the admin-managed _system/templates.git repo
			err = h.repoMgr.InitBareWithStack(req.Org, req.Project, stack)
		}
	} else if req.Stack != "" {
		// Use template branches from _system/templates.git
		err = h.repoMgr.InitBareWithStack(req.Org, req.Project, req.Stack)
	} else {
		err = h.repoMgr.InitBare(req.Org, req.Project)
	}

	if err != nil {
		log.Error().Err(err).Msg("Failed to create repo")
		http.Error(w, "Failed to create repository: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "created",
		"org":     req.Org,
		"project": req.Project,
	})
}

// inferStack tries to guess the stack name from a Docker image path.
func inferStack(image string) string {
	lower := strings.ToLower(image)
	switch {
	case strings.Contains(lower, "php"):
		return "monkeyslegion"
	case strings.Contains(lower, "node"):
		return "nextjs"
	case strings.Contains(lower, "python"):
		return "python-generic"
	case strings.Contains(lower, "go"):
		return "go-generic"
	case strings.Contains(lower, "ruby"):
		return "ruby-generic"
	default:
		return ""
	}
}

// Delete removes a repository.
func (h *RepoAPI) Delete(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	if err := h.repoMgr.Delete(org, project); err != nil {
		http.Error(w, "Failed to delete repository", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// Fork creates a copy of a repository.
func (h *RepoAPI) Fork(w http.ResponseWriter, r *http.Request) {
	// TODO: Implement fork (git clone --bare source target)
	http.Error(w, "Not implemented", http.StatusNotImplemented)
}

// CodeAPI handles code browsing REST API (called by platform API).
type CodeAPI struct {
	repoMgr *repository.Manager
}

func NewCodeAPI(repoMgr *repository.Manager) *CodeAPI {
	return &CodeAPI{repoMgr: repoMgr}
}

// Diff returns the diff between two refs.
func (h *CodeAPI) Diff(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	base := chi.URLParam(r, "base")
	head := chi.URLParam(r, "head")

	diffOutput, err := h.repoMgr.Diff(org, project, base, head)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write([]byte(diffOutput))
}

// Merge merges source branch into target.
func (h *CodeAPI) Merge(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	var req struct {
		SourceBranch string `json:"source_branch"`
		TargetBranch string `json:"target_branch"`
		Strategy     string `json:"strategy"` // merge | squash | rebase
		AuthorName   string `json:"author_name"`
		AuthorEmail  string `json:"author_email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	result, err := h.repoMgr.Merge(org, project, req.SourceBranch, req.TargetBranch,
		req.Strategy, req.AuthorName, req.AuthorEmail)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ListBranches returns all branches.
func (h *CodeAPI) ListBranches(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	branches, err := h.repoMgr.ListBranches(org, project)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(branches)
}

// ListBranchesDetailed returns branches with ahead/behind counts.
func (h *CodeAPI) ListBranchesDetailed(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	branches, err := h.repoMgr.ListBranchesDetailed(org, project)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(branches)
}

// CreateBranch creates a new branch from a source ref.
func (h *CodeAPI) CreateBranch(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	var req struct {
		Name   string `json:"name"`
		Source string `json:"source"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid JSON body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}
	if req.Source == "" {
		req.Source = "main"
	}

	if err := h.repoMgr.CreateBranch(org, project, req.Name, req.Source); err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		} else if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		http.Error(w, err.Error(), status)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status": "created",
		"branch": req.Name,
		"source": req.Source,
	})
}

// ListCommits returns commits on a branch.
func (h *CodeAPI) ListCommits(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	branch := r.URL.Query().Get("branch")
	if branch == "" {
		branch = "main"
	}

	commits, err := h.repoMgr.ListCommits(org, project, branch, 50, 0)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(commits)
}

// GetCommitDetail returns full commit info with diff.
func (h *CodeAPI) GetCommitDetail(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	sha := chi.URLParam(r, "sha")

	detail, err := h.repoMgr.GetCommitDetail(org, project, sha)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			http.Error(w, err.Error(), http.StatusNotFound)
		} else {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(detail)
}

// FileTree returns directory listing at a ref.
func (h *CodeAPI) FileTree(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	ref := r.URL.Query().Get("ref")
	path := r.URL.Query().Get("path")
	if ref == "" {
		ref = "main"
	}

	entries, err := h.repoMgr.FileTree(org, project, ref, path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// TreeCommits returns the last commit for each entry in a directory.
func (h *CodeAPI) TreeCommits(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	ref := r.URL.Query().Get("ref")
	path := r.URL.Query().Get("path")
	if ref == "" {
		ref = "main"
	}

	commits, err := h.repoMgr.TreeCommits(org, project, ref, path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(commits)
}

// FileContent returns file content at a ref.
func (h *CodeAPI) FileContent(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	ref := r.URL.Query().Get("ref")
	path := r.URL.Query().Get("path")
	if ref == "" {
		ref = "main"
	}

	content, err := h.repoMgr.FileContent(org, project, ref, path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write(content)
}

// ListTags returns all tags for a repository.
func (h *CodeAPI) ListTags(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	tags, err := h.repoMgr.ListTags(org, project)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tags)
}

// CreateTag creates a new tag.
func (h *CodeAPI) CreateTag(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	var body struct {
		Name    string `json:"name"`
		Ref     string `json:"ref"`
		Message string `json:"message"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Name == "" || body.Ref == "" {
		http.Error(w, "name and ref are required", http.StatusBadRequest)
		return
	}

	if err := h.repoMgr.CreateTag(org, project, body.Name, body.Ref, body.Message); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "created", "tag": body.Name})
}

// DeleteTag deletes a tag.
func (h *CodeAPI) DeleteTag(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")

	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if body.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	if err := h.repoMgr.DeleteTag(org, project, body.Name); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted", "tag": body.Name})
}
