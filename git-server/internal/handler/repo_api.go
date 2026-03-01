package handler

import (
	"encoding/json"
	"net/http"

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
	Org     string `json:"org"`
	Project string `json:"project"`
}

// Create initializes a new bare repository.
func (h *RepoAPI) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateRepoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid JSON", http.StatusBadRequest)
		return
	}

	if err := h.repoMgr.InitBare(req.Org, req.Project); err != nil {
		log.Error().Err(err).Msg("Failed to create repo")
		http.Error(w, "Failed to create repository", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "created",
		"org":     req.Org,
		"project": req.Project,
	})
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

// FileTree returns directory listing at a ref.
func (h *CodeAPI) FileTree(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	ref := chi.URLParam(r, "ref")
	path := chi.URLParam(r, "*")

	entries, err := h.repoMgr.FileTree(org, project, ref, path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entries)
}

// FileContent returns file content at a ref.
func (h *CodeAPI) FileContent(w http.ResponseWriter, r *http.Request) {
	org := chi.URLParam(r, "org")
	project := chi.URLParam(r, "project")
	ref := chi.URLParam(r, "ref")
	path := chi.URLParam(r, "*")

	content, err := h.repoMgr.FileContent(org, project, ref, path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/plain")
	w.Write(content)
}
