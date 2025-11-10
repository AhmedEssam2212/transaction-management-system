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
- Enums (TransactionStatus, Currency, AuditAction, AuditStatus)
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
2. **Timeout Handling**: 5-second timeout for audit confirmation (prevents hanging)
3. **Compensation Logic**: Rollback events trigger cleanup in both services
4. **Event Subjects**:
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

**Trade-offs**:
- ⚠️ **Complexity**: More complex than simple REST calls
- ⚠️ **Latency**: Additional network round-trip for confirmation
- ⚠️ **Debugging**: Distributed tracing needed for troubleshooting
- ⚠️ **Testing**: Requires testing of failure scenarios and timeouts

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

### 7. API Design

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

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests for specific service
cd services/transaction-view-service
npm run test:e2e

# Run with coverage
npm run test:e2e -- --coverage

# Run specific test file
npm run test:e2e -- tests/transaction.e2e.test.ts
```

### Unit Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

**Note**: E2E tests require:
- PostgreSQL running on localhost:5432
- NATS running on localhost:4222
- Or use Docker Compose test environment

## 📚 API Documentation

### Transaction View Service API

Once the service is running, visit:
- **Swagger UI**: http://localhost:3000/documentation
- **OpenAPI JSON**: http://localhost:3000/documentation/json

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user

#### Transactions
- `POST /api/transactions` - Create transaction
- `GET /api/transactions` - List transactions (with filters)
- `GET /api/transactions/:id` - Get transaction by ID
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Audit Log Service API

Once the service is running, visit:
- **Swagger UI**: http://localhost:3001/documentation
- **OpenAPI JSON**: http://localhost:3001/documentation/json

### Key Endpoints

#### Audit Logs
- `POST /api/audit-logs` - Create audit log (internal use)
- `GET /api/audit-logs` - Query audit logs
- `GET /api/audit-logs/:id` - Get audit log by ID
- `GET /api/audit-logs/correlation/:correlationId` - Get logs by correlation ID
- `GET /api/audit-logs/entity/:entityType/:entityId` - Get logs by entity

### Example API Usage

**1. Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**2. Create Transaction**
```bash
curl -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "amount": 100.50,
    "currency": "USD",
    "description": "Test transaction"
  }'
```

**3. List Transactions**
```bash
curl -X GET "http://localhost:3000/api/transactions?page=1&limit=10&status=COMPLETED" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**4. Query Audit Logs**
```bash
curl -X GET "http://localhost:3001/api/audit-logs?entityType=Transaction&action=CREATE" \
  -H "Content-Type: application/json"
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

## 🚧 Future Enhancements

1. **Caching**: Add Redis for frequently accessed data
2. **Rate Limiting**: Implement rate limiting per user/IP
3. **Idempotency**: Add idempotency keys for critical operations
4. **Event Sourcing**: Full event sourcing for audit trail
5. **CQRS**: Separate read and write models
6. **GraphQL**: Add GraphQL API alongside REST
7. **Webhooks**: Notify external systems of events
8. **Multi-tenancy**: Support multiple organizations
9. **Soft Deletes**: Implement soft delete for transactions
10. **Data Encryption**: Encrypt sensitive data at rest

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 👥 Authors

- Backend Engineer - Initial implementation

## 🙏 Acknowledgments

- Fastify team for the excellent framework
- NATS team for the reliable messaging system
- TypeORM team for the powerful ORM
- The Node.js and TypeScript communities

---

**Built with ❤️ using Node.js, TypeScript, and Fastify**
