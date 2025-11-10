import { FastifyInstance } from "fastify";
import { auditLogRoutes } from "./audit-log.routes";

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({
    status: "ok",
    service: "audit-log-service",
  }));

  fastify.register(auditLogRoutes, { prefix: "/api/audit-logs" });
}
