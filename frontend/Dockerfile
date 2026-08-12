FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy config files
COPY tsconfig*.json vite.config.ts index.html ./

# Copy source files
COPY public ./public
COPY src ./src

# Build with optimizations
RUN npm run build

# Production stage with nginx
FROM nginx:1.25-alpine

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Set correct permissions
RUN chmod -R 755 /usr/share/nginx/html && \
    find /usr/share/nginx/html -type f -exec chmod 644 {} \; && \
    find /usr/share/nginx/html -type d -exec chmod 755 {} \;

# Health check
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
    CMD wget --spider --quiet http://localhost/ || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


