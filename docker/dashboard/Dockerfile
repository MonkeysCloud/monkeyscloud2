# =============================================================================
# MonkeysCloud Dashboard — Next.js + Tailwind CSS
# =============================================================================
FROM node:22-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat curl

WORKDIR /app

# Copy package files first (better layer caching)
COPY dashboard/package.json dashboard/package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy application source
COPY dashboard/ .

# Expose Next.js dev port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

# Default: dev mode with hot reload
CMD ["npm", "run", "dev"]
