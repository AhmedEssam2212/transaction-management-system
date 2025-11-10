import { TransactionStatus } from "../enums/transaction-status.enum";
import { Currency } from "../enums/currency.enum";

// TODO: is it the right approach to have them in one file or seperate file 
// for each prefered and best practice ?
//  also why using interface not a class ? is also this a best practice ?
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
  sortOrder?: "ASC" | "DESC";
}
