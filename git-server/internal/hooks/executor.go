package hooks

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/rs/zerolog/log"
)

// validHexSHA matches a 40-character lowercase hex string.
var validHexSHA = regexp.MustCompile(`^[0-9a-f]{40}$`)

// RefUpdate represents a single ref update from a git push.
type RefUpdate struct {
	OldSHA  string `json:"old_sha"`
	NewSHA  string `json:"new_sha"`
	RefName string `json:"ref_name"` // e.g., refs/heads/main
}

// Branch extracts the branch name from the ref.
func (r RefUpdate) Branch() string {
	name := strings.TrimPrefix(r.RefName, "refs/heads/")
	// Strip null bytes that may leak from git pack protocol
	return strings.ReplaceAll(name, "\x00", "")
}

// IsNewBranch returns true if this is a new branch.
func (r RefUpdate) IsNewBranch() bool {
	return r.OldSHA == "0000000000000000000000000000000000000000"
}

// IsDeleteBranch returns true if a branch was deleted.
func (r RefUpdate) IsDeleteBranch() bool {
	return r.NewSHA == "0000000000000000000000000000000000000000"
}

// Executor runs Git hooks and notifies the platform API.
type Executor struct {
	platformAPIURL string
	rdb            *redis.Client
	httpClient     *http.Client
}

// NewExecutor creates a hook executor.
func NewExecutor(platformAPIURL, redisAddr string) *Executor {
	rdb := redis.NewClient(&redis.Options{
		Addr: redisAddr,
	})

	return &Executor{
		platformAPIURL: platformAPIURL,
		rdb:            rdb,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// =============================================================================
// Pre-Receive Hook
// =============================================================================

// PreReceive validates the push before accepting it.
// Checks: branch protection rules, required reviewers, size restrictions.
func (e *Executor) PreReceive(ctx context.Context, org, project string, updates []RefUpdate) error {
	for _, update := range updates {
		// Skip branch deletions and new branches for now
		if update.IsDeleteBranch() || update.IsNewBranch() {
			continue
		}

		// Call platform API to validate branch protection
		resp, err := e.callPlatformAPI(ctx, "POST", "/internal/git/pre-receive", map[string]interface{}{
			"org":     org,
			"project": project,
			"branch":  update.Branch(),
			"old_sha": update.OldSHA,
			"new_sha": update.NewSHA,
		})
		if err != nil {
			log.Warn().Err(err).Msg("Pre-receive API call failed, allowing push")
			continue // Allow push if platform API is unreachable (fail-open in dev)
		}

		if resp.StatusCode == http.StatusForbidden {
			return fmt.Errorf("push to '%s' blocked: branch is protected", update.Branch())
		}
	}

	return nil
}

// =============================================================================
// Post-Receive Hook
// =============================================================================

// PostReceive runs after a successful push. Fires asynchronously.
// Actions: trigger CI/CD build, link commits to tasks, fire webhooks.
func (e *Executor) PostReceive(org, project string, updates []RefUpdate) {
	ctx := context.Background()

	for _, update := range updates {
		// Skip invalid ref updates (binary pack data parsed as refs)
		if !validHexSHA.MatchString(update.OldSHA) || !validHexSHA.MatchString(update.NewSHA) {
			continue
		}

		if update.IsDeleteBranch() {
			continue
		}

		branch := update.Branch()

		// 1. Notify platform API about the push (creates Commit records, links tasks)
		go e.notifyPush(ctx, org, project, update)

		// 2. Queue CI/CD build job via Redis
		go e.queueBuildJob(ctx, org, project, branch, update.NewSHA)

		// 3. Fire webhooks via platform API
		go e.fireWebhooks(ctx, org, project, branch, update)

		// 4. Notify WebSocket clients about the push (real-time PR updates)
		go e.publishPREvent(ctx, org, project, branch, update.NewSHA, "push")

		shortSHA := update.NewSHA
		if len(shortSHA) > 8 {
			shortSHA = shortSHA[:8]
		}

		log.Info().
			Str("org", org).
			Str("project", project).
			Str("branch", branch).
			Str("sha", shortSHA).
			Msg("Post-receive hook executed")
	}
}

// publishPREvent notifies WebSocket clients about branch activity relevant to PRs.
func (e *Executor) publishPREvent(ctx context.Context, org, project, branch, sha, action string) {
	payload := map[string]string{
		"org":     org,
		"project": project,
		"branch":  branch,
		"sha":     sha,
		"action":  action,
	}
	data, _ := json.Marshal(payload)
	err := e.rdb.Publish(ctx, "ws:pr", string(data)).Err()
	if err != nil {
		log.Error().Err(err).Msg("Failed to publish PR event to Redis")
	}
}

// notifyPush tells the platform API about new commits.
func (e *Executor) notifyPush(ctx context.Context, org, project string, update RefUpdate) {
	_, err := e.callPlatformAPI(ctx, "POST", "/internal/git/post-receive", map[string]interface{}{
		"org":     org,
		"project": project,
		"branch":  update.Branch(),
		"old_sha": update.OldSHA,
		"new_sha": update.NewSHA,
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to notify platform API about push")
	}
}

// queueBuildJob pushes a build job to Redis for the CI/CD worker.
func (e *Executor) queueBuildJob(ctx context.Context, org, project, branch, sha string) {
	job := map[string]string{
		"type":    "build",
		"org":     org,
		"project": project,
		"branch":  branch,
		"sha":     sha,
	}

	payload, _ := json.Marshal(job)
	err := e.rdb.LPush(ctx, "queue:builds", payload).Err()
	if err != nil {
		log.Error().Err(err).Msg("Failed to queue build job")
		return
	}

	log.Info().Str("org", org).Str("project", project).Str("branch", branch).Msg("Build job queued")
}

// fireWebhooks tells the platform API to deliver outgoing webhooks.
func (e *Executor) fireWebhooks(ctx context.Context, org, project, branch string, update RefUpdate) {
	_, err := e.callPlatformAPI(ctx, "POST", "/internal/git/webhook", map[string]interface{}{
		"org":     org,
		"project": project,
		"event":   "push",
		"branch":  branch,
		"old_sha": update.OldSHA,
		"new_sha": update.NewSHA,
	})
	if err != nil {
		log.Error().Err(err).Msg("Failed to fire webhooks")
	}
}

// callPlatformAPI makes an HTTP call to the MonkeysLegion platform API.
func (e *Executor) callPlatformAPI(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader *bytes.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(payload)
	}

	url := e.platformAPIURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", "git-service") // TODO: use proper service JWT

	return e.httpClient.Do(req)
}
