package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"google.golang.org/grpc"

	gitgrpc "github.com/monkeyscloud/git-server/internal/grpc"
	"github.com/monkeyscloud/git-server/internal/handler"
	"github.com/monkeyscloud/git-server/internal/hooks"
	"github.com/monkeyscloud/git-server/internal/repository"
	pb "github.com/monkeyscloud/git-server/proto"
)

func main() {
	// Load .env (ignore error — may not exist in production)
	_ = godotenv.Load()

	// Logger
	zerolog.TimeFieldFormat = zerolog.TimeFormatUnix
	if os.Getenv("APP_ENV") == "local" {
		log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	}

	// Config
	httpPort := getEnv("GIT_HTTP_PORT", "3001")
	grpcPort := getEnv("GIT_GRPC_PORT", "50051")
	reposPath := getEnv("GIT_REPOS_PATH", "/var/lib/git")
	platformAPIURL := getEnv("PLATFORM_API_URL", "http://api:8000")
	redisAddr := fmt.Sprintf("%s:%s", getEnv("REDIS_HOST", "redis"), getEnv("REDIS_PORT", "6379"))

	// Repository manager (wraps go-git + exec for merges)
	repoMgr := repository.NewManager(reposPath)

	// Hook executor (notifies platform API on push events)
	hookExec := hooks.NewExecutor(platformAPIURL, redisAddr)

	// =========================================================================
	// HTTP Server — Git Smart HTTP Protocol
	// =========================================================================
	r := chi.NewRouter()

	// Middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Recoverer)
	r.Use(chimw.Timeout(600 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
	}))

	// Health check
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprintf(w, `{"status":"ok","service":"monkeyscloud-git","time":"%s"}`, time.Now().Format(time.RFC3339))
	})

	// Git Smart HTTP Protocol routes
	gitHandler := handler.NewGitHTTP(repoMgr, hookExec)

	// /{org}/{project}.git/info/refs         — discovery
	// /{org}/{project}.git/git-upload-pack    — clone/fetch
	// /{org}/{project}.git/git-receive-pack   — push
	r.Route("/{org}/{project}.git", func(r chi.Router) {
		r.Use(gitHandler.AuthMiddleware)
		r.Get("/info/refs", gitHandler.InfoRefs)
		r.Post("/git-upload-pack", gitHandler.UploadPack)
		r.Post("/git-receive-pack", gitHandler.ReceivePack)
	})

	// Repository management REST API (called by platform API)
	repoHandler := handler.NewRepoAPI(repoMgr)
	r.Route("/api/repos", func(r chi.Router) {
		r.Use(handler.InternalAuthMiddleware)
		r.Post("/", repoHandler.Create)             // Init bare repo
		r.Delete("/{org}/{project}", repoHandler.Delete) // Delete repo
		r.Post("/{org}/{project}/fork", repoHandler.Fork) // Fork repo
	})

	// Diff / Merge / Branch REST API (called by platform API)
	codeHandler := handler.NewCodeAPI(repoMgr)
	r.Route("/api/code", func(r chi.Router) {
		r.Use(handler.InternalAuthMiddleware)
		r.Get("/{org}/{project}/diff/{base}...{head}", codeHandler.Diff)
		r.Post("/{org}/{project}/merge", codeHandler.Merge)
		r.Get("/{org}/{project}/branches", codeHandler.ListBranches)
		r.Get("/{org}/{project}/commits", codeHandler.ListCommits)
		r.Get("/{org}/{project}/tree/{ref}/*", codeHandler.FileTree)
		r.Get("/{org}/{project}/blob/{ref}/*", codeHandler.FileContent)
	})

	httpServer := &http.Server{
		Addr:         ":" + httpPort,
		Handler:      r,
		ReadTimeout:  600 * time.Second,
		WriteTimeout: 600 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// =========================================================================
	// gRPC Server — Platform API Communication
	// =========================================================================
	grpcServer := grpc.NewServer()
	gitService := gitgrpc.NewGitService(repoMgr, hookExec)
	pb.RegisterGitServiceServer(grpcServer, gitService)

	// =========================================================================
	// Start Servers
	// =========================================================================
	errChan := make(chan error, 2)

	// Start HTTP
	go func() {
		log.Info().Str("port", httpPort).Msg("Git HTTP server starting")
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errChan <- fmt.Errorf("http server error: %w", err)
		}
	}()

	// Start gRPC
	go func() {
		lis, err := net.Listen("tcp", ":"+grpcPort)
		if err != nil {
			errChan <- fmt.Errorf("grpc listen error: %w", err)
			return
		}
		log.Info().Str("port", grpcPort).Msg("Git gRPC server starting")
		if err := grpcServer.Serve(lis); err != nil {
			errChan <- fmt.Errorf("grpc server error: %w", err)
		}
	}()

	// =========================================================================
	// Graceful Shutdown
	// =========================================================================
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-quit:
		log.Info().Str("signal", sig.String()).Msg("Shutting down...")
	case err := <-errChan:
		log.Fatal().Err(err).Msg("Server error")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	grpcServer.GracefulStop()
	if err := httpServer.Shutdown(ctx); err != nil {
		log.Error().Err(err).Msg("HTTP shutdown error")
	}

	log.Info().Msg("Git server stopped")
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
