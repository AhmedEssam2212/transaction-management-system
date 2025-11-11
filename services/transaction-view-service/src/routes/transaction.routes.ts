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
        description: `Create a new transaction with distributed audit logging

**Success Response Example (201):**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 100.5,
    "currency": "USD",
    "status": "PENDING",
    "description": "Payment for services",
    "metadata": { "orderId": "ORD-12345", "customerId": "CUST-67890" },
    "createdAt": "2025-11-11T12:00:00.000Z",
    "updatedAt": "2025-11-11T12:00:00.000Z"
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/transactions"
}
\`\`\`

**Error Response Example (400 - Validation Error):**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "amount", "message": "Amount must be greater than 0" }
    ]
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/transactions"
}
\`\`\`

**Error Response Example (401 - Unauthorized):**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/transactions"
}
\`\`\`

**Error Response Example (500 - Server Error):**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Audit log creation failed or timed out"
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/transactions"
}
\`\`\``,
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["amount", "currency"],
          properties: {
            amount: {
              type: "number",
              minimum: 0.01,
              description: "Transaction amount (must be positive)",
              example: 100.5,
            },
            currency: {
              type: "string",
              enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"],
              description: "Currency code",
              example: "USD",
            },
            description: {
              type: "string",
              description: "Optional transaction description",
              example: "Payment for services",
            },
            metadata: {
              type: "object",
              description: "Optional metadata as key-value pairs",
              example: { orderId: "ORD-12345", customerId: "CUST-67890" },
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
        description: `List all transactions with pagination, filtering, and sorting

**Success Response Example (200):**
\`\`\`json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "amount": 100.5,
        "currency": "USD",
        "status": "COMPLETED",
        "description": "Payment for services",
        "metadata": { "orderId": "ORD-12345" },
        "createdAt": "2025-11-11T12:00:00.000Z",
        "updatedAt": "2025-11-11T12:05:00.000Z"
      },
      {
        "id": "8d0f7780-8536-51ef-b055-f18fd2f91bf8",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "amount": 250.0,
        "currency": "EUR",
        "status": "PENDING",
        "description": "Another transaction",
        "createdAt": "2025-11-11T11:00:00.000Z",
        "updatedAt": "2025-11-11T11:00:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/transactions"
}
\`\`\``,
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: {
              type: "string",
              description: "Page number",
              example: "1",
            },
            limit: {
              type: "string",
              description: "Items per page (max 100)",
              example: "10",
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
              description: "Filter by transaction status",
              example: "COMPLETED",
            },
            currency: {
              type: "string",
              enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"],
              description: "Filter by currency",
              example: "USD",
            },
            minAmount: {
              type: "string",
              description: "Minimum transaction amount",
              example: "10",
            },
            maxAmount: {
              type: "string",
              description: "Maximum transaction amount",
              example: "1000",
            },
            startDate: {
              type: "string",
              format: "date-time",
              description: "Start date for date range filter (ISO 8601)",
              example: "2025-11-01T00:00:00.000Z",
            },
            endDate: {
              type: "string",
              format: "date-time",
              description: "End date for date range filter (ISO 8601)",
              example: "2025-11-30T23:59:59.999Z",
            },
            sortBy: {
              type: "string",
              enum: ["createdAt", "updatedAt", "amount"],
              default: "createdAt",
              description: "Field to sort by",
              example: "createdAt",
            },
            sortOrder: {
              type: "string",
              enum: ["ASC", "DESC"],
              default: "DESC",
              description: "Sort order",
              example: "DESC",
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
            id: {
              type: "string",
              format: "uuid",
              description: "Transaction ID",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
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
        description: `Update a transaction (at least one field required). Creates audit log with before/after state.

**Success Response Example (200):**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 150.75,
    "currency": "USD",
    "status": "COMPLETED",
    "description": "Updated payment description",
    "metadata": { "updatedBy": "admin" },
    "createdAt": "2025-11-11T12:00:00.000Z",
    "updatedAt": "2025-11-11T12:10:00.000Z"
  },
  "timestamp": "2025-11-11T12:10:00.000Z",
  "path": "/api/transactions/7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
\`\`\`

**Error Response Example (404 - Not Found):**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Transaction not found"
  },
  "timestamp": "2025-11-11T12:10:00.000Z",
  "path": "/api/transactions/7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
\`\`\``,
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Transaction ID",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
        body: {
          type: "object",
          properties: {
            amount: {
              type: "number",
              minimum: 0.01,
              description: "New transaction amount",
              example: 150.75,
            },
            currency: {
              type: "string",
              enum: ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF", "CNY"],
              description: "New currency",
              example: "EUR",
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
              description: "New transaction status",
              example: "COMPLETED",
            },
            description: {
              type: "string",
              description: "New description",
              example: "Updated payment description",
            },
            metadata: {
              type: "object",
              description: "New metadata",
              example: { updatedBy: "admin" },
            },
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
        description: `Delete a transaction (soft delete). Creates audit log for deletion.

**Success Response (204 - No Content):**
No response body. Status code 204 indicates successful deletion.

**Error Response Example (404 - Not Found):**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Transaction not found"
  },
  "timestamp": "2025-11-11T12:15:00.000Z",
  "path": "/api/transactions/7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
\`\`\``,
        tags: ["Transactions"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Transaction ID to delete",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
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
