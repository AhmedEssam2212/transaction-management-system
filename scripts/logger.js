/**
 * Shared logger utility for scripts
 * Uses Pino for structured logging
 */

const pino = require('pino');

/**
 * Create a logger instance for scripts
 * @param {Object} options - Logger options
 * @param {string} options.name - Logger name (e.g., 'generate-secrets')
 * @param {string} options.level - Log level (default: 'info')
 * @returns {pino.Logger} Pino logger instance
 */
function createLogger(options = {}) {
  const { name = 'script', level = 'info' } = options;

  return pino({
    name,
    level,
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        customColors: 'info:blue,warn:yellow,error:red',
      },
    },
  });
}

module.exports = { createLogger };

