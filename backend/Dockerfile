FROM node:20-alpine AS builder
ENV PUPPETEER_SKIP_DOWNLOAD=true
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache chromium python3 make g++

# Install node dependencies  
COPY package*.json ./
RUN npm install

# Copy config files
COPY tsconfig*.json nest-cli.json ./

# Copy source code
COPY src ./src

# Build
RUN npm run build

# ==================== PRODUCTION STAGE ====================
FROM node:20-alpine AS runner
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV NODE_ENV=production

# Git-Commit-SHA wird bei GitHub-Actions-Build injiziert (fuer Update-Check)
ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION}

WORKDIR /app

# Install runtime dependencies + docker CLI fuer automatisches Update
RUN apk add --no-cache chromium nss freetype ttf-freefont curl docker-cli docker-compose

# Copy dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built application
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 && \
    chown -R nestjs:nodejs /app

# Update-Funktion: Backend laeuft als root damit docker-socket zugaenglich ist
# (nur fuer in-app Update noetig, akzeptabel fuer self-hosted NAS-Betrieb)
USER root

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "dist/main.js"]

