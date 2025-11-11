import dotenv from "dotenv";

dotenv.config();

/**
 * Validate required environment variables
 */
function validateConfig() {
  const errors: string[] = [];

  // JWT_SECRET is always required (from .env file)
  if (!process.env.JWT_SECRET) {
    errors.push(
      "JWT_SECRET is required. Make sure .env file exists with JWT_SECRET defined"
    );
  }

  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    errors.push("JWT_SECRET must be at least 32 characters long");
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors
        .map((e) => `  - ${e}`)
        .join("\n")}`
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
    secret: process.env.JWT_SECRET!,
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
