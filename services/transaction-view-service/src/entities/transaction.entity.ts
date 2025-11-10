import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm";
import { TransactionStatus, Currency } from "@transaction-system/shared";
import { User } from "./user.entity";

@Entity("transactions")
@Index("idx_transaction_user_status", ["userId", "status"])
@Index("idx_transaction_created_at", ["createdAt"])
@Index("idx_transaction_status", ["status"])
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ name: "user_id" })
  userId: string;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user: User;

  @Column("decimal", { precision: 15, scale: 2 })
  amount: number;

  @Column({
    type: "enum",
    enum: Currency,
    default: Currency.USD,
  })
  @Index("idx_transaction_currency")
  currency: Currency;

  @Column({
    type: "enum",
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({ type: "text", nullable: true })
  description: string;

  @Column({ type: "jsonb", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: "created_at" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt: Date;
}
