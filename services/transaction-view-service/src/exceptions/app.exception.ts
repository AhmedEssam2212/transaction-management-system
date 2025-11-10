import { ERROR_CODES } from "@transaction-system/shared";

export class AppException extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationException extends AppException {
  constructor(message: string, details?: any) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
  }
}

export class UnauthorizedException extends AppException {
  constructor(message: string = "Unauthorized") {
    super(ERROR_CODES.UNAUTHORIZED, message, 401);
  }
}

export class NotFoundException extends AppException {
  constructor(message: string = "Resource not found") {
    super(ERROR_CODES.NOT_FOUND, message, 404);
  }
}

export class ConflictException extends AppException {
  constructor(message: string = "Resource already exists") {
    super(ERROR_CODES.ALREADY_EXISTS, message, 409);
  }
}

export class DatabaseException extends AppException {
  constructor(message: string, details?: any) {
    super(ERROR_CODES.DATABASE_ERROR, message, 500, details);
  }
}

export class ServiceUnavailableException extends AppException {
  constructor(message: string = "Service temporarily unavailable") {
    super(ERROR_CODES.SERVICE_UNAVAILABLE, message, 503);
  }
}

export class DistributedTransactionException extends AppException {
  constructor(message: string, details?: any) {
    super(ERROR_CODES.DISTRIBUTED_TRANSACTION_FAILED, message, 500, details);
  }
}
