import { DataSource } from "typeorm";
import { envConfig } from "./env.config";
import { AuditLog } from "../entities/audit-log.entity";

const migrationPath = envConfig.nodeEnv === "production"
  ? "dist/migrations/*.js"
  : "src/migrations/*.ts";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: envConfig.database.url,
  synchronize: false,
  logging: envConfig.nodeEnv === "development",
  entities: [AuditLog],
  migrations: [migrationPath],
  subscribers: [],
  extra: {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  },
});
