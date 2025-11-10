import { AuditLogService } from "../services";
import { NatsClient } from "../infrastructure/nats.client";
import { NATS_SUBJECTS, CreateAuditLogDto } from "@transaction-system/shared";
import pino from "pino";

export class AuditLogHandler {
  private logger: any;

  constructor(
    private auditLogService: AuditLogService,
    private natsClient: NatsClient,
    logger?: any
  ) {
    this.logger = logger || pino({
      name: "audit-log-handler",
      level: process.env.NODE_ENV === "development" ? "debug" : "info",
    });
  }

  async setupHandlers(): Promise<void> {
    // Handle audit log creation requests
    await this.natsClient.subscribe(
      NATS_SUBJECTS.AUDIT_LOG_CREATE,
      this.handleCreateAuditLog.bind(this)
    );

    // Handle audit log rollback requests
    await this.natsClient.subscribe(
      NATS_SUBJECTS.AUDIT_LOG_ROLLBACK,
      this.handleRollbackAuditLog.bind(this)
    );

    this.logger.info("Audit log handlers registered");
  }

  private async handleCreateAuditLog(data: CreateAuditLogDto): Promise<void> {
    try {
      this.logger.info(
        {
          correlationId: data.correlationId,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
        },
        "Processing audit log creation"
      );

      const auditLog = await this.auditLogService.createAuditLog(data);

      // Publish success confirmation
      await this.natsClient.publish(NATS_SUBJECTS.AUDIT_LOG_CREATED, {
        correlationId: data.correlationId,
        auditLogId: auditLog.id,
        success: true,
      });

      this.logger.info(
        {
          auditLogId: auditLog.id,
          correlationId: data.correlationId,
        },
        "Audit log created successfully"
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
          correlationId: data.correlationId,
        },
        "Failed to create audit log"
      );

      // Publish failure notification
      await this.natsClient.publish(NATS_SUBJECTS.AUDIT_LOG_FAILED, {
        correlationId: data.correlationId,
        error: error instanceof Error ? error.message : "Unknown error",
        success: false,
      });
    }
  }

  private async handleRollbackAuditLog(data: {
    correlationId: string;
    reason: string;
  }): Promise<void> {
    try {
      this.logger.warn(
        {
          correlationId: data.correlationId,
          reason: data.reason,
        },
        "Processing audit log rollback"
      );

      await this.auditLogService.rollbackAuditLogs(data.correlationId);

      this.logger.info(
        {
          correlationId: data.correlationId,
        },
        "Audit logs rolled back successfully"
      );
    } catch (error) {
      this.logger.error(
        {
          err: error,
          correlationId: data.correlationId,
        },
        "Failed to rollback audit logs"
      );
    }
  }
}
