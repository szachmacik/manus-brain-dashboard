# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files AND patches (required by pnpm patched dependencies)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install all dependencies (including devDeps for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend (Vite) + backend (esbuild)
RUN pnpm build

# ─── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@9

# Copy package files AND patches (required by pnpm patched dependencies)
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

# Health check — wymagany przez Coolify
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3000}/api/health || exit 1

# Expose port (Coolify zarządza mapowaniem)
EXPOSE 3000

# Start production server
CMD ["node", "dist/index.js"]

