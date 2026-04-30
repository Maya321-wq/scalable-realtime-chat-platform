# ─────────────────────────────
# Dependencies stage
# ─────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci


# ─────────────────────────────
# Runtime stage
# ───────────────────────��─────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY src ./src
COPY package*.json ./

# Create keys directory (will be empty if keys don't exist in build context)
RUN mkdir -p /app/keys

# Safely copy keys if they exist, otherwise skip
COPY keys* /app/keys/ || true

EXPOSE 3002

# Health check (safe + simple)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "src/app.js"]