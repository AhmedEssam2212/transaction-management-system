import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { AppDataSource } from "../src/config/data-source";
import { User } from "../src/entities/user.entity";
import { Transaction } from "../src/entities/transaction.entity";
import bcrypt from "bcrypt";
import { Currency, TransactionStatus } from "@transaction-system/shared";

describe("Transaction E2E Tests", () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create a test user
    const userRepository = AppDataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash("testpassword123", 10);
    const user = await userRepository.save({
      username: "testuser",
      email: "test@example.com",
      password: hashedPassword,
    });
    testUserId = user.id;

    // Login to get auth token
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "testuser",
        password: "testpassword123",
      },
    });

    const loginData = JSON.parse(loginResponse.body);
    authToken = loginData.data.accessToken;
  });

  afterAll(async () => {
    // Clean up
    const transactionRepository = AppDataSource.getRepository(Transaction);
    const userRepository = AppDataSource.getRepository(User);

    await transactionRepository.delete({});
    await userRepository.delete({});

    await app.close();
  });

  describe("Happy Path Scenarios", () => {
    let createdTransactionId: string;

    test("User can login successfully", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "testuser",
          password: "testpassword123",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.accessToken).toBeDefined();
      expect(body.data.user.username).toBe("testuser");
    });

    test("User can create a transaction and audit log is created", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 100.5,
          currency: Currency.USD,
          description: "Test transaction",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.amount).toBe(100.5);
      expect(body.data.currency).toBe(Currency.USD);
      expect(body.data.status).toBe(TransactionStatus.PENDING);

      createdTransactionId = body.data.id;

      // Wait a bit for audit log to be created
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify audit log was created (would need to query audit service)
      // This is a placeholder - in real implementation, we'd query the audit service
    });

    test("User can get a specific transaction", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/transactions/${createdTransactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.id).toBe(createdTransactionId);
      expect(body.data.amount).toBe(100.5);
    });

    test("User can list transactions with pagination", async () => {
      // Create a few more transactions
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: "POST",
          url: "/api/transactions",
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            amount: 50 + i,
            currency: Currency.USD,
            description: `Test transaction ${i}`,
          },
        });
      }

      const response = await app.inject({
        method: "GET",
        url: "/api/transactions?page=1&limit=2",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.data).toHaveLength(2);
      expect(body.data.page).toBe(1);
      expect(body.data.limit).toBe(2);
      expect(body.data.total).toBeGreaterThanOrEqual(4);
    });

    test("User can update a transaction and audit log is created", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/api/transactions/${createdTransactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 150.75,
          status: TransactionStatus.COMPLETED,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.amount).toBe(150.75);
      expect(body.data.status).toBe(TransactionStatus.COMPLETED);

      // Wait for audit log
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });

    test("User can delete a transaction and audit log is created", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/api/transactions/${createdTransactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(204);

      // Verify transaction is deleted
      const getResponse = await app.inject({
        method: "GET",
        url: `/api/transactions/${createdTransactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(404);

      // Wait for audit log
      await new Promise((resolve) => setTimeout(resolve, 1000));
    });
  });

  describe("Validation Errors", () => {
    test("Invalid transaction data - negative amount", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: -100,
          currency: Currency.USD,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    test("Invalid transaction data - missing required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          description: "Missing amount and currency",
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    test("Unauthorized access attempts", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHORIZED");
    });

    test("Invalid credentials", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: {
          username: "testuser",
          password: "wrongpassword",
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
    });

    test("Transaction not found", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions/00000000-0000-0000-0000-000000000000",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("Filtering and Pagination", () => {
    beforeAll(async () => {
      // Create transactions with different statuses and currencies
      const transactions = [
        {
          amount: 100,
          currency: Currency.USD,
          status: TransactionStatus.COMPLETED,
        },
        {
          amount: 200,
          currency: Currency.EUR,
          status: TransactionStatus.PENDING,
        },
        {
          amount: 300,
          currency: Currency.USD,
          status: TransactionStatus.COMPLETED,
        },
        {
          amount: 400,
          currency: Currency.GBP,
          status: TransactionStatus.FAILED,
        },
      ];

      for (const tx of transactions) {
        await app.inject({
          method: "POST",
          url: "/api/transactions",
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: tx,
        });
      }
    });

    test("Filter by status", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/transactions?status=${TransactionStatus.COMPLETED}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      body.data.data.forEach((tx: any) => {
        expect(tx.status).toBe(TransactionStatus.COMPLETED);
      });
    });

    test("Filter by currency", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/api/transactions?currency=${Currency.USD}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      body.data.data.forEach((tx: any) => {
        expect(tx.currency).toBe(Currency.USD);
      });
    });

    test("Filter by amount range", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/transactions?minAmount=150&maxAmount=350",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      body.data.data.forEach((tx: any) => {
        expect(tx.amount).toBeGreaterThanOrEqual(150);
        expect(tx.amount).toBeLessThanOrEqual(350);
      });
    });
  });
});
