# =============================================================================
# Quantum Vorvex — Multi-stage hardened Dockerfile
# Node.js 20 Alpine — Minimal attack surface, non-root runtime user
#
# Stages:
#   1. deps          — Production server dependencies only (no devDeps)
#   2. build-client  — Build the React/Vite frontend
#   3. runtime       — Final lean image: server + pre-built client static files
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — deps
# Install only production server dependencies.
# Kept separate so devDependencies never leak into the final image.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS deps

# Install build tools required by native npm addons (e.g. bcrypt)
RUN apk add --no-cache python3 make g++

WORKDIR /app/server

# Copy manifests first to exploit Docker layer caching
COPY server/package.json server/package-lock.json ./

# --only=production excludes devDependencies
# --ignore-scripts reduces supply-chain risk from postinstall hooks
RUN npm ci --only=production --ignore-scripts

# -----------------------------------------------------------------------------
# Stage 2 — build-client
# Install all client dependencies (including devDeps) and produce the Vite
# production build. The resulting dist/ directory is copied into the runtime
# stage; the heavy node_modules are discarded.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS build-client

WORKDIR /app/client

# Copy manifests
COPY client/package.json client/package-lock.json ./

# Install all deps (devDeps needed for Vite build)
RUN npm ci --ignore-scripts

# Copy the full client source
COPY client/ ./

# Build the production bundle — outputs to /app/client/dist
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3 — runtime
# Final, minimal image. Runs as a non-root user with the principle of least
# privilege. Only production artefacts are present.
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

# ── OS hardening ──────────────────────────────────────────────────────────────
# Install wget for the Docker HEALTHCHECK; no other extras
RUN apk add --no-cache wget \
    # Remove package cache to keep the layer slim
    && rm -rf /var/cache/apk/*

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# ── Copy production node_modules from deps stage ──────────────────────────────
COPY --from=deps /app/server/node_modules ./node_modules

# ── Copy application source ───────────────────────────────────────────────────
# Only the runtime-required directories; no tests, no dev configs
COPY server/src ./src
COPY server/prisma ./prisma

# ── Copy pre-built client static files ───────────────────────────────────────
# The Express server serves these from client/dist in production
COPY --from=build-client /app/client/dist ./client/dist

# ── Environment ───────────────────────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=5000

# ── Ownership ─────────────────────────────────────────────────────────────────
# Give appuser ownership of the working directory so Prisma can write its
# query engine and the app can create an uploads directory at runtime.
RUN chown -R appuser:appgroup /app

# ── Drop privileges ───────────────────────────────────────────────────────────
USER appuser

# ── Network ───────────────────────────────────────────────────────────────────
EXPOSE 5000

# ── Health check ──────────────────────────────────────────────────────────────
# Interval: check every 30 s
# Timeout:  give the app up to 10 s to respond
# Start:    allow 40 s for cold start (Prisma client init, SQLite open)
# Retries:  3 consecutive failures → container marked unhealthy
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD wget -qO- http://localhost:5000/health || exit 1

# ── Entrypoint ────────────────────────────────────────────────────────────────
CMD ["node", "src/server.js"]
