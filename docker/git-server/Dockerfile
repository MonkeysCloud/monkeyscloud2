# =============================================================================
# MonkeysCloud Git Server — Go + go-git
# =============================================================================
# Multi-stage build for minimal production image
# =============================================================================

# --- Build stage ---
FROM golang:1.23-alpine AS builder

RUN apk add --no-cache git protobuf protobuf-dev

# Install protoc Go plugins
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@latest \
    && go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest

WORKDIR /build

# Copy go.mod first for better layer caching
COPY git-server/go.mod ./
RUN go mod download 2>/dev/null || true

# Copy source
COPY git-server/ .

# Generate protobuf Go stubs
RUN protoc \
    --go_out=. --go_opt=paths=source_relative \
    --go-grpc_out=. --go-grpc_opt=paths=source_relative \
    proto/git.proto

# Resolve all deps (generates go.sum)
RUN go mod tidy

# Build binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /git-server ./cmd/server

# --- Runtime stage ---
FROM alpine:3.20

RUN apk add --no-cache \
    git \
    openssh-client \
    ca-certificates \
    tzdata

# Create non-root user
RUN adduser -D -h /app gitserver

# Copy binary from builder
COPY --from=builder /git-server /usr/local/bin/git-server

# Create repos directory
RUN mkdir -p /var/lib/git && chown gitserver:gitserver /var/lib/git

# Git config
RUN git config --system http.receivepack true \
    && git config --system http.uploadpack true \
    && git config --system init.defaultBranch main

USER gitserver
WORKDIR /app

# Expose HTTP + gRPC ports
EXPOSE 3001 50051

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["git-server"]
