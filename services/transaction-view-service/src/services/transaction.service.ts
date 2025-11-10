import { DataSource } from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { TransactionRepository } from "../repositories";
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  TransactionDto,
  TransactionQueryDto,
  PaginatedResult,
  AuditAction,
  AuditStatus,
  CreateAuditLogDto,
  NATS_SUBJECTS,
} from "@transaction-system/shared";
import { Transaction } from "../entities";
import {
  NotFoundException,
  DistributedTransactionException,
} from "../exceptions";
import { NatsClient } from "../infrastructure/nats.client";
import { envConfig } from "../config/env.config";

export class TransactionService {
  constructor(
    private transactionRepository: TransactionRepository,
    private natsClient: NatsClient,
    private dataSource: DataSource
  ) {}

  async createTransaction(
    userId: string,
    dto: CreateTransactionDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TransactionDto> {
    const correlationId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Step 1: Create transaction in database
      const transaction = queryRunner.manager.create(Transaction, {
        userId,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        metadata: dto.metadata,
      });

      const savedTransaction = await queryRunner.manager.save(transaction);

      // Step 2: Publish audit log creation request
      const auditLogDto: CreateAuditLogDto = {
        action: AuditAction.CREATE,
        entityType: "Transaction",
        entityId: savedTransaction.id,
        userId,
        status: AuditStatus.SUCCESS,
        metadata: {
          amount: savedTransaction.amount,
          currency: savedTransaction.currency,
        },
        changes: {
          after: this.mapToDto(savedTransaction),
        },
        ipAddress,
        userAgent,
        correlationId,
        serviceName: envConfig.service.name,
      };

      // Publish to NATS and wait for acknowledgment
      await this.natsClient.publish(
        NATS_SUBJECTS.AUDIT_LOG_CREATE,
        auditLogDto
      );

      // Wait for audit log confirmation with timeout
      const auditConfirmed = await this.waitForAuditConfirmation(
        correlationId,
        5000
      );

      if (!auditConfirmed) {
        throw new DistributedTransactionException(
          "Audit log creation failed or timed out"
        );
      }

      // Step 3: Commit transaction
      await queryRunner.commitTransaction();

      return this.mapToDto(savedTransaction);
    } catch (error) {
      // Rollback database transaction
      await queryRunner.rollbackTransaction();

      // Publish rollback event for audit log
      await this.natsClient.publish(NATS_SUBJECTS.AUDIT_LOG_ROLLBACK, {
        correlationId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateTransaction(
    id: string,
    userId: string,
    dto: UpdateTransactionDto,
    ipAddress?: string,
    userAgent?: string
  ): Promise<TransactionDto> {
    const correlationId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get existing transaction
      const existingTransaction = await queryRunner.manager.findOne(
        Transaction,
        {
          where: { id, userId },
        }
      );

      if (!existingTransaction) {
        throw new NotFoundException("Transaction not found");
      }

      const beforeState = { ...existingTransaction };

      // Update transaction
      Object.assign(existingTransaction, dto);
      const updatedTransaction = await queryRunner.manager.save(
        existingTransaction
      );

      // Create audit log
      const auditLogDto: CreateAuditLogDto = {
        action: AuditAction.UPDATE,
        entityType: "Transaction",
        entityId: id,
        userId,
        status: AuditStatus.SUCCESS,
        metadata: {
          updatedFields: Object.keys(dto),
        },
        changes: {
          before: this.mapToDto(beforeState),
          after: this.mapToDto(updatedTransaction),
        },
        ipAddress,
        userAgent,
        correlationId,
        serviceName: envConfig.service.name,
      };

      await this.natsClient.publish(
        NATS_SUBJECTS.AUDIT_LOG_CREATE,
        auditLogDto
      );

      const auditConfirmed = await this.waitForAuditConfirmation(
        correlationId,
        5000
      );

      if (!auditConfirmed) {
        throw new DistributedTransactionException(
          "Audit log creation failed or timed out"
        );
      }

      await queryRunner.commitTransaction();

      return this.mapToDto(updatedTransaction);
    } catch (error) {
      await queryRunner.rollbackTransaction();

      await this.natsClient.publish(NATS_SUBJECTS.AUDIT_LOG_ROLLBACK, {
        correlationId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteTransaction(
    id: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const correlationId = uuidv4();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await queryRunner.manager.findOne(Transaction, {
        where: { id, userId },
      });

      if (!transaction) {
        throw new NotFoundException("Transaction not found");
      }

      const beforeState = { ...transaction };

      await queryRunner.manager.remove(transaction);

      const auditLogDto: CreateAuditLogDto = {
        action: AuditAction.DELETE,
        entityType: "Transaction",
        entityId: id,
        userId,
        status: AuditStatus.SUCCESS,
        changes: {
          before: this.mapToDto(beforeState),
        },
        ipAddress,
        userAgent,
        correlationId,
        serviceName: envConfig.service.name,
      };

      await this.natsClient.publish(
        NATS_SUBJECTS.AUDIT_LOG_CREATE,
        auditLogDto
      );

      const auditConfirmed = await this.waitForAuditConfirmation(
        correlationId,
        5000
      );

      if (!auditConfirmed) {
        throw new DistributedTransactionException(
          "Audit log creation failed or timed out"
        );
      }

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();

      await this.natsClient.publish(NATS_SUBJECTS.AUDIT_LOG_ROLLBACK, {
        correlationId,
        reason: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getTransaction(id: string, userId: string): Promise<TransactionDto> {
    const transaction = await this.transactionRepository.findOne({
      id,
      userId,
    } as any);

    if (!transaction) {
      throw new NotFoundException("Transaction not found");
    }

    return this.mapToDto(transaction);
  }

  async listTransactions(
    userId: string,
    query: TransactionQueryDto
  ): Promise<PaginatedResult<TransactionDto>> {
    const result = await this.transactionRepository.findWithFilters({
      ...query,
      userId,
    });

    return {
      ...result,
      data: result.data.map((t) => this.mapToDto(t)),
    };
  }

  private async waitForAuditConfirmation(
    correlationId: string,
    timeout: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve(false);
      }, timeout);

      // Subscribe to audit log confirmation
      const subscription = this.natsClient
        .getConnection()
        .subscribe(NATS_SUBJECTS.AUDIT_LOG_CREATED);

      (async () => {
        for await (const msg of subscription) {
          const data = JSON.parse(new TextDecoder().decode(msg.data));
          if (data.correlationId === correlationId) {
            clearTimeout(timeoutId);
            subscription.unsubscribe();
            resolve(true);
            break;
          }
        }
      })();
    });
  }

  private mapToDto(transaction: Transaction): TransactionDto {
    return {
      id: transaction.id,
      userId: transaction.userId,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      status: transaction.status,
      description: transaction.description,
      metadata: transaction.metadata,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
