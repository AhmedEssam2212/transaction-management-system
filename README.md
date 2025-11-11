# Transaction Management System

A production-ready microservices-based transaction management system with distributed transaction guarantees and comprehensive audit logging.

## 🏗️ Architecture Overview

This system consists of two microservices:

1. **Transaction View Service** - Manages financial transactions with full CRUD operations
2. **Security Audit Log Service** - Tracks all system activities for compliance and monitoring

Both services communicate via **NATS JetStream** for reliable, distributed messaging and maintain separate PostgreSQL databases for data isolation.

## 📋 Table of Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Architecture Decisions](#architecture-decisions)
- [Getting Started](#getting-started)
- [Running Locally](#running-locally)
- [Running with Docker](#running-with-docker)
- [Running Tests](#running-tests)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)

## ✨ Features

### Transaction View Service
- ✅ JWT-based authentication
- ✅ Full CRUD operations for transactions
- ✅ Advanced filtering and pagination
- ✅ Input validation with Zod
- ✅ Distributed transaction support
- ✅ Automatic audit logging

### Security Audit Log Service
- ✅ Comprehensive audit trail
- ✅ Query and filter audit logs
- ✅ Correlation ID tracking
- ✅ Entity change tracking (before/after states)
- ✅ Rollback support

### Cross-Cutting Concerns
- ✅ Global error handling
- ✅ Unified response format
- ✅ Repository pattern
- ✅ SOLID principles
- ✅ Clean code architecture
- ✅ Comprehensive E2E tests

## 🛠️ Technology Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 4.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 16
- **ORM**: TypeORM 0.3.x
- **Message Broker**: NATS JetStream 2.10
- **Authentication**: JWT (@fastify/jwt)
- **Validation**: Zod
- **Testing**: Jest
- **API Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose

## 🎯 Architecture Decisions

### 1. Inter-Service Communication: NATS JetStream

**Decision**: Use NATS JetStream for inter-service communication

**Rationale**:
- **Reliability**: JetStream provides message persistence and guaranteed delivery
- **Performance**: NATS is extremely fast and lightweight
- **Scalability**: Built-in clustering and horizontal scaling
- **Simplicity**: Easy to set up and maintain compared to Kafka or RabbitMQ
- **Familiarity**: As requested, NATS was preferred due to team familiarity

**Alternatives Considered**:
- Direct HTTP calls: Rejected due to tight coupling and lack of resilience
- RabbitMQ: More complex setup, heavier resource usage
- Kafka: Overkill for this use case, complex operational overhead

### 2. Schema Sharing: Shared NPM Package

**Decision**: Use a shared TypeScript package (`@transaction-system/shared`) for types, DTOs, and interfaces

**Rationale**:
- **Type Safety**: Full TypeScript type checking across service boundaries
- **Single Source of Truth**: DTOs and interfaces defined once, used everywhere
- **Compile-Time Validation**: Catch type mismatches during build, not runtime
- **Easy Refactoring**: Changes propagate automatically through type system
- **Monorepo Benefits**: NPM workspaces enable efficient development

**What's Shared**:
- Enums (TransactionStatus, Currency, AuditAction, AuditStatus, SortOrder)
- DTOs (CreateTransactionDto, AuditLogDto, etc.)
- Interfaces (IRepository, ApiResponse, etc.)
- Constants (NATS subjects, error codes)

### 3. Audit Log Consistency: Saga Pattern

**Decision**: Implement choreography-based saga pattern for distributed transactions

**Why Saga Pattern?**

In a microservices architecture, maintaining data consistency across services is challenging. Traditional ACID transactions don't work across distributed systems. The Saga pattern solves this by breaking a distributed transaction into a series of local transactions, each with a compensating action for rollback.

**Why Choreography-Based (vs Orchestration)?**

We chose **choreography** over orchestration because:
- ✅ **Loose Coupling**: Services communicate via events, no central orchestrator
- ✅ **Scalability**: No single point of failure or bottleneck
- ✅ **Simplicity**: For 2 services, choreography is simpler than orchestration
- ✅ **Event-Driven**: Aligns with our NATS-based messaging architecture
- ⚠️ **Trade-off**: More complex for >3 services (would use orchestration then)

**Problem We're Solving**:

Without Saga pattern:
- ❌ Transaction created but audit log fails → **Missing audit trail**
- ❌ Audit log created but transaction fails → **Orphaned audit logs**
- ❌ No way to rollback distributed operations → **Data inconsistency**

With Saga pattern:
- ✅ Transaction commits **only if** audit log succeeds
- ✅ Audit log rolled back **if** transaction fails
- ✅ Correlation IDs track related operations across services
- ✅ Timeout handling prevents indefinite waiting

**Implementation Flow**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Transaction Service                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ 1. Start DB Transaction
                           ▼
                    ┌──────────────┐
                    │ Create Txn   │
                    │ (Not Committed)│
                    └──────────────┘
                           │
                           │ 2. Publish: audit.log.create
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NATS JetStream                             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ 3. Deliver Event
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Audit Log Service                            │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ 4. Create Audit Log
                           ▼
                    ┌──────────────┐
                    │ Audit Log    │
                    │ Created ✓    │
                    └──────────────┘
                           │
                           │ 5. Publish: audit.log.created
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NATS JetStream                             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ 6. Deliver Confirmation
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Transaction Service                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ 7. Commit DB Transaction
                           ▼
                    ┌──────────────┐
                    │ Transaction  │
                    │ Committed ✓  │
                    └──────────────┘

FAILURE SCENARIO:
If audit log fails → Publish: audit.log.failed
                  → Transaction Service rolls back DB transaction
                  → Publish: audit.log.rollback
                  → Audit Log Service deletes partial audit log
```

**Key Components**:

1. **Correlation IDs**: UUID v4 generated for each transaction, used to match events
2. **Timeout Handling**: 10-second timeout for audit confirmation (prevents hanging)
3. **Shared Subscription Pattern**: Single NATS subscription handles all audit confirmations efficiently
4. **Promise Resolver Map**: Concurrent transactions tracked via Map<correlationId, resolver>
5. **Compensation Logic**: Rollback events trigger cleanup in both services
6. **Event Subjects**:
   - `audit.log.create` - Request audit log creation
   - `audit.log.created` - Confirm successful creation
   - `audit.log.failed` - Report failure
   - `audit.log.rollback` - Request rollback

**Benefits**:
- ✅ **Data Consistency**: No orphaned or missing audit logs
- ✅ **Fault Tolerance**: Handles failures gracefully with rollback
- ✅ **Eventual Consistency**: System reaches consistent state after retries
- ✅ **Auditability**: Complete trail of all operations and compensations
- ✅ **Scalability**: Services remain independent and loosely coupled
- ✅ **High Performance**: 5 concurrent transactions complete in under 70ms

**Trade-offs**:
- ⚠️ **Complexity**: More complex than simple REST calls
- ⚠️ **Latency**: Additional network round-trip for confirmation (~10-30ms overhead)
- ⚠️ **Debugging**: Distributed tracing needed for troubleshooting
- ⚠️ **Testing**: Requires testing of failure scenarios and timeouts

**Performance Characteristics**:
- Single transaction: 10-30ms response time
- 5 concurrent transactions: 22-70ms response time
- Audit confirmation timeout: 10 seconds (configurable)
- Shared subscription eliminates per-transaction overhead

For detailed code examples, see `services/transaction-view-service/src/services/transaction.service.ts`

### 4. Repository Pattern

**Decision**: Implement generic repository pattern with TypeORM

**Rationale**:
- **Abstraction**: Decouples business logic from data access
- **Testability**: Easy to mock repositories for unit tests
- **Reusability**: Generic base repository reduces code duplication
- **Flexibility**: Easy to swap ORM or add caching layer

### 5. Database Indexes

**Decision**: Strategic indexing for query performance

**Indexes Created**:

**Transaction Service**:
- `idx_user_username` - Fast user lookup by username
- `idx_user_email` - Fast user lookup by email
- `idx_transaction_user_status` - Composite index for user's transactions by status
- `idx_transaction_created_at` - Time-based queries and sorting
- `idx_transaction_status` - Filter by status
- `idx_transaction_currency` - Filter by currency

**Audit Log Service**:
- `idx_audit_log_correlation_id` - Track distributed transactions
- `idx_audit_log_entity` - Find all logs for specific entity
- `idx_audit_log_user_action` - User activity tracking
- `idx_audit_log_created_at` - Time-based queries
- `idx_audit_log_status` - Filter by status

### 6. Error Handling Strategy

**Decision**: Centralized error handling with custom exception classes

**Rationale**:
- **Consistency**: All errors follow same format
- **Type Safety**: Custom exception classes with proper typing
- **Database Errors**: Automatic translation of PostgreSQL errors
- **Validation Errors**: Zod errors formatted consistently
- **Developer Experience**: Clear error messages and codes

### 7. DTO Architecture: Interfaces + Zod Validation

**Decision**: Separate DTOs (TypeScript interfaces) from validation logic (Zod schemas)

**Architecture**:
```
packages/shared/src/dtos/          ← Pure TypeScript interfaces (compile-time)
services/*/src/validators/         ← Zod schemas (runtime validation)
```

**Why Interfaces for DTOs?**
- ✅ **Zero Runtime Overhead**: Interfaces are compile-time only, no JavaScript emitted
- ✅ **Type Safety**: Full TypeScript type checking across service boundaries
- ✅ **Lightweight**: No constructor, no prototype chain, no class overhead
- ✅ **JSON Serialization**: Perfect for API data transfer
- ✅ **Shared Across Services**: Single source of truth in `@transaction-system/shared`

**Why Separate Validation?**
- ✅ **Separation of Concerns**: DTOs define structure, validators define rules
- ✅ **Service-Specific Rules**: Different services can validate the same DTO differently
- ✅ **Framework Agnostic**: DTOs work anywhere, validators are service-specific
- ✅ **Better Error Messages**: Zod provides detailed, customizable validation errors
- ✅ **Runtime Safety**: Validates untrusted input at API boundaries

**Example**:
```typescript
// Shared DTO (packages/shared/src/dtos/transaction.dto.ts)
export interface CreateTransactionDto {
  amount: number;
  currency: Currency;
  description?: string;
}

// Service-specific validator (services/transaction-view-service/src/validators/)
export const createTransactionSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.nativeEnum(Currency),
  description: z.string().optional(),
});

// Usage in route handler
const validatedData = createTransactionSchema.parse(request.body);
```

**Alternatives Considered**:
- ❌ **Class-based DTOs with decorators** (class-validator): Heavier runtime overhead, tight coupling
- ❌ **Validation in DTOs**: Violates separation of concerns, not shareable
- ❌ **No validation**: Unsafe, allows invalid data into system

### 8. DTO Organization: Related DTOs in One File

**Decision**: Keep related DTOs in a single file (e.g., all transaction DTOs together)

**Rationale**:
- ✅ **Cohesion**: Create, Update, Read, Query DTOs are logically related
- ✅ **Discoverability**: Easy to find all DTOs for a domain entity
- ✅ **Reduced File Clutter**: Fewer files to navigate
- ✅ **Import Simplicity**: Single import for all transaction DTOs

**When to Split**:
- File exceeds 300-500 lines
- DTOs used in completely different contexts
- Need to avoid circular dependencies

### 9. Enum Usage: Type Safety for Fixed Values

**Decision**: Use TypeScript enums for all fixed value sets

**Enums Created**:
- `TransactionStatus` - PENDING, COMPLETED, FAILED, ROLLED_BACK
- `Currency` - USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY
- `AuditAction` - CREATE, UPDATE, DELETE, READ, LOGIN, LOGOUT, ROLLBACK
- `AuditStatus` - SUCCESS, FAILED, ROLLED_BACK, PENDING
- `SortOrder` - ASC, DESC

**Benefits**:
- ✅ **Type Safety**: Prevents typos like `"asc"` vs `"ASC"`
- ✅ **Autocomplete**: IDE provides suggestions
- ✅ **Refactoring**: Rename enum value updates all usages
- ✅ **Documentation**: Self-documenting valid values
- ✅ **Validation**: Zod's `z.nativeEnum()` validates against enum

### 10. Concurrency Handling: Shared Subscription Pattern

**Decision**: Use single NATS subscription with promise resolver map for concurrent transactions

**Problem**:
- Multiple concurrent transactions need audit confirmations
- Each transaction waits for its specific confirmation (by correlationId)
- Creating a subscription per transaction is inefficient

**Solution**:
```typescript
// Single shared subscription for all audit confirmations
private pendingAuditConfirmations = new Map<string, {
  resolve: (value: boolean) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}>();

// Subscribe once, route messages to correct promise
await this.natsClient.subscribe(
  NATS_SUBJECTS.AUDIT_LOG_CREATED,
  async (msg) => {
    const correlationId = msg.correlationId;
    const pending = this.pendingAuditConfirmations.get(correlationId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.resolve(true);
      this.pendingAuditConfirmations.delete(correlationId);
    }
  }
);
```

**Benefits**:
- ✅ **Performance**: 5 concurrent transactions in 22-70ms (vs 10+ seconds with individual subscriptions)
- ✅ **Resource Efficiency**: Single subscription vs N subscriptions
- ✅ **Scalability**: Handles hundreds of concurrent transactions
- ✅ **Timeout Handling**: 10-second timeout per transaction prevents hanging

**Performance Metrics**:
- Single transaction: 10-30ms
- 5 concurrent transactions: 22-70ms
- Previous approach (individual subscriptions): 10+ seconds timeout

### 11. API Design: Unified Response Format

**Decision**: RESTful API with unified response format

**Response Format**:
```typescript
{
  success: boolean,
  data?: T,
  error?: {
    code: string,
    message: string,
    details?: any
  },
  timestamp: string,
  path: string
}
```

**Rationale**:
- **Predictability**: Clients always know response structure
- **Error Handling**: Consistent error format
- **Debugging**: Timestamp and path included
- **Type Safety**: Generic type parameter for data

## 🚀 Getting Started

### Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 16 (for local development)
- NATS Server 2.10+ (for local development)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd transaction-management-system
```

2. **Install dependencies**
```bash
npm install
```

3. **Build shared package**
```bash
npm run build --workspace=@transaction-system/shared
```

## 💻 Running Locally

### Option 1: Using Docker Compose (Recommended)

This is the easiest way to run the entire system:

```bash
# Start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

**Services will be available at**:
- Transaction View Service: http://localhost:3000
- Transaction View API Docs: http://localhost:3000/documentation
- Audit Log Service: http://localhost:3001
- Audit Log API Docs: http://localhost:3001/documentation
- NATS Server: nats://localhost:4222
- NATS Monitoring: http://localhost:8222
- PostgreSQL (Transaction DB): localhost:5432
- PostgreSQL (Audit DB): localhost:5433

### Option 2: Running Services Individually

**1. Start Infrastructure Services**

```bash
# Start PostgreSQL for Transaction Service
docker run -d \
  --name transaction-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=transaction_db \
  -p 5432:5432 \
  postgres:16-alpine

# Start PostgreSQL for Audit Service
docker run -d \
  --name audit-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=audit_log_db \
  -p 5433:5432 \
  postgres:16-alpine

# Start NATS with JetStream
docker run -d \
  --name nats-server \
  -p 4222:4222 \
  -p 8222:8222 \
  nats:2.10-alpine \
  -js -m 8222
```

**2. Setup Environment Variables**

```bash
# Transaction View Service
cp services/transaction-view-service/.env.example services/transaction-view-service/.env

# Audit Log Service
cp services/audit-log-service/.env.example services/audit-log-service/.env
```

**3. Run Database Migrations**

```bash
# Transaction View Service
cd services/transaction-view-service
npm run migration:run

# Audit Log Service
cd services/audit-log-service
npm run migration:run
```

**4. Create a Test User**

You'll need to create a user manually in the database or use the following SQL:

```sql
-- Connect to transaction_db
INSERT INTO users (id, username, email, password, created_at, updated_at)
VALUES (
  uuid_generate_v4(),
  'testuser',
  'test@example.com',
  '$2b$10$YourHashedPasswordHere', -- Use bcrypt to hash 'password123'
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);
```

Or use this Node.js script:
```javascript
const bcrypt = require('bcrypt');
bcrypt.hash('password123', 10).then(hash => console.log(hash));
```

**5. Start Services**

```bash
# Terminal 1 - Transaction View Service
cd services/transaction-view-service
npm run dev

# Terminal 2 - Audit Log Service
cd services/audit-log-service
npm run dev
```

## 🧪 Running Tests

### E2E Tests

The system includes comprehensive E2E test coverage with **41 passing tests** across 4 test suites:

```bash
# Run all E2E tests (requires Docker Compose services running)
npm run test:e2e

# Run E2E tests for specific service
cd services/transaction-view-service
npm run test:e2e

# Run with coverage
npm run test:e2e -- --coverage

# Run specific test file
npm run test:e2e -- tests/transaction.e2e.test.ts
npm run test:e2e -- tests/distributed-transaction.e2e.test.ts
npm run test:e2e -- tests/audit-verification.e2e.test.ts
npm run test:e2e -- tests/rollback-scenarios.e2e.test.ts
```

### Test Coverage Summary

**✅ 41 Tests Passing (0 Skipped, 0 Failed)**

#### 1. Transaction E2E Tests (10 tests)
- ✅ User authentication and authorization
- ✅ Full CRUD operations for transactions
- ✅ Pagination and filtering (status, currency, amount range)
- ✅ Error handling (401, 404, 400 responses)

#### 2. Distributed Transaction E2E Tests (12 tests)
- ✅ Transaction creation with audit log confirmation
- ✅ Update and delete operations with audit logs
- ✅ **5 concurrent transactions** (completes in under 70ms)
- ✅ NATS message publishing and subscription
- ✅ Pagination with concurrent operations

#### 3. Audit Verification E2E Tests (9 tests)
- ✅ Query and filter audit logs (by action, entity type, status, user)
- ✅ **One-to-one correspondence** between transactions and audit logs
- ✅ Audit log metadata completeness verification
- ✅ Timestamp accuracy verification (within 5 seconds)
- ✅ Before/after state tracking for updates
- ✅ Failed validations don't create orphaned audit logs

#### 4. Rollback and Network Failure E2E Tests (10 tests)
- ✅ **Audit service down scenario** - transaction rolls back to maintain consistency
- ✅ Service recovery and operation resumption
- ✅ Concurrent operations maintain data consistency
- ✅ Correlation ID tracking across services
- ✅ Rollback event publishing and handling


### Test Requirements

**E2E tests require Docker Compose services running**:
```bash
# Start all services for testing
docker-compose up -d

# Run tests
npm run test:e2e

# Stop services
docker-compose down
```

**Services needed**:
- PostgreSQL (Transaction DB) on localhost:5432
- PostgreSQL (Audit DB) on localhost:5433
- NATS JetStream on localhost:4222
- Transaction View Service on localhost:3000
- Audit Log Service on localhost:3001

### Test Performance

- **Total test execution time**: ~70 seconds
- **Concurrent transaction test**: 5 transactions in 22-70ms
- **Single transaction test**: 10-30ms average
- **All tests run sequentially** (`--runInBand`) to ensure data consistency

## 📚 API Documentation

### Postman Collection

A comprehensive Postman collection is included in the repository: `postman_collection.json`

**Features**:
- ✅ Pre-configured environment variables
- ✅ Automatic token extraction and storage
- ✅ Complete API coverage (41+ requests)
- ✅ Example requests for all endpoints
- ✅ Error scenario testing
- ✅ Organized into logical folders

**Import Instructions**:
1. Open Postman
2. Click "Import" button
3. Select `postman_collection.json` from the repository root
4. Collection will be imported with all requests and variables

**Collection Structure**:
- **Health Checks** - Service health endpoints
- **Authentication** - Login and user management
- **Transactions** - Full CRUD operations with filtering
- **Audit Logs** - Query and filter audit logs
- **Error Scenarios** - Test error handling

**Variables**:
- `base_url_transaction` - Transaction service URL (default: http://localhost:3000)
- `base_url_audit` - Audit service URL (default: http://localhost:3001)
- `access_token` - JWT token (auto-populated after login)
- `transaction_id` - Last created transaction ID (auto-populated)
- `correlation_id` - Correlation ID for distributed tracing

### Swagger/OpenAPI Documentation

Both services provide comprehensive, interactive API documentation with Swagger UI.

**Features**:
- ✅ **Complete Response Schemas**: All endpoints include detailed response schemas for success (200, 201, 204) and error cases (400, 401, 404, 500)
- ✅ **Request/Response Examples**: Every endpoint has realistic examples for all properties
- ✅ **Interactive Testing**: Try out API calls directly from the browser
- ✅ **Authentication Support**: Built-in JWT token management for protected endpoints
- ✅ **Detailed Descriptions**: Comprehensive documentation for all parameters, request bodies, and responses

#### Transaction View Service API

Once the service is running, visit:
- **Swagger UI**: http://localhost:3000/documentation
- **OpenAPI JSON**: http://localhost:3000/documentation/json

#### Audit Log Service API

Once the service is running, visit:
- **Swagger UI**: http://localhost:300/documentation | http://localhost:3001/documentation
- **OpenAPI JSON**: http://localhost:3001/documentation/json


```

## 🗄️ Database Schema

### Transaction View Service Database

**Users Table**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Transactions Table**
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Audit Log Service Database

**Audit Logs Table**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action VARCHAR(20) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NOT NULL,
  user_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
  metadata JSONB,
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  correlation_id VARCHAR(255) NOT NULL,
  service_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📁 Project Structure

```
transaction-management-system/
├── packages/
│   └── shared/                          # Shared types and interfaces
│       ├── src/
│       │   ├── enums/                   # Shared enums
│       │   ├── dtos/                    # Data Transfer Objects
│       │   ├── interfaces/              # Shared interfaces
│       │   ├── constants/               # Shared constants
│       │   └── index.ts
│       ├── package.json
│       └── tsconfig.json
│
├── services/
│   ├── transaction-view-service/        # Transaction management service
│   │   ├── src/
│   │   │   ├── config/                  # Configuration files
│   │   │   ├── entities/                # TypeORM entities
│   │   │   ├── repositories/            # Repository pattern implementation
│   │   │   ├── services/                # Business logic
│   │   │   ├── routes/                  # API routes
│   │   │   ├── middleware/              # Custom middleware
│   │   │   ├── plugins/                 # Fastify plugins
│   │   │   ├── validators/              # Zod schemas
│   │   │   ├── exceptions/              # Custom exceptions
│   │   │   ├── infrastructure/          # NATS client, etc.
│   │   │   ├── migrations/              # Database migrations
│   │   │   ├── app.ts                   # Fastify app setup
│   │   │   └── index.ts                 # Entry point
│   │   ├── tests/                       # E2E tests
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── audit-log-service/               # Audit logging service
│       ├── src/
│       │   ├── config/
│       │   ├── entities/
│       │   ├── repositories/
│       │   ├── services/
│       │   ├── routes/
│       │   ├── plugins/
│       │   ├── handlers/                # NATS message handlers
│       │   ├── infrastructure/
│       │   ├── migrations/
│       │   ├── app.ts
│       │   └── index.ts
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
│
├── docker-compose.yml                   # Docker Compose configuration
├── package.json                         # Root package.json (workspace)
└── README.md
```

## 🔒 Security Considerations

1. **JWT Secrets**: Change `JWT_SECRET` in production
2. **Database Credentials**: Use strong passwords and rotate regularly
3. **HTTPS**: Use HTTPS in production (add reverse proxy like Nginx)
4. **Rate Limiting**: Add rate limiting for production
5. **Input Validation**: All inputs validated with Zod
6. **SQL Injection**: Protected by TypeORM parameterized queries
7. **CORS**: Configure CORS properly for production

## 🎯 Design Patterns Used

1. **Repository Pattern**: Data access abstraction
2. **Saga Pattern**: Distributed transaction management
3. **Factory Pattern**: Service and repository instantiation
4. **Decorator Pattern**: Fastify plugins and hooks
5. **Strategy Pattern**: Different validation strategies
6. **Observer Pattern**: NATS pub/sub messaging

## 🧩 SOLID Principles Applied

- **Single Responsibility**: Each class has one reason to change
- **Open/Closed**: Extensible through inheritance and composition
- **Liskov Substitution**: Base repository can be substituted with specific ones
- **Interface Segregation**: Small, focused interfaces
- **Dependency Inversion**: Depend on abstractions (interfaces), not concretions

## 📊 Monitoring and Observability

### Health Checks
- Transaction Service: `GET http://localhost:3000/health`
- Audit Service: `GET http://localhost:3001/health`
- NATS Monitoring: `http://localhost:8222`

### Logging
- Structured logging with Pino
- Log levels: debug, info, warn, error
- Request/response logging
- Error stack traces in development

### Metrics (Future Enhancement)
- Prometheus metrics endpoint
- Grafana dashboards
- Alert rules for critical errors

## 🔒 Security

### Implemented Security Features

✅ **Authentication & Authorization**
- JWT-based authentication with `@fastify/jwt`
- Bcrypt password hashing (salt rounds: 10)
- Secure password comparison
- Token expiration (configurable, default: 24h)
- Protected routes with authentication middleware

✅ **Input Validation**
- Zod schema validation for all inputs
- Type-safe validation with TypeScript
- SQL injection protection via TypeORM parameterized queries
- UUID validation for IDs
- Enum validation for currencies and statuses

✅ **CORS Configuration**
- Environment-based allowed origins
- Production-ready CORS settings
- Credentials support for authenticated requests
- Restricted HTTP methods and headers

✅ **Rate Limiting** (NEW)
- 100 requests per 15 minutes per IP
- Prevents brute force attacks
- DDoS protection
- Configurable limits and time windows
- Graceful error handling

✅ **Secrets Management**
- Environment variable-based configuration
- No hardcoded secrets in source code
- `.env` files in `.gitignore`
- JWT secret validation (minimum 32 characters)
- Docker secrets support via environment variables

✅ **Error Handling**
- Global error handler
- No sensitive data exposure in errors
- Stack traces only in development
- Structured error logging
- Custom exception classes

✅ **Database Security**
- SSL/TLS support for connections
- Connection pooling (max: 20)
- Migration-based schema management
- User-scoped queries
- Separate databases per service

✅ **Audit Logging**
- Complete audit trail for all transactions
- Before/after state tracking
- User, IP, and user-agent tracking
- Correlation IDs for distributed tracing
- Immutable audit records

### Security Configuration

**Environment Variables** (`.env` file):
```bash
# JWT Secret - Must be at least 32 characters
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-secret-key-change-this-in-production

# CORS Allowed Origins - Comma-separated list
# Production example: ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

**Rate Limiting Configuration**:
- **Max Requests**: 100 per 15 minutes
- **Cache Size**: 10,000 IPs
- **Whitelist**: localhost (127.0.0.1)
- **Error Response**: 429 Too Many Requests

**CORS Configuration**:
- **Development**: All origins allowed
- **Production**: Only specified origins in `ALLOWED_ORIGINS`
- **Methods**: GET, POST, PUT, DELETE, PATCH
- **Headers**: Content-Type, Authorization

### Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` for documentation
2. **Rotate secrets regularly** - Especially JWT secrets in production
3. **Use HTTPS in production** - Configure reverse proxy (Nginx, Traefik)
4. **Monitor rate limit violations** - Set up alerts for suspicious activity
5. **Review audit logs** - Regular security audits of transaction history
6. **Keep dependencies updated** - Run `npm audit` regularly
7. **Use strong passwords** - Minimum 8 characters with complexity
8. **Enable database SSL** - Set `sslmode=require` in production

---

## 🚧 Future Enhancements

### High Priority

#### 1. **Message Broker Abstraction with Strategy Pattern**
**Goal**: Support multiple message brokers (NATS, Kafka, RabbitMQ) with seamless switching

**Implementation**:
```typescript
interface IMessageBroker {
  connect(): Promise<void>;
  publish(subject: string, data: any): Promise<void>;
  subscribe(subject: string, handler: Function): Promise<void>;
  disconnect(): Promise<void>;
}

class NatsMessageBroker implements IMessageBroker { /* ... */ }
class KafkaMessageBroker implements IMessageBroker { /* ... */ }
class RabbitMQMessageBroker implements IMessageBroker { /* ... */ }

// Factory pattern for broker selection
class MessageBrokerFactory {
  static create(type: 'nats' | 'kafka' | 'rabbitmq'): IMessageBroker {
    switch(type) {
      case 'nats': return new NatsMessageBroker();
      case 'kafka': return new KafkaMessageBroker();
      case 'rabbitmq': return new RabbitMQMessageBroker();
    }
  }
}
```

**Benefits**:
- **Flexibility**: Switch message brokers based on requirements (e.g., Kafka for high-throughput scenarios)
- **Vendor Independence**: Not locked into a single messaging technology
- **Testing**: Easy to mock message broker for unit tests
- **Migration**: Gradual migration from one broker to another
- **Multi-Cloud**: Use different brokers in different cloud environments

**Configuration**:
```env
MESSAGE_BROKER_TYPE=nats  # or kafka, rabbitmq
KAFKA_BROKERS=localhost:9092
RABBITMQ_URL=amqp://localhost:5672
```

**Use Cases**:
- **NATS**: Low-latency, simple pub/sub (current implementation)
- **Kafka**: High-throughput event streaming, complex event processing
- **RabbitMQ**: Complex routing, priority queues, delayed messages

---

#### 2. **Redis Caching Layer**
**Goal**: Improve read performance and reduce database load

**Implementation Areas**:
- Cache frequently accessed transactions (GET by ID)
- Cache user authentication data (reduce JWT validation overhead)
- Cache audit log queries (especially for reporting)
- Implement cache invalidation on CREATE/UPDATE/DELETE

**Strategy**:
- **Cache-Aside Pattern**: Application checks cache first, then database
- **Write-Through Pattern**: Update cache and database simultaneously
- **TTL**: 5-15 minutes for transaction data, 1 hour for audit logs

**Expected Impact**:
- 70-90% reduction in database queries for read operations
- Sub-10ms response times for cached data
- Reduced database connection pool usage

---

#### 3. **Idempotency Keys for Critical Operations**
**Goal**: Prevent duplicate transactions from network retries or client errors

**Implementation**:
```typescript
interface CreateTransactionDto {
  amount: number;
  currency: Currency;
  description?: string;
  idempotencyKey?: string;  // Client-provided unique key
}

// Store idempotency keys in Redis with 24-hour TTL
// If duplicate request detected, return original response
```

**Benefits**:
- Prevent duplicate charges from network retries
- Safe retry logic for distributed transactions
- Compliance with financial transaction standards

---

### Medium Priority

#### 4. **Rate Limiting**
**Implementation**: Use `@fastify/rate-limit` with Redis backend
- **Per User**: 100 requests/minute for authenticated users
- **Per IP**: 20 requests/minute for unauthenticated endpoints
- **Burst Protection**: Allow short bursts, then throttle

#### 5. **API Versioning**
**Implementation**: URL-based versioning (`/api/v1/transactions`, `/api/v2/transactions`)
- Maintain backward compatibility
- Gradual deprecation of old versions
- Version-specific Swagger documentation

#### 6. **Advanced Monitoring & Observability**
**Tools**: Prometheus + Grafana + Jaeger
- **Metrics**: Request latency, throughput, error rates, database query times
- **Distributed Tracing**: Track requests across microservices using correlation IDs
- **Alerting**: Automated alerts for high error rates, slow queries, service downtime

#### 7. **Event Sourcing & CQRS**
**Goal**: Full audit trail with event replay capability
- Store all state changes as immutable events
- Separate read models (optimized for queries) from write models
- Enable time-travel debugging and audit compliance

#### 8. **GraphQL API**
**Implementation**: Add GraphQL alongside REST using `mercurius`
- Flexible querying (clients request exactly what they need)
- Batch multiple operations in single request
- Real-time subscriptions for transaction updates

---

### Low Priority

#### 9. **Webhooks for External Integrations**
**Goal**: Notify external systems of transaction events
- Configurable webhook endpoints per user/organization
- Retry logic with exponential backoff
- Webhook signature verification (HMAC)
- Event types: `transaction.created`, `transaction.updated`, `transaction.completed`

#### 10. **Multi-Tenancy Support**
**Implementation**: Tenant isolation at database and application level
- Separate schemas per tenant (PostgreSQL schemas)
- Tenant-aware authentication and authorization
- Tenant-specific configuration and rate limits

#### 11. **Soft Deletes**
**Implementation**: Add `deletedAt` timestamp instead of hard deletes
- Maintain data integrity for audit purposes
- Enable "undo" functionality
- Comply with data retention policies

#### 12. **Data Encryption at Rest**
**Implementation**: Encrypt sensitive fields (amounts, descriptions, metadata)
- Use PostgreSQL `pgcrypto` extension or application-level encryption
- Key rotation strategy
- Compliance with PCI-DSS, GDPR requirements

#### 13. **Advanced Search with Elasticsearch**
**Goal**: Full-text search across transactions and audit logs
- Index transactions and audit logs in Elasticsearch
- Support complex queries (fuzzy search, aggregations, facets)
- Real-time indexing via NATS events

#### 14. **Scheduled Jobs & Background Processing**
**Implementation**: Use `node-cron` or Bull queue
- Daily transaction reconciliation
- Automated report generation
- Cleanup of old audit logs
- Retry failed distributed transactions

#### 15. **API Gateway**
**Implementation**: Add Kong or custom Fastify gateway
- Single entry point for all services
- Centralized authentication and rate limiting
- Request/response transformation
- API composition (combine multiple service calls)

---

### Performance Optimizations

#### 16. **Database Query Optimization**
- Add composite indexes for common query patterns
- Implement database connection pooling tuning
- Use materialized views for complex audit queries
- Partition large tables by date (audit logs)

#### 17. **Horizontal Scaling**
- Stateless service design (already implemented)
- Load balancer configuration (Nginx/HAProxy)
- Database read replicas for read-heavy workloads
- NATS clustering for high availability

#### 18. **Compression & Minification**
- Enable gzip/brotli compression for API responses
- Optimize JSON payload sizes
- Use Protocol Buffers for inter-service communication (instead of JSON)

---

### Security Enhancements

#### 19. **Security Headers with Helmet** (Medium Priority)
**Goal**: Add comprehensive security headers to prevent common web vulnerabilities
- Content Security Policy (CSP) to prevent XSS
- X-Frame-Options for clickjacking protection
- X-Content-Type-Options to prevent MIME sniffing
- HSTS (HTTP Strict Transport Security)
- Referrer Policy control

**Implementation**:
```typescript
import helmet from '@fastify/helmet';
await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
});
```

#### 20. **Token Refresh Mechanism** (Medium Priority)
**Goal**: Implement refresh tokens for better security
- Short-lived access tokens (15 minutes)
- Long-lived refresh tokens (7 days)
- Token rotation on each refresh
- Database-backed refresh token storage for revocation
- Improved user experience (stay logged in)

#### 21. **Request Size Limits** (Medium Priority)
**Goal**: Prevent DoS attacks via large payloads
- Configure body size limits (default: 1MB)
- Per-route limits for file uploads
- Prevent memory exhaustion attacks

#### 22. **Password Strength Requirements** (Low Priority)
**Goal**: Enforce strong password policies
- Minimum 8 characters (currently 6)
- Require uppercase, lowercase, number, special character
- Password complexity validation with Zod regex
- Compliance with security standards (PCI DSS, GDPR)

#### 23. **Two-Factor Authentication (2FA)** (Low Priority)
**Goal**: Add second authentication factor
- TOTP-based 2FA using speakeasy
- QR code generation for authenticator apps
- Backup codes for account recovery
- Required for financial applications

#### 24. **Account Lockout** (Medium Priority)
**Goal**: Prevent brute force attacks on login
- Lock account after 5 failed attempts
- 15-minute lockout period
- Track failed login attempts in database
- Email notification on account lockout

#### 25. **API Key Authentication** (Low Priority)
**Goal**: Service-to-service authentication
- Generate API keys for external services
- Per-service rate limiting
- Audit trail for service-to-service calls
- Key rotation and revocation

#### 26. **IP Whitelisting** (Low Priority)
**Goal**: Restrict admin endpoints to trusted IPs
- Configurable IP whitelist
- CIDR notation support
- Reduce attack surface for sensitive endpoints

#### 27. **Security Monitoring & Alerts** (Medium Priority)
**Goal**: Real-time security event monitoring
- Failed login attempt tracking
- Rate limit violation alerts
- Unusual transaction pattern detection
- Integration with Slack/PagerDuty/CloudWatch

#### 28. **Dependency Vulnerability Scanning** (Medium Priority)
**Goal**: Automated security scanning
- npm audit integration in CI/CD
- Snyk or GitHub Dependabot
- Automated pull requests for security updates
- Regular security audits

#### 29. **HTTPS/TLS Configuration** (High Priority for Production)
**Goal**: Encrypt all traffic in production
- Nginx/Traefik reverse proxy with SSL
- TLS 1.2+ only
- Strong cipher suites
- SSL certificate management (Let's Encrypt)

#### 30. **Penetration Testing** (High Priority before Production)
**Goal**: Professional security assessment
- OWASP ZAP automated scanning
- Burp Suite manual testing
- SQL injection testing with SQLMap
- Authentication bypass attempts
- XSS vulnerability scanning

#### 31. **Advanced Authentication & Authorization**
- OAuth 2.0 / OpenID Connect integration
- Role-Based Access Control (RBAC)
- Permission-based authorization (e.g., `transaction:read`, `transaction:write`)
- Fine-grained access control

#### 32. **Secrets Management**
- HashiCorp Vault integration
- AWS Secrets Manager
- Azure Key Vault
- Automated secret rotation
- Centralized secrets management

---

### DevOps & Infrastructure

#### 21. **CI/CD Pipeline**
- Automated testing on every commit (GitHub Actions / GitLab CI)
- Automated deployment to staging/production
- Blue-green deployments for zero-downtime updates
- Automated rollback on deployment failures

#### 22. **Infrastructure as Code**
- Terraform for cloud infrastructure provisioning
- Kubernetes manifests for container orchestration
- Helm charts for application deployment

#### 23. **Disaster Recovery**
- Automated database backups (daily full, hourly incremental)
- Cross-region replication for high availability
- Documented recovery procedures (RTO/RPO targets)
- Regular disaster recovery drills

---


## 👥 Authors

- Ahmed Essam - Backend Engineer

---

**Built with ❤️ using Node.js, TypeScript, and Fastify**
