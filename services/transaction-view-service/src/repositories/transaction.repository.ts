import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm";
import { Transaction } from "../entities/transaction.entity";
import { BaseRepository } from "./base.repository";
import {
  TransactionQueryDto,
  PaginatedResult,
  SortOrder,
} from "@transaction-system/shared";

export class TransactionRepository extends BaseRepository<Transaction> {
  constructor(repository: Repository<Transaction>) {
    super(repository);
  }

  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<PaginatedResult<Transaction>> {
    return this.findAll({
      page,
      limit,
      filters: { userId } as any,
      sortBy: "createdAt",
      sortOrder: SortOrder.DESC,
    });
  }

  async findWithFilters(
    query: TransactionQueryDto
  ): Promise<PaginatedResult<Transaction>> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.currency) {
      where.currency = query.currency;
    }

    if (query.minAmount !== undefined && query.maxAmount !== undefined) {
      where.amount = Between(query.minAmount, query.maxAmount);
    } else if (query.minAmount !== undefined) {
      where.amount = MoreThanOrEqual(query.minAmount);
    } else if (query.maxAmount !== undefined) {
      where.amount = LessThanOrEqual(query.maxAmount);
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
        [query.sortBy || "createdAt"]: query.sortOrder || SortOrder.DESC,
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
}
