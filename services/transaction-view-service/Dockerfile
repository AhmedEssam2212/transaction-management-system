# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/transaction-view-service/package*.json ./services/transaction-view-service/

# Install dependencies
RUN npm ci --workspace=@transaction-system/shared --workspace=@transaction-system/transaction-view-service

# Copy source code
COPY packages/shared ./packages/shared
COPY services/transaction-view-service ./services/transaction-view-service

# Build shared package
RUN npm run build --workspace=@transaction-system/shared

# Build service
RUN npm run build --workspace=@transaction-system/transaction-view-service

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY services/transaction-view-service/package*.json ./services/transaction-view-service/

# Install only production dependencies
RUN npm ci --omit=dev --workspace=@transaction-system/shared --workspace=@transaction-system/transaction-view-service

# Copy built files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/services/transaction-view-service/dist ./services/transaction-view-service/dist

# Copy package.json files for runtime
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json

# Copy entrypoint script and ensure Unix line endings
COPY services/transaction-view-service/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh && \
    # Convert line endings from CRLF to LF if needed
    sed -i 's/\r$//' /docker-entrypoint.sh || true

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Run migrations and start service
CMD ["/docker-entrypoint.sh"]

