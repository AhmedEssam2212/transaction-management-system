import { z } from "zod";
import {
  TransactionStatus,
  Currency,
  SortOrder,
} from "@transaction-system/shared";

export const createTransactionSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.nativeEnum(Currency),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateTransactionSchema = z
  .object({
    amount: z.number().positive("Amount must be positive").optional(),
    currency: z.nativeEnum(Currency).optional(),
    status: z.nativeEnum(TransactionStatus).optional(),
    description: z.string().optional(),
    metadata: z.record(z.any()).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

export const transactionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  status: z.nativeEnum(TransactionStatus).optional(),
  currency: z.nativeEnum(Currency).optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "amount"]).default("createdAt"),
  sortOrder: z.nativeEnum(SortOrder).default(SortOrder.DESC),
});

export const transactionIdSchema = z.object({
  id: z.string().uuid("Invalid transaction ID format"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type TransactionQueryInput = z.infer<typeof transactionQuerySchema>;
export type TransactionIdInput = z.infer<typeof transactionIdSchema>;
