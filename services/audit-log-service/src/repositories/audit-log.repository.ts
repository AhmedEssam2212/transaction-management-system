import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { AuditLog } from "../entities/audit-log.entity";
import { BaseRepository } from "./base.repository";
import { AuditLogQueryDto, PaginatedResult } from "@transaction-system/shared";

export class AuditLogRepository extends BaseRepository<AuditLog> {
  constructor(repository: Repository<AuditLog>) {
    super(repository);
  }

  async findByCorrelationId(correlationId: string): Promise<AuditLog[]> {
    return this.repository.find({
      where: { correlationId },
      order: { createdAt: "ASC" },
    });
  }

  async findByEntityId(
    entityType: string,
    entityId: string
  ): Promise<AuditLog[]> {
    return this.repository.find({
      where: { entityType, entityId },
      order: { createdAt: "DESC" },
    });
  }

  async findWithFilters(
    query: AuditLogQueryDto
  ): Promise<PaginatedResult<AuditLog>> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.entityType) {
      where.entityType = query.entityType;
    }

    if (query.entityId) {
      where.entityId = query.entityId;
    }

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.correlationId) {
      where.correlationId = query.correlationId;
    }

    if (query.serviceName) {
      where.serviceName = query.serviceName;
    }

    if (query.startDate && query.endDate) {
      where.createdAt = Between(
        new Date(query.startDate),
        new Date(query.endDate)
      );
    } else if (query.startDate) {
      where.createdAt = MoreThanOrEqual(new Date(query.startDate));
    } else if (query.endDate) {
      where.createdAt = LessThanOrEqual(new Date(query.endDate));
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      skip,
      take: limit,
      order: {
        [query.sortBy || "createdAt"]: query.sortOrder || "DESC",
      },
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async markAsRolledBack(correlationId: string): Promise<void> {
    await this.repository.update(
      { correlationId },
      { status: "ROLLED_BACK" as any }
    );
  }
}
