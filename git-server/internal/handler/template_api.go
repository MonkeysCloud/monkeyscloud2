package handler

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/monkeyscloud/git-server/internal/repository"
)

// TemplateAPI handles REST operations for stack templates.
type TemplateAPI struct {
	repoMgr *repository.Manager
}

// NewTemplateAPI creates a new template handler.
func NewTemplateAPI(repoMgr *repository.Manager) *TemplateAPI {
	return &TemplateAPI{repoMgr: repoMgr}
}

// List returns all template stacks.
// GET /api/templates
func (h *TemplateAPI) List(w http.ResponseWriter, r *http.Request) {
	templates, err := h.repoMgr.ListTemplates()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"templates": templates,
	})
}

// GetFiles returns the file tree for a template.
// GET /api/templates/{stack}
func (h *TemplateAPI) GetFiles(w http.ResponseWriter, r *http.Request) {
	stack := chi.URLParam(r, "stack")
	files, err := h.repoMgr.GetTemplateFiles(stack)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"stack": stack,
		"files": files,
	})
}

// GetFileContent returns the content of a single file.
// GET /api/templates/{stack}/files?path=...
func (h *TemplateAPI) GetFileContent(w http.ResponseWriter, r *http.Request) {
	stack := chi.URLParam(r, "stack")
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path query parameter required", http.StatusBadRequest)
		return
	}

	content, err := h.repoMgr.GetTemplateFileContent(stack, path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"stack":   stack,
		"path":    path,
		"content": content,
	})
}

type updateFileRequest struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Message string `json:"message"`
}

// UpdateFile creates or updates a file in a template.
// PUT /api/templates/{stack}/files
func (h *TemplateAPI) UpdateFile(w http.ResponseWriter, r *http.Request) {
	stack := chi.URLParam(r, "stack")

	var req updateFileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Path == "" {
		http.Error(w, "path is required", http.StatusBadRequest)
		return
	}

	// Sanitize path — no path traversal
	if strings.Contains(req.Path, "..") {
		http.Error(w, "invalid path", http.StatusBadRequest)
		return
	}

	if err := h.repoMgr.UpdateTemplateFile(stack, req.Path, req.Content, req.Message); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

// DeleteFile removes a file from a template.
// DELETE /api/templates/{stack}/files?path=...
func (h *TemplateAPI) DeleteFile(w http.ResponseWriter, r *http.Request) {
	stack := chi.URLParam(r, "stack")
	path := r.URL.Query().Get("path")
	if path == "" {
		http.Error(w, "path query parameter required", http.StatusBadRequest)
		return
	}

	if err := h.repoMgr.DeleteTemplateFile(stack, path); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

type createTemplateRequest struct {
	Name   string `json:"name"`
	Source string `json:"source"` // optional: duplicate from existing
}

// Create creates a new template stack (optionally from an existing one).
// POST /api/templates
func (h *TemplateAPI) Create(w http.ResponseWriter, r *http.Request) {
	var req createTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "name is required", http.StatusBadRequest)
		return
	}

	if err := h.repoMgr.CreateTemplate(req.Name, req.Source); err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "already exists") {
			status = http.StatusConflict
		}
		http.Error(w, err.Error(), status)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"status": "created", "name": req.Name})
}

// Delete removes a template stack entirely.
// DELETE /api/templates/{stack}
func (h *TemplateAPI) Delete(w http.ResponseWriter, r *http.Request) {
	stack := chi.URLParam(r, "stack")

	if err := h.repoMgr.DeleteTemplate(stack); err != nil {
		status := http.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") {
			status = http.StatusNotFound
		}
		http.Error(w, err.Error(), status)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}
