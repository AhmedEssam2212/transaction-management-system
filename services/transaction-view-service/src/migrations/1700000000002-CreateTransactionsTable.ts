import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableIndex,
  TableForeignKey,
} from "typeorm";

export class CreateTransactionsTable1700000000002
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: "transactions",
        columns: [
          {
            name: "id",
            type: "uuid",
            isPrimary: true,
            default: "uuid_generate_v4()",
          },
          {
            name: "user_id",
            type: "uuid",
            isNullable: false,
          },
          {
            name: "amount",
            type: "decimal",
            precision: 15,
            scale: 2,
            isNullable: false,
          },
          {
            name: "currency",
            type: "varchar",
            length: "3",
            default: "'USD'",
            isNullable: false,
          },
          {
            name: "status",
            type: "varchar",
            length: "20",
            default: "'PENDING'",
            isNullable: false,
          },
          {
            name: "description",
            type: "text",
            isNullable: true,
          },
          {
            name: "metadata",
            type: "jsonb",
            isNullable: true,
          },
          {
            name: "created_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
          {
            name: "updated_at",
            type: "timestamp",
            default: "CURRENT_TIMESTAMP",
          },
        ],
      }),
      true
    );

    await queryRunner.createForeignKey(
      "transactions",
      new TableForeignKey({
        columnNames: ["user_id"],
        referencedColumnNames: ["id"],
        referencedTableName: "users",
        onDelete: "CASCADE",
      })
    );

    await queryRunner.createIndex(
      "transactions",
      new TableIndex({
        name: "idx_transaction_user_status",
        columnNames: ["user_id", "status"],
      })
    );

    await queryRunner.createIndex(
      "transactions",
      new TableIndex({
        name: "idx_transaction_created_at",
        columnNames: ["created_at"],
      })
    );

    await queryRunner.createIndex(
      "transactions",
      new TableIndex({
        name: "idx_transaction_status",
        columnNames: ["status"],
      })
    );

    await queryRunner.createIndex(
      "transactions",
      new TableIndex({
        name: "idx_transaction_currency",
        columnNames: ["currency"],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable("transactions");
  }
}
