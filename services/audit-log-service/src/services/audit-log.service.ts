import { AuditLogRepository } from "../repositories";
import {
  CreateAuditLogDto,
  AuditLogDto,
  AuditLogQueryDto,
  PaginatedResult,
} from "@transaction-system/shared";
import { AuditLog } from "../entities";

export class AuditLogService {
  constructor(private auditLogRepository: AuditLogRepository) {}

  async createAuditLog(dto: CreateAuditLogDto): Promise<AuditLogDto> {
    const auditLog = await this.auditLogRepository.create({
      action: dto.action,
      entityType: dto.entityType,
      entityId: dto.entityId,
      userId: dto.userId,
      status: dto.status,
      metadata: dto.metadata,
      changes: dto.changes,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
      correlationId: dto.correlationId,
      serviceName: dto.serviceName,
    });

    return this.mapToDto(auditLog);
  }

  async getAuditLog(id: string): Promise<AuditLogDto | null> {
    const auditLog = await this.auditLogRepository.findById(id);
    return auditLog ? this.mapToDto(auditLog) : null;
  }

  async queryAuditLogs(
    query: AuditLogQueryDto
  ): Promise<PaginatedResult<AuditLogDto>> {
    const result = await this.auditLogRepository.findWithFilters(query);

    return {
      ...result,
      data: result.data.map((log) => this.mapToDto(log)),
    };
  }

  async getAuditLogsByCorrelationId(
    correlationId: string
  ): Promise<AuditLogDto[]> {
    const logs = await this.auditLogRepository.findByCorrelationId(
      correlationId
    );
    return logs.map((log) => this.mapToDto(log));
  }

  async getAuditLogsByEntity(
    entityType: string,
    entityId: string
  ): Promise<AuditLogDto[]> {
    const logs = await this.auditLogRepository.findByEntityId(
      entityType,
      entityId
    );
    return logs.map((log) => this.mapToDto(log));
  }

  async rollbackAuditLogs(correlationId: string): Promise<void> {
    await this.auditLogRepository.markAsRolledBack(correlationId);
  }

  private mapToDto(auditLog: AuditLog): AuditLogDto {
    return {
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      entityId: auditLog.entityId,
      userId: auditLog.userId,
      status: auditLog.status,
      metadata: auditLog.metadata,
      changes: auditLog.changes,
      ipAddress: auditLog.ipAddress,
      userAgent: auditLog.userAgent,
      correlationId: auditLog.correlationId,
      serviceName: auditLog.serviceName,
      createdAt: auditLog.createdAt,
    };
  }
}
