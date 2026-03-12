# GSD Server - Node.js API with Socket.IO
FROM node:20-alpine AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build the server
WORKDIR /app/apps/server
RUN pnpm build

# Production image
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy built artifacts
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages ./packages
COPY --from=base /app/apps/server/dist ./apps/server/dist
COPY --from=base /app/apps/server/package.json ./apps/server/package.json
COPY --from=base /app/apps/server/node_modules ./apps/server/node_modules

WORKDIR /app/apps/server

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health/summary || exit 1

# Start server
CMD ["node", "dist/index.js"]
