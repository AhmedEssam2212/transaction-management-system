import { AuditAction } from "../enums/audit-action.enum";
import { AuditStatus } from "../enums/audit-status.enum";
import { SortOrder } from "../enums/sort-order.enum";

/**
 * Audit Log Data Transfer Objects (DTOs)
 *
 * These are pure TypeScript interfaces for compile-time type safety.
 * Runtime validation is handled separately by Zod schemas in each service's validators/ folder.
 *
 * See README.md "Technical Decisions" section for detailed explanation of this architecture.
 */

export interface CreateAuditLogDto {
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string;
  status: AuditStatus;
  metadata?: Record<string, any>;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  serviceName: string;
}

export interface AuditLogDto {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  userId?: string;
  status: AuditStatus;
  metadata?: Record<string, any>;
  changes?: {
    before?: any;
    after?: any;
  };
  ipAddress?: string;
  userAgent?: string;
  correlationId: string;
  serviceName: string;
  createdAt: Date;
}

export interface AuditLogQueryDto {
  page?: number;
  limit?: number;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
  status?: AuditStatus;
  correlationId?: string;
  serviceName?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}
