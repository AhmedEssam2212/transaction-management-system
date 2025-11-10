# Scripts

Utility scripts for the Transaction Management System.

## Logging

All scripts use **Pino** for structured logging with pretty-printing in development. The shared logger utility is available in `scripts/logger.js`.

**Example usage:**
```javascript
const { createLogger } = require('./logger');

const logger = createLogger({ name: 'my-script' });

logger.info('This is an info message');
logger.warn('This is a warning');
logger.error({ err: error }, 'This is an error with context');
```

## Available Scripts

### `generate-secrets.js`

Generates cryptographically secure random secrets for use in environment variables.

**Usage:**
```bash
node scripts/generate-secrets.js
```

**Output:**
```
[11:25:33] INFO (generate-secrets): ================================================================================
[11:25:33] INFO (generate-secrets): SECURE SECRETS GENERATOR
[11:25:33] INFO (generate-secrets): ================================================================================
[11:25:33] INFO (generate-secrets):
[11:25:33] INFO (generate-secrets): Generated secure random secrets for your .env files:
[11:25:33] INFO (generate-secrets):
[11:25:33] INFO (generate-secrets): # JWT Secret (64 bytes, hex encoded)
[11:25:33] INFO (generate-secrets): JWT_SECRET=a1b2c3d4e5f6...
[11:25:33] INFO (generate-secrets):
[11:25:33] WARN (generate-secrets): IMPORTANT SECURITY NOTES:
[11:25:33] WARN (generate-secrets): 1. Copy these secrets to your .env files
[11:25:33] WARN (generate-secrets): 2. NEVER commit .env files to version control
...
```

**Features:**
- ✅ Structured logging with Pino
- ✅ Colored output with timestamps
- ✅ Cryptographically secure random generation
- ✅ Multiple format options (hex, base64)

**When to use:**
- Setting up a new environment (development, staging, production)
- Rotating secrets in production
- Generating secure passwords for databases
- Creating API keys

**Security Notes:**
- Uses Node.js `crypto.randomBytes()` for cryptographically secure random generation
- Generates 64-byte (128 hex characters) secrets by default
- Never reuse secrets across environments
- Store production secrets in a secure vault (AWS Secrets Manager, HashiCorp Vault, etc.)

## Adding New Scripts

When adding new scripts to this directory:

1. **Make them executable** (if shell scripts):
   ```bash
   chmod +x scripts/your-script.sh
   ```

2. **Add a shebang** at the top:
   ```bash
   #!/usr/bin/env node
   # or
   #!/bin/bash
   ```

3. **Document them** in this README

4. **Follow naming conventions**:
   - Use kebab-case: `generate-secrets.js`
   - Be descriptive: `migrate-database.js` not `migrate.js`

5. **Add error handling**:
   ```javascript
   try {
     // Your code
   } catch (error) {
     console.error('Error:', error.message);
     process.exit(1);
   }
   ```

## Best Practices

- ✅ Keep scripts simple and focused on one task
- ✅ Add helpful output messages
- ✅ Include error handling
- ✅ Document usage and examples
- ✅ Make scripts idempotent when possible
- ✅ Use environment variables for configuration
- ❌ Don't hardcode secrets or credentials
- ❌ Don't make destructive operations without confirmation

