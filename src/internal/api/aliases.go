// Package api provides HTTP handlers for the API
package api

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/chrote/server/internal/core"
)

// AliasesHandler handles session alias configuration
type AliasesHandler struct {
	mu       sync.RWMutex
	aliases  map[string][]string // session name -> list of aliases
	filePath string
}

// AliasesResponse is the response for listing aliases
type AliasesResponse struct {
	Aliases map[string][]string `json:"aliases"`
}

// UpdateAliasesRequest is the request body for updating aliases
type UpdateAliasesRequest struct {
	Aliases map[string][]string `json:"aliases"`
}

// NewAliasesHandler creates a new AliasesHandler
func NewAliasesHandler() *AliasesHandler {
	h := &AliasesHandler{
		aliases:  make(map[string][]string),
		filePath: aliasesFilePath(),
	}
	h.load()
	return h
}

// aliasesFilePath returns the path to the aliases JSON file
func aliasesFilePath() string {
	// Store in CHROTE_DATA_DIR or alongside the binary
	if dir := os.Getenv("CHROTE_DATA_DIR"); dir != "" {
		return filepath.Join(dir, "aliases.json")
	}
	// Default: ~/.chrote/aliases.json
	home, err := os.UserHomeDir()
	if err != nil {
		return "/tmp/chrote-aliases.json"
	}
	dir := filepath.Join(home, ".chrote")
	os.MkdirAll(dir, 0755)
	return filepath.Join(dir, "aliases.json")
}

// RegisterRoutes registers the aliases routes on the given mux
func (h *AliasesHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/aliases", h.GetAliases)
	mux.HandleFunc("PUT /api/aliases", h.UpdateAliases)
}

// load reads aliases from the JSON file
func (h *AliasesHandler) load() {
	data, err := os.ReadFile(h.filePath)
	if err != nil {
		return // File doesn't exist yet, use empty map
	}
	var aliases map[string][]string
	if err := json.Unmarshal(data, &aliases); err != nil {
		return
	}
	h.aliases = aliases
}

// save writes aliases to the JSON file
func (h *AliasesHandler) save() error {
	data, err := json.MarshalIndent(h.aliases, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(h.filePath, data, 0644)
}

// GetAliases handles GET /api/aliases
func (h *AliasesHandler) GetAliases(w http.ResponseWriter, r *http.Request) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	core.WriteJSON(w, http.StatusOK, AliasesResponse{
		Aliases: h.aliases,
	})
}

// UpdateAliases handles PUT /api/aliases
func (h *AliasesHandler) UpdateAliases(w http.ResponseWriter, r *http.Request) {
	var req UpdateAliasesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		core.WriteError(w, http.StatusBadRequest, "BAD_REQUEST", "Invalid JSON body")
		return
	}

	if req.Aliases == nil {
		core.WriteError(w, http.StatusBadRequest, "BAD_REQUEST", "aliases field is required")
		return
	}

	h.mu.Lock()
	h.aliases = req.Aliases
	err := h.save()
	h.mu.Unlock()

	if err != nil {
		core.WriteError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to save aliases: "+err.Error())
		return
	}

	core.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"aliases": req.Aliases,
	})
}
