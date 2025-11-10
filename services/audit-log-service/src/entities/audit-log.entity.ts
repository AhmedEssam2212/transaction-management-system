import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";
import { AuditAction, AuditStatus } from "@transaction-system/shared";

@Entity("audit_logs")
@Index("idx_audit_log_correlation_id", ["correlationId"])
@Index("idx_audit_log_entity", ["entityType", "entityId"])
@Index("idx_audit_log_user_action", ["userId", "action"])
@Index("idx_audit_log_created_at", ["createdAt"])
@Index("idx_audit_log_status", ["status"])
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({
    type: "enum",
    enum: AuditAction,
  })
  action: AuditAction;

  @Column({ name: "entity_type" })
  entityType: string;

  @Column({ name: "entity_id" })
  entityId: string;

  @Column({ name: "user_id", nullable: true })
  userId: string;

  @Column({
    type: "enum",
    enum: AuditStatus,
    default: AuditStatus.SUCCESS,
  })
  status: AuditStatus;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @Column({ type: "jsonb", nullable: true })
  changes: {
    before?: any;
    after?: any;
  };

  @Column({ name: "ip_address", nullable: true })
  ipAddress: string;

  @Column({ name: "user_agent", nullable: true })
  userAgent: string;

  @Column({ name: "correlation_id" })
  correlationId: string;

  @Column({ name: "service_name" })
  serviceName: string;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;
}
