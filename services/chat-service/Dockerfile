# ─────────────────────────────
# Dependencies stage
# ─────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./
RUN npm ci


# ─────────────────────────────
# Runtime stage
# ─────────────────────────────
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY src ./src
COPY package*.json ./

# COPY keys ./keys
# RUN mkdir -p /app/keys

EXPOSE 3002

# Health check (safe + simple)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "require('http').get('http://localhost:3002/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# IMPORTANT: make sure this file exists
CMD ["node", "src/app.js"]