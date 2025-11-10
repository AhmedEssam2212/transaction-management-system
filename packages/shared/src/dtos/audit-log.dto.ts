import { AuditAction } from "../enums/audit-action.enum";
import { AuditStatus } from "../enums/audit-status.enum";

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
  sortOrder?: "ASC" | "DESC"; // TODO : create an enum for sortOrder
}
