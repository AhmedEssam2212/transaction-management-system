import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { TransactionService } from "../services";
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
  transactionIdSchema,
} from "../validators";
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionQueryDto,
} from "@transaction-system/shared";

export async function transactionRoutes(fastify: FastifyInstance) {
  const transactionService: TransactionService = (fastify as any)
    .transactionService;

  fastify.post<{ Body: CreateTransactionDto }>(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Create a new transaction",
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["amount", "currency"],
          properties: {
            amount: { type: "number", minimum: 0.01 },
            currency: {
              type: "string",
              enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"],
            },
            description: { type: "string" },
            metadata: { type: "object" },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  userId: { type: "string" },
                  amount: { type: "number" },
                  currency: { type: "string" },
                  status: { type: "string" },
                  description: { type: "string" },
                  metadata: { type: "object" },
                  createdAt: { type: "string" },
                  updatedAt: { type: "string" },
                },
              },
              timestamp: { type: "string" },
              path: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateTransactionDto }>,
      reply: FastifyReply
    ) => {
      const validatedData = createTransactionSchema.parse(request.body);
      const userId = (request.user as any).sub;
      const ipAddress = request.ip;
      const userAgent = request.headers["user-agent"];

      const transaction = await transactionService.createTransaction(
        userId,
        validatedData,
        ipAddress,
        userAgent
      );

      reply.code(201);
      return transaction;
    }
  );

  fastify.get<{ Querystring: TransactionQueryDto }>(
    "/",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "List all transactions with pagination and filters",
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
            status: {
              type: "string",
              enum: [
                "PENDING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                "PROCESSING",
              ],
            },
            currency: {
              type: "string",
              enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"],
            },
            minAmount: { type: "number" },
            maxAmount: { type: "number" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            sortBy: {
              type: "string",
              enum: ["createdAt", "updatedAt", "amount"],
              default: "createdAt",
            },
            sortOrder: {
              type: "string",
              enum: ["ASC", "DESC"],
              default: "DESC",
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Querystring: TransactionQueryDto }>,
      reply: FastifyReply
    ) => {
      const validatedQuery = transactionQuerySchema.parse(request.query);
      const userId = (request.user as any).sub;

      const result = await transactionService.listTransactions(
        userId,
        validatedQuery
      );
      return result;
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get a specific transaction by ID",
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = transactionIdSchema.parse(request.params);
      const userId = (request.user as any).sub;

      const transaction = await transactionService.getTransaction(id, userId);
      return transaction;
    }
  );

  fastify.put<{ Params: { id: string }; Body: UpdateTransactionDto }>(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Update a transaction",
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        body: {
          type: "object",
          properties: {
            amount: { type: "number", minimum: 0.01 },
            currency: {
              type: "string",
              enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"],
            },
            status: {
              type: "string",
              enum: [
                "PENDING",
                "COMPLETED",
                "FAILED",
                "CANCELLED",
                "PROCESSING",
              ],
            },
            description: { type: "string" },
            metadata: { type: "object" },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: UpdateTransactionDto;
      }>,
      reply: FastifyReply
    ) => {
      const { id } = transactionIdSchema.parse(request.params);
      const validatedData = updateTransactionSchema.parse(request.body);
      const userId = (request.user as any).sub;
      const ipAddress = request.ip;
      const userAgent = request.headers["user-agent"];

      const transaction = await transactionService.updateTransaction(
        id,
        userId,
        validatedData,
        ipAddress,
        userAgent
      );

      return transaction;
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/:id",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Delete a transaction",
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string", format: "uuid" },
          },
        },
        response: {
          204: {
            type: "null",
            description: "Transaction deleted successfully",
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply
    ) => {
      const { id } = transactionIdSchema.parse(request.params);
      const userId = (request.user as any).sub;
      const ipAddress = request.ip;
      const userAgent = request.headers["user-agent"];

      await transactionService.deleteTransaction(
        id,
        userId,
        ipAddress,
        userAgent
      );

      reply.code(204);
      return;
    }
  );
}
