import {
  Repository,
  FindOptionsWhere,
  FindManyOptions,
  DeepPartial,
  ObjectLiteral,
} from "typeorm";
import {
  IRepository,
  FindAllOptions,
  PaginatedResult,
} from "@transaction-system/shared";

export abstract class BaseRepository<T extends ObjectLiteral>
  implements IRepository<T>
{
  constructor(protected repository: Repository<T>) {}

  async findAll(options?: FindAllOptions): Promise<PaginatedResult<T>> {
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const findOptions: FindManyOptions<T> = {
      skip,
      take: limit,
    };

    if (options?.sortBy) {
      findOptions.order = {
        [options.sortBy]: options.sortOrder || "ASC",
      } as any;
    }

    if (options?.filters) {
      findOptions.where = options.filters as FindOptionsWhere<T>;
    }

    const [data, total] = await this.repository.findAndCount(findOptions);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: string): Promise<T | null> {
    return this.repository.findOne({
      where: { id } as unknown as FindOptionsWhere<T>,
    });
  }

  async findOne(criteria: Partial<T>): Promise<T | null> {
    return this.repository.findOne({
      where: criteria as FindOptionsWhere<T>,
    });
  }

  async create(data: Partial<T>): Promise<T> {
    const entity = this.repository.create(data as DeepPartial<T>);
    return this.repository.save(entity);
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    await this.repository.update(id, data as any);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error("Entity not found after update");
    }
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async count(criteria?: Partial<T>): Promise<number> {
    if (criteria) {
      return this.repository.count({
        where: criteria as FindOptionsWhere<T>,
      });
    }
    return this.repository.count();
  }
}
