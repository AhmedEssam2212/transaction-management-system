import { TransactionStatus } from "../enums/transaction-status.enum";
import { Currency } from "../enums/currency.enum";
import { SortOrder } from "../enums/sort-order.enum";

/**
 * Transaction Data Transfer Objects (DTOs)
 *
 * These are pure TypeScript interfaces for compile-time type safety.
 * Runtime validation is handled separately by Zod schemas in each service's validators/ folder.
 *
 * See README.md "Architecture Decisions" section for detailed explanation of this architecture.
 */
export interface CreateTransactionDto {
  amount: number;
  currency: Currency;
  description?: string;
  metadata?: Record<string, any>;
}

export interface UpdateTransactionDto {
  amount?: number;
  currency?: Currency;
  status?: TransactionStatus;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TransactionDto {
  id: string;
  userId: string;
  amount: number;
  currency: Currency;
  status: TransactionStatus;
  description?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionQueryDto {
  page?: number;
  limit?: number;
  status?: TransactionStatus;
  currency?: Currency;
  userId?: string;
  minAmount?: number;
  maxAmount?: number;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
}
