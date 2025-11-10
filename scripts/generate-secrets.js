#!/usr/bin/env node

/**
 * Generate secure random secrets for environment variables
 * Usage: node scripts/generate-secrets.js
 */

const crypto = require('crypto');
const { createLogger } = require('./logger');

/**
 * Generate a cryptographically secure random string
 * @param {number} length - Length of the string in bytes (will be hex encoded, so output is 2x)
 * @returns {string} - Hex encoded random string
 */
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a base64 encoded secret (more compact)
 * @param {number} length - Length of the string in bytes
 * @returns {string} - Base64 encoded random string
 */
function generateSecretBase64(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

// Main execution
function main() {
  const logger = createLogger({ name: 'generate-secrets' });

  logger.info('='.repeat(80));
  logger.info('SECURE SECRETS GENERATOR');
  logger.info('='.repeat(80));
  logger.info('');
  logger.info('Generated secure random secrets for your .env files:');
  logger.info('');

  // Generate secrets
  const jwtSecret = generateSecret(64);
  const jwtSecretBase64 = generateSecretBase64(48);
  const dbPassword = generateSecret(16);
  const apiKey = generateSecret(32);

  // Output secrets in a format ready to copy to .env
  logger.info('# JWT Secret (64 bytes, hex encoded)');
  logger.info(`JWT_SECRET=${jwtSecret}`);
  logger.info('');

  logger.info('# Alternative JWT Secret (base64 encoded, more compact)');
  logger.info(`# JWT_SECRET=${jwtSecretBase64}`);
  logger.info('');

  logger.info('# Database Password (if needed)');
  logger.info(`DB_PASSWORD=${dbPassword}`);
  logger.info('');

  logger.info('# API Key (if needed)');
  logger.info(`API_KEY=${apiKey}`);
  logger.info('');

  logger.info('='.repeat(80));
  logger.warn('IMPORTANT SECURITY NOTES:');
  logger.info('='.repeat(80));
  logger.warn('1. Copy these secrets to your .env files');
  logger.warn('2. NEVER commit .env files to version control');
  logger.warn('3. Use different secrets for each environment (dev, staging, prod)');
  logger.warn('4. Rotate secrets regularly in production');
  logger.warn('5. Store production secrets in a secure vault (AWS Secrets Manager, etc.)');
  logger.info('='.repeat(80));
}

// Run the script
try {
  main();
} catch (error) {
  const logger = createLogger({ name: 'generate-secrets' });
  logger.error({ err: error }, 'Failed to generate secrets');
  process.exit(1);
}

