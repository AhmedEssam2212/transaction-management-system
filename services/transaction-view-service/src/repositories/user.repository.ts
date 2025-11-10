import { Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { BaseRepository } from "./base.repository";

export class UserRepository extends BaseRepository<User> {
  constructor(repository: Repository<User>) {
    super(repository);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repository.findOne({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ where: { email } });
  }

  async existsByUsername(username: string): Promise<boolean> {
    const count = await this.repository.count({ where: { username } });
    return count > 0;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.repository.count({ where: { email } });
    return count > 0;
  }
}
