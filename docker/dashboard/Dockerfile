# =============================================================================
# MonkeysCloud Dashboard — Next.js + Tailwind CSS (Production)
# =============================================================================

# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy package files first (better layer caching)
COPY dashboard/package.json dashboard/package-lock.json* ./

# Install ALL dependencies (including devDependencies for the build)
RUN npm ci

# Copy application source
COPY dashboard/ .

# Set build-time env vars (can be overridden via docker-compose build args)
ARG NEXT_PUBLIC_API_URL=https://api.monkeys.cloud
ARG NEXT_PUBLIC_SOCKET_URL=https://ws.monkeys.cloud
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL

# Build the production bundle
RUN npm run build

# ── Stage 2: Production runtime ────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache libc6-compat curl

WORKDIR /app

ENV NODE_ENV=production

# Copy only what's needed for production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.* ./

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:3000 || exit 1

CMD ["npm", "run", "start"]
