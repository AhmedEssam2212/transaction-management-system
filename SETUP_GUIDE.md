# Setup Guide

This guide will walk you through setting up the Transaction Management System from scratch.

## Quick Start (Docker - Recommended)

The fastest way to get started is using Docker Compose:

```bash
# 1. Clone the repository
git clone <repository-url>
cd transaction-management-system

# 2. Start all services
docker-compose up --build

# 3. Wait for services to be ready (about 30-60 seconds)
# You'll see messages like "Transaction View Service is running!"

# 4. Access the services
# - Transaction API: http://localhost:3000/documentation
# - Audit Log API: http://localhost:3001/documentation
```

That's it! The system is now running with:
- ✅ Both microservices
- ✅ PostgreSQL databases (with migrations applied)
- ✅ NATS JetStream
- ✅ Sample test user created

### Default Test User Credentials

```
Username: testuser
Password: password123
```

## Detailed Local Setup

If you want to run services individually for development:

### Step 1: Install Prerequisites

1. **Node.js 20+**
   ```bash
   node --version  # Should be v20.x.x or higher
   ```

2. **Docker** (for databases and NATS)
   ```bash
   docker --version
   ```

### Step 2: Install Dependencies

```bash
# Install all dependencies
npm install

# Build shared package
npm run build --workspace=@transaction-system/shared
```

### Step 3: Start Infrastructure

```bash
# Start PostgreSQL for Transaction Service
docker run -d \
  --name transaction-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=transaction_db \
  -p 5432:5432 \
  postgres:16-alpine

# Start PostgreSQL for Audit Service
docker run -d \
  --name audit-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=audit_log_db \
  -p 5433:5432 \
  postgres:16-alpine

# Start NATS with JetStream
docker run -d \
  --name nats-server \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:2.10-alpine \
  -js -m 8222
```

### Step 4: Configure Environment

```bash
# Transaction View Service
cp services/transaction-view-service/.env.example services/transaction-view-service/.env

# Audit Log Service
cp services/audit-log-service/.env.example services/audit-log-service/.env
```

### Step 5: Run Migrations

```bash
# Transaction View Service
cd services/transaction-view-service
npm run migration:run
cd ../..

# Audit Log Service
cd services/audit-log-service
npm run migration:run
cd ../..
```

### Step 6: Seed Test Data

```bash
cd services/transaction-view-service
npm run seed
cd ../..
```

### Step 7: Start Services

Open two terminal windows:

**Terminal 1 - Transaction View Service:**
```bash
cd services/transaction-view-service
npm run dev
```

**Terminal 2 - Audit Log Service:**
```bash
cd services/audit-log-service
npm run dev
```

## Testing the Setup

### 1. Health Checks

```bash
# Transaction Service
curl http://localhost:3000/health

# Audit Service
curl http://localhost:3001/health

# NATS Monitoring
curl http://localhost:8222/varz
```

### 2. Login and Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

Save the `accessToken` from the response.

### 3. Create a Transaction

```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{
    "amount": 100.50,
    "currency": "USD",
    "description": "Test transaction"
  }'
```

### 4. List Transactions

```bash
curl -X GET http://localhost:3000/api/transactions \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 5. Check Audit Logs

```bash
curl -X GET "http://localhost:3001/api/audit-logs?entityType=Transaction&action=CREATE"
```

## Running Tests

### E2E Tests

```bash
# Make sure infrastructure is running
docker-compose up -d transaction-db audit-db nats

# Run E2E tests
cd services/transaction-view-service
npm run test:e2e
```

### Unit Tests

```bash
npm test
```

## Troubleshooting

### Issue: Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Issue: Database Connection Failed

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check logs
docker logs transaction-db
docker logs audit-db

# Restart containers
docker restart transaction-db audit-db
```

### Issue: NATS Connection Failed

```bash
# Check if NATS is running
docker ps | grep nats

# Check NATS logs
docker logs nats-server

# Restart NATS
docker restart nats-server
```

### Issue: Migration Failed

```bash
# Drop and recreate database
docker exec -it transaction-db psql -U postgres -c "DROP DATABASE transaction_db;"
docker exec -it transaction-db psql -U postgres -c "CREATE DATABASE transaction_db;"

# Run migrations again
cd services/transaction-view-service
npm run migration:run
```

### Issue: TypeScript Build Errors

```bash
# Clean build artifacts
rm -rf dist node_modules package-lock.json

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

## Development Workflow

### Making Changes to Shared Package

```bash
# 1. Make changes in packages/shared/src
# 2. Rebuild shared package
npm run build --workspace=@transaction-system/shared

# 3. Restart services (they will pick up changes)
```

### Adding a New Migration

```bash
# Transaction Service
cd services/transaction-view-service
npm run migration:generate -- src/migrations/YourMigrationName

# Audit Service
cd services/audit-log-service
npm run migration:generate -- src/migrations/YourMigrationName
```

### Debugging

Both services use `pino-pretty` for readable logs in development:

```bash
# Set log level
export LOG_LEVEL=debug

# Run service
npm run dev
```

## Production Deployment

### Environment Variables

Set these in production:

```bash
# Transaction View Service
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DB_HOST=<production-db-host>
DB_PASSWORD=<strong-password>
NATS_URL=nats://<nats-cluster-url>

# Audit Log Service
NODE_ENV=production
DB_HOST=<production-db-host>
DB_PASSWORD=<strong-password>
NATS_URL=nats://<nats-cluster-url>
```

### Build for Production

```bash
# Build all services
npm run build

# Or build individually
npm run build --workspace=@transaction-system/transaction-view-service
npm run build --workspace=@transaction-system/audit-log-service
```

### Docker Production Build

```bash
# Build images
docker-compose build

# Push to registry
docker tag transaction-view-service:latest your-registry/transaction-view-service:latest
docker push your-registry/transaction-view-service:latest

docker tag audit-log-service:latest your-registry/audit-log-service:latest
docker push your-registry/audit-log-service:latest
```

## Next Steps

1. ✅ Explore the API documentation at `/documentation`
2. ✅ Run the E2E tests to understand the system behavior
3. ✅ Check the audit logs to see distributed transactions in action
4. ✅ Try creating, updating, and deleting transactions
5. ✅ Monitor NATS at http://localhost:8222

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the main README.md
3. Check service logs for error messages
4. Verify all infrastructure services are running

