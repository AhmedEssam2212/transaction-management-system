import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

/**
 * Generate a development-only JWT secret
 * WARNING: This is only for local development. NEVER use in production!
 */
function getDevJwtSecret(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is required in production. " +
        "Generate a secure secret using: node scripts/generate-secrets.js"
    );
  }

  // Generate a consistent dev secret based on a seed (for development only)
  const devSeed = "transaction-view-service-dev-seed";
  return crypto.createHash("sha256").update(devSeed).digest("hex");
}

/**
 * Validate required environment variables
 */
function validateConfig() {
  const errors: string[] = [];

  if (process.env.NODE_ENV === "production") {
    if (!process.env.JWT_SECRET) {
      errors.push("JWT_SECRET is required in production");
    }
    if (!process.env.DATABASE_URL) {
      errors.push("DATABASE_URL is required in production");
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      errors.push("JWT_SECRET must be at least 32 characters long");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors
        .map((e) => `  - ${e}`)
        .join("\n")}\n\n` +
        `Generate secure secrets using: node scripts/generate-secrets.js`
    );
  }
}

export const envConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5432/transaction_db?sslmode=disable&connect_timeout=10",
  },

  jwt: {
    secret: process.env.JWT_SECRET || getDevJwtSecret(),
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
  },

  nats: {
    url: process.env.NATS_URL || "nats://localhost:4222",
    clusterId: process.env.NATS_CLUSTER_ID || "transaction-cluster",
  },

  service: {
    name: process.env.SERVICE_NAME || "transaction-view-service",
  },

  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:3001"],
  },
};

// Validate configuration on module load
validateConfig();
