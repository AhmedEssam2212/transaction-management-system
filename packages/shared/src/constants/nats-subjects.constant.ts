export const NATS_SUBJECTS = {
  AUDIT_LOG_CREATE: "audit.log.create",
  AUDIT_LOG_ROLLBACK: "audit.log.rollback",
  AUDIT_LOG_CREATED: "audit.log.created",
  AUDIT_LOG_FAILED: "audit.log.failed",
  TRANSACTION_CREATED: "transaction.created",
  TRANSACTION_UPDATED: "transaction.updated",
  TRANSACTION_DELETED: "transaction.deleted",
  TRANSACTION_ROLLBACK: "transaction.rollback",
} as const;

export const NATS_STREAMS = {
  AUDIT_LOGS: "AUDIT_LOGS",
  TRANSACTIONS: "TRANSACTIONS",
} as const;
