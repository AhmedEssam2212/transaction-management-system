# Configuration Guide

This guide explains the configuration approach used in the Transaction Management System and best practices for managing environment variables and secrets.

## Table of Contents

- [Configuration Approach](#configuration-approach)
- [Environment Variables](#environment-variables)
- [Security Best Practices](#security-best-practices)
- [Generating Secrets](#generating-secrets)
- [Configuration Validation](#configuration-validation)
- [Environment-Specific Configuration](#environment-specific-configuration)

## Configuration Approach

### Why Not a Full ConfigService?

This project uses a **lightweight configuration pattern** instead of a heavy ConfigService class:

```typescript
// services/*/src/config/env.config.ts
export const envConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  database: {
    url: process.env.DATABASE_URL || "default-for-dev"
  },
  // ... more config
};
```

**Benefits of this approach:**

1. ✅ **Simple and Direct**: Easy to understand and maintain
2. ✅ **Type-Safe**: TypeScript provides full type checking
3. ✅ **Centralized**: All config in one place per service
4. ✅ **Validated**: Config validation happens on module load
5. ✅ **Testable**: Easy to mock in tests
6. ✅ **No Dependencies**: No need for heavy DI frameworks

**When to use a full ConfigService:**

- When you need runtime config reloading
- When you need complex config transformations
- When you need config from multiple sources (env, files, remote)
- When using NestJS (which has built-in ConfigModule)

For this Fastify-based microservices project, the lightweight approach is **perfect**.

## Environment Variables

### Transaction View Service

```bash
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:pass@host:port/db?params"

# JWT (REQUIRED in production)
JWT_SECRET=<generate-using-script>
JWT_EXPIRES_IN=24h

# NATS
NATS_URL=nats://localhost:4222
NATS_CLUSTER_ID=transaction-cluster

# Service
SERVICE_NAME=transaction-view-service
```

### Audit Log Service

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL="postgresql://user:pass@host:port/db?params"

# NATS
NATS_URL=nats://localhost:4222
NATS_CLUSTER_ID=transaction-cluster

# Service
SERVICE_NAME=audit-log-service
```

## Security Best Practices

### 🔒 Never Hardcode Secrets

**❌ BAD:**
```typescript
jwt: {
  secret: "my-super-secret-key"  // NEVER do this!
}
```

**✅ GOOD:**
```typescript
jwt: {
  secret: process.env.JWT_SECRET || getDevJwtSecret()
}
```

### 🔒 Validate Production Config

The configuration automatically validates required variables in production:

```typescript
function validateConfig() {
  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is required in production");
    }
    if (process.env.JWT_SECRET.length < 32) {
      throw new Error("JWT_SECRET must be at least 32 characters");
    }
  }
}
```

### 🔒 Use Different Secrets Per Environment

```bash
# Development
JWT_SECRET=dev-secret-auto-generated

# Staging
JWT_SECRET=<unique-staging-secret>

# Production
JWT_SECRET=<unique-production-secret>
```

### 🔒 Never Commit .env Files

The `.gitignore` should include:

```gitignore
# Environment files
.env
.env.local
.env.*.local

# Keep example files
!.env.example
```

## Generating Secrets

### Using the Built-in Script

```bash
# Generate secure random secrets
node scripts/generate-secrets.js
```

**Output:**
```
================================================================================
SECURE SECRETS GENERATOR
================================================================================

Generated secure random secrets for your .env files:

# JWT Secret (64 bytes, hex encoded)
JWT_SECRET=a1b2c3d4e5f6...

# Alternative JWT Secret (base64 encoded, more compact)
# JWT_SECRET=AbCdEfGh...

# Database Password (if needed)
DB_PASSWORD=x1y2z3...

# API Key (if needed)
API_KEY=k1l2m3...
================================================================================
```

### Manual Generation

**Using Node.js:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Using OpenSSL:**
```bash
openssl rand -hex 32
```

**Using PowerShell:**
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Configuration Validation

### Automatic Validation

Configuration is validated when the module loads:

```typescript
// At the end of env.config.ts
validateConfig();  // Throws error if validation fails
```

### Validation Rules

**Development:**
- All variables are optional (sensible defaults provided)
- JWT_SECRET is auto-generated if not provided

**Production:**
- `DATABASE_URL` is required
- `JWT_SECRET` is required
- `JWT_SECRET` must be at least 32 characters

### Error Messages

If validation fails, you'll see a clear error:

```
Configuration validation failed:
  - JWT_SECRET is required in production
  - DATABASE_URL is required in production

Generate secure secrets using: node scripts/generate-secrets.js
```

## Environment-Specific Configuration

### Local Development

```bash
# .env
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/transaction_db?sslmode=disable&connect_timeout=10"
# JWT_SECRET not needed (auto-generated)
```

### Docker Development

```bash
# docker-compose.yml
environment:
  NODE_ENV: development
  DATABASE_URL: "postgresql://postgres:postgres@transaction-db:5432/transaction_db?sslmode=disable&connect_timeout=10"
```

### Production

```bash
# .env.production or environment variables
NODE_ENV=production
DATABASE_URL="postgresql://prod_user:${DB_PASSWORD}@prod-host:5432/transaction_db?sslmode=require&connect_timeout=10"
JWT_SECRET=${JWT_SECRET}  # From secrets manager
```

### Using AWS Secrets Manager (Example)

```typescript
// For production, you might fetch from AWS Secrets Manager
import { SecretsManager } from 'aws-sdk';

async function getSecret(secretName: string): Promise<string> {
  const client = new SecretsManager({ region: 'us-east-1' });
  const data = await client.getSecretValue({ SecretId: secretName }).promise();
  return data.SecretString || '';
}

// Then in env.config.ts
const jwtSecret = process.env.NODE_ENV === 'production'
  ? await getSecret('prod/jwt-secret')
  : process.env.JWT_SECRET || getDevJwtSecret();
```

## Database URL Format

### Basic Format

```
postgresql://[user]:[password]@[host]:[port]/[database]?[parameters]
```

### Common Parameters

```bash
# Disable SSL (local development only)
?sslmode=disable

# Require SSL (production)
?sslmode=require

# Connection timeout
?connect_timeout=10

# Multiple parameters
?sslmode=require&connect_timeout=10&pool_size=20
```

### Examples

**Local Development:**
```
postgresql://postgres:postgres@localhost:5432/mydb?sslmode=disable&connect_timeout=10
```

**Production with SSL:**
```
postgresql://prod_user:secure_pass@prod-db.example.com:5432/mydb?sslmode=require&connect_timeout=10
```

**With Connection Pooling:**
```
postgresql://user:pass@host:5432/db?sslmode=require&pool_size=20&max_lifetime=1800
```

## Best Practices Summary

### ✅ DO

- ✅ Use `DATABASE_URL` for database configuration
- ✅ Generate secure random secrets using crypto
- ✅ Validate configuration in production
- ✅ Use different secrets per environment
- ✅ Store production secrets in a vault (AWS Secrets Manager, etc.)
- ✅ Rotate secrets regularly
- ✅ Use SSL in production (`sslmode=require`)
- ✅ Set appropriate connection timeouts
- ✅ Document all environment variables

### ❌ DON'T

- ❌ Hardcode secrets in code
- ❌ Commit .env files to git
- ❌ Use the same secrets across environments
- ❌ Use weak or predictable secrets
- ❌ Disable SSL in production
- ❌ Share secrets via email or chat
- ❌ Use default passwords in production

## Troubleshooting

### "JWT_SECRET is required in production"

**Solution:** Set the JWT_SECRET environment variable:
```bash
export JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

### "DATABASE_URL is required in production"

**Solution:** Set the DATABASE_URL environment variable:
```bash
export DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```

### Auto-generated JWT secret changes on restart

**Solution:** This only happens in development. Set JWT_SECRET in your .env file:
```bash
JWT_SECRET=your-dev-secret-here
```

### Connection refused to database

**Solution:** Check your DATABASE_URL format and ensure the database is running:
```bash
# Test connection
psql "postgresql://user:pass@host:5432/db"
```

## Additional Resources

- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [12-Factor App Config](https://12factor.net/config)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)

