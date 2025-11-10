# Database URL Migration Guide

This document describes the changes made to migrate from individual database connection parameters to using `DATABASE_URL` for both microservices.

> 📖 **See also:** [CONFIGURATION_GUIDE.md](./CONFIGURATION_GUIDE.md) for comprehensive configuration and security best practices.

## Overview

Both microservices now use `DATABASE_URL` as the primary method for database configuration. The configuration includes:

- ✅ **Secure by default**: No hardcoded secrets
- ✅ **Validated**: Automatic validation in production
- ✅ **Developer-friendly**: Auto-generated secrets for local development
- ✅ **Production-ready**: Enforces secure configuration in production

## Changes Made

### 1. Transaction View Service

#### Configuration Files Updated:
- `services/transaction-view-service/src/config/env.config.ts`
  - Added `url` property to database config
  - **Removed hardcoded JWT secret** - now auto-generated for dev, required for production
  - **Added configuration validation** - validates required vars in production
  - **Added security checks** - ensures JWT_SECRET is at least 32 characters
  - Default DATABASE_URL: `postgresql://postgres:postgres@localhost:5432/transaction_db?sslmode=disable&connect_timeout=10`

- `services/transaction-view-service/src/config/data-source.ts`
  - Changed from individual connection parameters to `url` property
  - Simplified configuration using single connection string

#### Environment Files:
- `services/transaction-view-service/.env` (created)
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transaction_db?sslmode=disable&connect_timeout=10"
  ```

- `services/transaction-view-service/.env.example` (updated)
  - Added `DATABASE_URL` as recommended configuration
  - Commented out legacy individual parameters

### 2. Audit Log Service

#### Configuration Files Updated:
- `services/audit-log-service/src/config/env.config.ts`
  - Added `url` property to database config
  - **Added configuration validation** - validates required vars in production
  - Default DATABASE_URL: `postgresql://postgres:postgres@localhost:5433/audit_log_db?sslmode=disable&connect_timeout=10`

- `services/audit-log-service/src/config/data-source.ts`
  - Changed from individual connection parameters to `url` property
  - Simplified configuration using single connection string

#### Environment Files:
- `services/audit-log-service/.env` (created)
  ```
  DATABASE_URL="postgresql://postgres:postgres@localhost:5433/audit_log_db?sslmode=disable&connect_timeout=10"
  ```

- `services/audit-log-service/.env.example` (updated)
  - Added `DATABASE_URL` as recommended configuration
  - Commented out legacy individual parameters

### 3. Docker Compose

#### `docker-compose.yml` Updated:
- **Transaction View Service**:
  - Replaced individual DB environment variables with `DATABASE_URL`
  - URL: `postgresql://postgres:postgres@transaction-db:5432/transaction_db?sslmode=disable&connect_timeout=10`

- **Audit Log Service**:
  - Replaced individual DB environment variables with `DATABASE_URL`
  - URL: `postgresql://postgres:postgres@audit-db:5432/audit_log_db?sslmode=disable&connect_timeout=10`

### 4. Security Improvements

#### Secret Generation Script
- **Created**: `scripts/generate-secrets.js`
  - Generates cryptographically secure random secrets using Node.js crypto module
  - Provides both hex and base64 encoded options
  - Includes security best practices guidance

#### Configuration Validation
- **Production validation**: Automatically validates required environment variables
- **Security checks**: Ensures secrets meet minimum length requirements
- **Clear error messages**: Guides developers to fix configuration issues

#### Development Experience
- **Auto-generated secrets**: JWT secrets auto-generated in development (never in production)
- **No hardcoded values**: All sensitive values must be provided via environment variables in production
- **Comprehensive documentation**: Clear instructions in .env.example files

## Database URL Format

The `DATABASE_URL` follows the PostgreSQL connection string format:

```
postgresql://[user]:[password]@[host]:[port]/[database]?[parameters]
```

### Parameters Used:
- `sslmode=disable` - Disables SSL for local development
- `connect_timeout=10` - Sets connection timeout to 10 seconds

### Examples:

**Transaction View Service (Local Development):**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transaction_db?sslmode=disable&connect_timeout=10"
```

**Audit Log Service (Local Development):**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/audit_log_db?sslmode=disable&connect_timeout=10"
```

**Production Example (with SSL):**
```
DATABASE_URL="postgresql://txg:txg@prod-db-host:5432/transaction_db?sslmode=require&connect_timeout=10"
```

## Migration Steps

### For Local Development:

1. **The .env files are already created** with sensible defaults:
   ```bash
   # Files are in place:
   # - services/transaction-view-service/.env
   # - services/audit-log-service/.env
   ```

2. **(Optional) Generate secure JWT secret** for development:
   ```bash
   # Generate secrets
   node scripts/generate-secrets.js

   # Copy the JWT_SECRET to services/transaction-view-service/.env
   # (or leave commented out to use auto-generated dev secret)
   ```

3. **Verify the DATABASE_URL** in each .env file matches your local setup

4. **Restart the services**:
   ```bash
   # Terminal 1 - Transaction View Service
   cd services/transaction-view-service
   npm run dev

   # Terminal 2 - Audit Log Service
   cd services/audit-log-service
   npm run dev
   ```

### For Docker Deployment:

1. **Rebuild and restart containers**:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

### For Production:

1. **Generate secure secrets**:
   ```bash
   node scripts/generate-secrets.js
   ```

2. **Set required environment variables**:
   ```bash
   # Transaction View Service
   export DATABASE_URL="postgresql://user:password@prod-host:5432/transaction_db?sslmode=require&connect_timeout=10"
   export JWT_SECRET="<secure-secret-from-step-1>"
   export NODE_ENV="production"

   # Audit Log Service
   export DATABASE_URL="postgresql://user:password@prod-host:5432/audit_log_db?sslmode=require&connect_timeout=10"
   export NODE_ENV="production"
   ```

3. **Store secrets securely** (AWS Secrets Manager, HashiCorp Vault, etc.):
   ```bash
   # Example: AWS Secrets Manager
   aws secretsmanager create-secret \
     --name prod/transaction-view/jwt-secret \
     --secret-string "<your-generated-secret>"
   ```

4. **Update your deployment configuration** (Kubernetes, ECS, etc.) to use DATABASE_URL and JWT_SECRET

## Backward Compatibility

**Note**: Legacy individual database parameters have been removed in favor of `DATABASE_URL` for simplicity and security.

**Migration from old format:**
```bash
# Old format (no longer supported)
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=transaction_db

# New format (use this)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transaction_db?sslmode=disable&connect_timeout=10"
```

## Benefits

### Configuration Benefits
1. **Simplified Configuration**: Single environment variable instead of five
2. **Industry Standard**: Follows the standard PostgreSQL connection string format
3. **Cloud-Native**: Compatible with most cloud platforms (Heroku, AWS RDS, etc.)
4. **Connection Pooling**: Easier to add connection pool parameters
5. **Flexibility**: Can easily add SSL, timeouts, and other parameters

### Security Benefits
1. **No Hardcoded Secrets**: All sensitive values must be provided via environment variables
2. **Automatic Validation**: Configuration validated on startup in production
3. **Secure Defaults**: Auto-generated secrets for development, required secrets for production
4. **Crypto-based Generation**: Uses Node.js crypto module for secure random generation
5. **Clear Security Guidance**: Comprehensive documentation and error messages

## Testing

To verify the changes work correctly:

1. **Check database connection**:
   ```bash
   # Start services and check logs
   npm run dev
   # Look for "Database connected" message
   ```

2. **Run migrations**:
   ```bash
   cd services/transaction-view-service
   npm run migration:run

   cd services/audit-log-service
   npm run migration:run
   ```

3. **Test API endpoints**:
   ```bash
   # Health check
   curl http://localhost:3000/health
   curl http://localhost:3001/health
   ```

## Troubleshooting

### Connection Refused
- Verify PostgreSQL is running on the specified port
- Check the host and port in DATABASE_URL

### Authentication Failed
- Verify username and password in DATABASE_URL
- Ensure the database user has proper permissions

### Database Does Not Exist
- Create the database manually:
  ```sql
  CREATE DATABASE transaction_db;
  CREATE DATABASE audit_log_db;
  ```

### SSL Issues
- For local development, use `sslmode=disable`
- For production, use `sslmode=require` and ensure SSL certificates are configured

## Notes

- The `.env` files are now created and ready to use
- The `.env.example` files have been updated to show the new format
- Docker Compose has been updated to use DATABASE_URL
- All services maintain backward compatibility with individual parameters

