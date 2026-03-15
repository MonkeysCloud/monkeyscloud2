# =============================================================================
# MonkeysCloud Git Server — Go + go-git
# =============================================================================
# Multi-stage build for minimal production image
# =============================================================================

# --- Build stage ---
FROM golang:1.25-alpine AS builder

RUN apk add --no-cache git

WORKDIR /build

# Copy go.mod/sum first for better layer caching
COPY git-server/go.mod git-server/go.sum ./
RUN go mod download

# Copy source (includes pre-generated proto stubs)
COPY git-server/ .

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /git-server ./cmd/server

# --- Runtime stage ---
FROM alpine:3.20

RUN apk add --no-cache \
    git \
    openssh-client \
    ca-certificates \
    tzdata \
    docker-cli

# Create non-root user
RUN adduser -D -h /app gitserver

# Copy binary from builder
COPY --from=builder /git-server /usr/local/bin/git-server

# Create repos directory
RUN mkdir -p /var/lib/git && chown gitserver:gitserver /var/lib/git

# Git config
RUN git config --system http.receivepack true \
    && git config --system http.uploadpack true \
    && git config --system init.defaultBranch main \
    && git config --system safe.directory '*'
WORKDIR /app

# Expose HTTP + gRPC ports
EXPOSE 3001 50051

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["git-server"]
