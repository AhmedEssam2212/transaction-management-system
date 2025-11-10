#!/bin/sh
set -e

echo "Starting Audit Log Service..."
echo "Working directory: $(pwd)"
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment variables:"
echo "  DATABASE_URL: $DATABASE_URL"
echo "  NATS_URL: $NATS_URL"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"

cd services/audit-log-service

echo "Migrations will be handled by the application on startup..."

echo "Starting service..."
echo "Executing: node dist/index.js"
exec node dist/index.js

