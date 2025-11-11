import dotenv from "dotenv";

dotenv.config();


function validateConfig() {
  const errors: string[] = [];

  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) {
      errors.push("DATABASE_URL is required in production");
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration validation failed:\n${errors.map(e => `  - ${e}`).join("\n")}`
    );
  }
}

export const envConfig = {
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:postgres@localhost:5433/audit_log_db?sslmode=disable&connect_timeout=10",
  },

  nats: {
    url: process.env.NATS_URL || "nats://localhost:4222",
    clusterId: process.env.NATS_CLUSTER_ID || "transaction-cluster",
  },

  service: {
    name: process.env.SERVICE_NAME || "audit-log-service",
  },

  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(",")
      : ["http://localhost:3000", "http://localhost:3001"],
  },
};

validateConfig();
