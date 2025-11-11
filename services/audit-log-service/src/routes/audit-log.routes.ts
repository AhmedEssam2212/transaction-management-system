import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuditLogService } from "../services";
import {
  CreateAuditLogDto,
  AuditLogQueryDto,
  AuditAction,
  AuditStatus,
  SortOrder,
} from "@transaction-system/shared";
import { z } from "zod";

const auditLogQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  userId: z.string().optional(),
  status: z.nativeEnum(AuditStatus).optional(),
  correlationId: z.string().optional(),
  serviceName: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "action", "entityType"]).default("createdAt"),
  sortOrder: z.nativeEnum(SortOrder).default(SortOrder.DESC),
});

export async function auditLogRoutes(fastify: FastifyInstance) {
  const auditLogService: AuditLogService = (fastify as any).auditLogService;

  fastify.post<{ Body: CreateAuditLogDto }>(
    "/",
    {
      schema: {
        description: `Create a new audit log entry for tracking system actions and changes

**Success Response Example (201):**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "9f8e7d6c-5b4a-3c2d-1e0f-a1b2c3d4e5f6",
    "action": "CREATE",
    "entityType": "Transaction",
    "entityId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "c259e20b-ea0a-4153-adee-74c463644b78",
    "status": "SUCCESS",
    "correlationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "serviceName": "transaction-view-service",
    "metadata": { "source": "api", "version": "1.0" },
    "createdAt": "2025-11-11T12:00:00.000Z"
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/audit-logs"
}
\`\`\``,
        tags: ["Audit Logs"],
        body: {
          type: "object",
          required: [
            "action",
            "entityType",
            "entityId",
            "status",
            "correlationId",
            "serviceName",
          ],
          properties: {
            action: {
              type: "string",
              enum: [
                "CREATE",
                "UPDATE",
                "DELETE",
                "READ",
                "LOGIN",
                "LOGOUT",
                "ROLLBACK",
              ],
              description: "Type of action performed",
              example: "CREATE",
            },
            entityType: {
              type: "string",
              description: "Type of entity affected",
              example: "Transaction",
            },
            entityId: {
              type: "string",
              description: "ID of the affected entity",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            userId: {
              type: "string",
              description: "ID of user who performed the action",
              example: "c259e20b-ea0a-4153-adee-74c463644b78",
            },
            status: {
              type: "string",
              enum: ["SUCCESS", "FAILED", "ROLLED_BACK", "PENDING"],
              description: "Status of the action",
              example: "SUCCESS",
            },
            metadata: {
              type: "object",
              description: "Additional metadata",
              example: { source: "api", version: "1.0" },
            },
            changes: {
              type: "object",
              description: "Before/after state for UPDATE actions",
              properties: {
                before: {
                  type: "object",
                  description: "State before change",
                  example: { amount: 100, status: "PENDING" },
                },
                after: {
                  type: "object",
                  description: "State after change",
                  example: { amount: 150, status: "COMPLETED" },
                },
              },
            },
            ipAddress: {
              type: "string",
              description: "IP address of the requester",
              example: "192.168.1.1",
            },
            userAgent: {
              type: "string",
              description: "User agent string",
              example: "Mozilla/5.0...",
            },
            correlationId: {
              type: "string",
              description: "Correlation ID for distributed tracing",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            serviceName: {
              type: "string",
              description: "Name of the service creating the log",
              example: "transaction-view-service",
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: CreateAuditLogDto }>,
      reply: FastifyReply
    ) => {
      const auditLog = await auditLogService.createAuditLog(request.body);
      reply.code(201);
      return auditLog;
    }
  );

  fastify.get<{ Querystring: AuditLogQueryDto }>(
    "/",
    {
      schema: {
        description: `Query audit logs with advanced filtering, pagination, and sorting

**Success Response Example (200):**
\`\`\`json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "9f8e7d6c-5b4a-3c2d-1e0f-a1b2c3d4e5f6",
        "action": "CREATE",
        "entityType": "Transaction",
        "entityId": "550e8400-e29b-41d4-a716-446655440000",
        "userId": "c259e20b-ea0a-4153-adee-74c463644b78",
        "status": "SUCCESS",
        "correlationId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
        "serviceName": "transaction-view-service",
        "metadata": { "ipAddress": "127.0.0.1", "userAgent": "PostmanRuntime/7.32.3" },
        "createdAt": "2025-11-11T12:00:00.000Z"
      },
      {
        "id": "8e7d6c5b-4a3c-2d1e-0f9a-b1c2d3e4f5a6",
        "action": "UPDATE",
        "entityType": "Transaction",
        "entityId": "550e8400-e29b-41d4-a716-446655440000",
        "userId": "c259e20b-ea0a-4153-adee-74c463644b78",
        "status": "SUCCESS",
        "correlationId": "8d0f7780-8536-51ef-b055-f18fd2f91bf8",
        "serviceName": "transaction-view-service",
        "changes": {
          "before": { "status": "PENDING", "amount": 100 },
          "after": { "status": "COMPLETED", "amount": 100 }
        },
        "createdAt": "2025-11-11T12:05:00.000Z"
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  },
  "timestamp": "2025-11-11T12:10:00.000Z",
  "path": "/api/audit-logs"
}
\`\`\``,
        tags: ["Audit Logs"],
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
            action: {
              type: "string",
              description: "Filter by action type",
              example: "CREATE",
            },
            entityType: {
              type: "string",
              description: "Filter by entity type",
              example: "Transaction",
            },
            entityId: {
              type: "string",
              description: "Filter by entity ID",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            userId: {
              type: "string",
              description: "Filter by user ID",
              example: "c259e20b-ea0a-4153-adee-74c463644b78",
            },
            status: {
              type: "string",
              description: "Filter by status",
              example: "SUCCESS",
            },
            correlationId: {
              type: "string",
              description: "Filter by correlation ID (distributed tracing)",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            serviceName: {
              type: "string",
              description: "Filter by service name",
              example: "transaction-view-service",
            },
            startDate: {
              type: "string",
              format: "date-time",
              description: "Start date for date range filter",
              example: "2025-11-01T00:00:00.000Z",
            },
            endDate: {
              type: "string",
              format: "date-time",
              description: "End date for date range filter",
              example: "2025-11-30T23:59:59.999Z",
            },
            sortBy: {
              type: "string",
              enum: ["createdAt", "action", "entityType"],
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
      request: FastifyRequest<{ Querystring: AuditLogQueryDto }>,
      _reply: FastifyReply
    ) => {
      const validatedQuery = auditLogQuerySchema.parse(request.query);
      const result = await auditLogService.queryAuditLogs(validatedQuery);
      return result;
    }
  );

  fastify.get<{ Params: { id: string } }>(
    "/:id",
    {
      schema: {
        description: "Get a specific audit log by ID",
        tags: ["Audit Logs"],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "Audit log ID",
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
      const auditLog = await auditLogService.getAuditLog(request.params.id);

      if (!auditLog) {
        reply.code(404);
        return { error: "Audit log not found" };
      }

      return auditLog;
    }
  );

  fastify.get<{ Params: { correlationId: string } }>(
    "/correlation/:correlationId",
    {
      schema: {
        description:
          "Get all audit logs for a specific correlation ID (distributed transaction tracking)",
        tags: ["Audit Logs"],
        params: {
          type: "object",
          required: ["correlationId"],
          properties: {
            correlationId: {
              type: "string",
              description: "Correlation ID for distributed tracing",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Params: { correlationId: string } }>,
      _reply: FastifyReply
    ) => {
      const logs = await auditLogService.getAuditLogsByCorrelationId(
        request.params.correlationId
      );
      return logs;
    }
  );

  fastify.get<{ Params: { entityType: string; entityId: string } }>(
    "/entity/:entityType/:entityId",
    {
      schema: {
        description:
          "Get all audit logs for a specific entity (complete audit trail)",
        tags: ["Audit Logs"],
        params: {
          type: "object",
          required: ["entityType", "entityId"],
          properties: {
            entityType: {
              type: "string",
              description: "Type of entity",
              example: "Transaction",
            },
            entityId: {
              type: "string",
              description: "Entity ID",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{
        Params: { entityType: string; entityId: string };
      }>,
      _reply: FastifyReply
    ) => {
      const logs = await auditLogService.getAuditLogsByEntity(
        request.params.entityType,
        request.params.entityId
      );
      return logs;
    }
  );
}
