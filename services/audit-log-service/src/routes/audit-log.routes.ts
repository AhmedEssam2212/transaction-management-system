import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuditLogService } from "../services";
import {
  CreateAuditLogDto,
  AuditLogQueryDto,
  AuditAction,
  AuditStatus,
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
  sortOrder: z.enum(["ASC", "DESC"]).default("DESC"),
});

export async function auditLogRoutes(fastify: FastifyInstance) {
  const auditLogService: AuditLogService = (fastify as any).auditLogService;

  fastify.post<{ Body: CreateAuditLogDto }>(
    "/",
    {
      schema: {
        description: "Create a new audit log entry",
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
            },
            entityType: { type: "string" },
            entityId: { type: "string" },
            userId: { type: "string" },
            status: {
              type: "string",
              enum: ["SUCCESS", "FAILED", "ROLLED_BACK", "PENDING"],
            },
            metadata: { type: "object" },
            changes: {
              type: "object",
              properties: {
                before: { type: "object" },
                after: { type: "object" },
              },
            },
            ipAddress: { type: "string" },
            userAgent: { type: "string" },
            correlationId: { type: "string" },
            serviceName: { type: "string" },
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
        description: "Query audit logs with filters and pagination",
        tags: ["Audit Logs"],
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1, default: 1 },
            limit: { type: "number", minimum: 1, maximum: 100, default: 10 },
            action: { type: "string" },
            entityType: { type: "string" },
            entityId: { type: "string" },
            userId: { type: "string" },
            status: { type: "string" },
            correlationId: { type: "string" },
            serviceName: { type: "string" },
            startDate: { type: "string", format: "date-time" },
            endDate: { type: "string", format: "date-time" },
            sortBy: {
              type: "string",
              enum: ["createdAt", "action", "entityType"],
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
            id: { type: "string", format: "uuid" },
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
        description: "Get all audit logs for a specific correlation ID",
        tags: ["Audit Logs"],
        params: {
          type: "object",
          required: ["correlationId"],
          properties: {
            correlationId: { type: "string" },
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
        description: "Get all audit logs for a specific entity",
        tags: ["Audit Logs"],
        params: {
          type: "object",
          required: ["entityType", "entityId"],
          properties: {
            entityType: { type: "string" },
            entityId: { type: "string" },
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
