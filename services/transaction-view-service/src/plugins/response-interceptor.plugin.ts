import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ApiResponse } from "@transaction-system/shared";

async function responseInterceptorPlugin(fastify: FastifyInstance) {
  fastify.addHook(
    "onSend",
    async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
      // Skip interceptor for non-JSON responses or if already formatted
      const contentType = reply.getHeader("content-type");
      if (
        !contentType ||
        typeof contentType !== "string" ||
        !contentType.includes("application/json")
      ) {
        return payload;
      }

      // Skip if payload is already an error response (handled by error handler)
      const parsedPayload =
        typeof payload === "string" ? JSON.parse(payload) : payload;
      if (parsedPayload && parsedPayload.success === false) {
        return payload;
      }

      // Skip for Swagger/health check endpoints
      if (
        request.url.startsWith("/documentation") ||
        request.url === "/health"
      ) {
        return payload;
      }

      // Wrap successful responses in standard format
      const response: ApiResponse = {
        success: true,
        data: parsedPayload,
        timestamp: new Date().toISOString(),
        path: request.url,
      };

      return JSON.stringify(response);
    }
  );
}

export default fp(responseInterceptorPlugin, {
  name: "response-interceptor",
});
