import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ApiResponse } from "@transaction-system/shared";

async function responseInterceptorPlugin(fastify: FastifyInstance) {
  fastify.addHook(
    "onSend",
    async (request: FastifyRequest, reply: FastifyReply, payload: any) => {
      const contentType = reply.getHeader("content-type");
      if (
        !contentType ||
        typeof contentType !== "string" ||
        !contentType.includes("application/json")
      ) {
        return payload;
      }

      const parsedPayload =
        typeof payload === "string" ? JSON.parse(payload) : payload;
      if (parsedPayload && parsedPayload.success === false) {
        return payload;
      }

      if (
        request.url.startsWith("/documentation") ||
        request.url === "/health"
      ) {
        return payload;
      }

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
