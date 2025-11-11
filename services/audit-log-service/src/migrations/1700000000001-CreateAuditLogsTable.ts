import { MigrationInterface, QueryRunner, Table, TableIndex } from "typeorm";

export class CreateAuditLogsTable1700000000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.createTable(
      new Table({
        name: "audit_logs",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "action",
            type: "varchar",
            length: "20",
            isNullable: false,
          },
          {
            name: "entity_type",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "entity_id",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "user_id",
            type: "varchar",
            length: "255",
            isNullable: true,
          },
          {
            name: "status",
            type: "varchar",
            length: "20",
            default: "'SUCCESS'",
            isNullable: false,
          },
          {
            name: "metadata",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "changes",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "ip_address",
            type: "varchar",
            length: "45",
            isNullable: true,
          },
          {
            name: "user_agent",
            type: "text",
            isNullable: true,
          },
          {
            name: "correlation_id",
            type: "varchar",
            length: "255",
            isNullable: false,
          },
          {
            name: "service_name",
            type: "varchar",
            length: "100",
            isNullable: false,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    // Create indexes for better query performance
    await queryRunner.createIndex(
      "audit_logs",
      new TableIndex({
        name: "idx_audit_log_correlation_id",
        columnNames: ["correlation_id"]
      })
    );

    await queryRunner.createIndex(
      "audit_logs",
      new TableIndex({
        name: "idx_audit_log_entity",
        columnNames: ["entity_type", "entity_id"]
      })
    );

    await queryRunner.createIndex(
      "audit_logs",
      new TableIndex({
        name: "idx_audit_log_user_action",
        columnNames: ["user_id", "action"]
      })
    );

    await queryRunner.createIndex(
      "audit_logs",
      new TableIndex({
        name: "idx_audit_log_created_at",
        columnNames: ["created_at"]
      })
    );

    await queryRunner.createIndex(
      "audit_logs",
      new TableIndex({
        name: "idx_audit_log_status",
        columnNames: ["status"]
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("audit_logs");
  }
}
