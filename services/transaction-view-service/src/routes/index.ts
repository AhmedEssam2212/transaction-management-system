import { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.routes";
import { transactionRoutes } from "./transaction.routes";

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({
    status: "ok",
    service: "transaction-view-service",
  }));

  fastify.register(authRoutes, { prefix: "/api/auth" });
  fastify.register(transactionRoutes, { prefix: "/api/transactions" });
}
