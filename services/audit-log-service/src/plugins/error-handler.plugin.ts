import {
  FastifyInstance,
  FastifyError,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";
import { QueryFailedError, EntityNotFoundError } from "typeorm";
import { ApiResponse, ERROR_CODES } from "@transaction-system/shared";

async function errorHandlerPlugin(fastify: FastifyInstance) {
  fastify.setErrorHandler(
    async (
      error: FastifyError | Error,
      request: FastifyRequest,
      reply: FastifyReply
    ) => {
      const timestamp = new Date().toISOString();
      const path = request.url;

      // Handle Zod validation errors
      if (error instanceof ZodError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ERROR_CODES.VALIDATION_ERROR,
            message: "Validation failed",
            details: error.errors.map((err) => ({
              path: err.path.join("."),
              message: err.message,
            })),
          },
          timestamp,
          path,
        };

        return reply.status(400).send(response);
      }

      // Handle TypeORM QueryFailedError
      if (error instanceof QueryFailedError) {
        const dbError = error as any;
        let message = "Database query failed";
        let errorCode: string = ERROR_CODES.DATABASE_ERROR;
        let statusCode = 500;

        if (dbError.code === "23505") {
          message = "Resource already exists";
          errorCode = ERROR_CODES.ALREADY_EXISTS;
          statusCode = 409;
        } else if (dbError.code === "23503") {
          message = "Referenced resource not found";
          errorCode = ERROR_CODES.CONSTRAINT_VIOLATION;
          statusCode = 400;
        }

        const response: ApiResponse = {
          success: false,
          error: {
            code: errorCode,
            message,
          },
          timestamp,
          path,
        };

        return reply.status(statusCode).send(response);
      }

      // Handle TypeORM EntityNotFoundError
      if (error instanceof EntityNotFoundError) {
        const response: ApiResponse = {
          success: false,
          error: {
            code: ERROR_CODES.NOT_FOUND,
            message: "Resource not found",
          },
          timestamp,
          path,
        };

        return reply.status(404).send(response);
      }

      // Log unexpected errors
      fastify.log.error(
        {
          error: {
            message: error.message,
            stack: error.stack,
            name: error.name,
          },
          request: {
            method: request.method,
            url: request.url,
          },
        },
        "Unexpected error occurred"
      );

      // Handle all other errors
      const response: ApiResponse = {
        success: false,
        error: {
          code: ERROR_CODES.INTERNAL_SERVER_ERROR,
          message: "An unexpected error occurred",
          stack:
            process.env.NODE_ENV === "development" ? error.stack : undefined,
        },
        timestamp,
        path,
      };

      return reply.status(500).send(response);
    }
  );
}

export default fp(errorHandlerPlugin, {
  name: "error-handler",
});
