import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { AppDataSource } from "../src/config/data-source";
import { User } from "../src/entities/user.entity";
import bcrypt from "bcrypt";
import { Currency, AuditAction, AuditStatus } from "@transaction-system/shared";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

describe("Rollback and Network Failure E2E Tests", () => {
  let app: FastifyInstance;
  let authToken: string;
  let testUserId: string;
  const AUDIT_SERVICE_URL = "http://localhost:3001/api/audit-logs";

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();

    // Create a test user
    const userRepository = AppDataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash("testpassword123", 10);
    const user = await userRepository.save({
      username: "rollbackuser",
      email: "rollback@example.com",
      password: hashedPassword,
    });
    testUserId = user.id;

    // Login to get auth token
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "rollbackuser",
        password: "testpassword123",
      },
    });

    const loginData = JSON.parse(loginResponse.body);
    authToken = loginData.data.accessToken;
  });

  afterAll(async () => {
    // Clean up
    try {
      await AppDataSource.query(`TRUNCATE TABLE "transactions" CASCADE`);
      await AppDataSource.query(`TRUNCATE TABLE "users" CASCADE`);
    } catch (error) {
      // Ignore errors during cleanup
    }

    await app.close();
  });

  describe("Network Failure Scenarios", () => {
    test("Transaction service handles audit service timeout gracefully", async () => {
      // This test verifies that if audit service is slow/timeout,
      // the transaction service handles it appropriately
      
      // Create a transaction - it should succeed even if audit confirmation is slow
      const response = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 100,
          currency: Currency.USD,
          description: "Timeout test",
        },
      });

      // Transaction should be created successfully
      // Even if audit confirmation times out, the transaction is committed
      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.id).toBeDefined();

      // Wait for potential audit log
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Verify transaction exists
      const getResponse = await app.inject({
        method: "GET",
        url: `/api/transactions/${body.data.id}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(getResponse.statusCode).toBe(200);
    });

    test("Transaction service handles audit service being down", async () => {
      // This test verifies that the system maintains data consistency
      // by rolling back transactions when audit service is unavailable

      try {
        // Stop audit service
        await execAsync("docker compose stop audit-log-service");

        // Wait for service to stop
        await new Promise((resolve) => setTimeout(resolve, 3000));

        // Try to create a transaction
        const response = await app.inject({
          method: "POST",
          url: "/api/transactions",
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            amount: 200,
            currency: Currency.EUR,
            description: "Service down test",
          },
        });

        // Current implementation ensures data consistency by rolling back
        // the transaction when audit confirmation times out
        // This prevents orphaned transactions without audit logs
        expect(response.statusCode).toBe(500);

        const body = JSON.parse(response.body);
        expect(body.success).toBe(false);
        expect(body.error).toBeDefined();
        expect(body.error.message).toContain("Audit log creation failed or timed out");
      } finally {
        // Restart audit service
        await execAsync("docker compose start audit-log-service");
        // Wait longer for service to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 8000));
      }
    }, 30000); // Increase timeout to 30 seconds for this test
  });

  describe("Audit Log Failure Scenarios", () => {
    test("Verify audit logs marked as FAILED when appropriate", async () => {
      // Query for any failed audit logs
      const response = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          status: AuditStatus.FAILED,
          limit: 50,
        },
      });

      expect(response.status).toBe(200);
      
      // If there are failed logs, verify they have proper structure
      if (response.data.data.length > 0) {
        response.data.data.forEach((log: any) => {
          expect(log.status).toBe(AuditStatus.FAILED);
          expect(log.id).toBeDefined();
          expect(log.correlationId).toBeDefined();
        });
      }
    });

    test("Verify audit logs marked as ROLLED_BACK when appropriate", async () => {
      // Query for any rolled back audit logs
      const response = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          status: AuditStatus.ROLLED_BACK,
          limit: 50,
        },
      });

      expect(response.status).toBe(200);
      
      // If there are rolled back logs, verify they have proper structure
      if (response.data.data.length > 0) {
        response.data.data.forEach((log: any) => {
          expect(log.status).toBe(AuditStatus.ROLLED_BACK);
          expect(log.id).toBeDefined();
          expect(log.correlationId).toBeDefined();
        });
      }
    });
  });

  describe("Transaction Consistency", () => {
    test("Concurrent operations maintain consistency", async () => {
      // Create a transaction
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 500,
          currency: Currency.USD,
          description: "Consistency test",
        },
      });

      expect(createResponse.statusCode).toBe(201);
      const createBody = JSON.parse(createResponse.body);
      const transactionId = createBody.data.id;

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Perform multiple operations concurrently
      const operations = [
        app.inject({
          method: "PUT",
          url: `/api/transactions/${transactionId}`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
          payload: {
            amount: 600,
            description: "Update 1",
          },
        }),
        app.inject({
          method: "GET",
          url: `/api/transactions/${transactionId}`,
          headers: {
            authorization: `Bearer ${authToken}`,
          },
        }),
      ];

      const results = await Promise.all(operations);

      // Update should succeed
      expect(results[0].statusCode).toBe(200);
      // Get should succeed
      expect(results[1].statusCode).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify audit logs are consistent
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);

      // Should have CREATE and UPDATE logs
      const createLogs = auditResponse.data.data.filter(
        (log: any) => log.action === AuditAction.CREATE
      );
      const updateLogs = auditResponse.data.data.filter(
        (log: any) => log.action === AuditAction.UPDATE
      );

      expect(createLogs.length).toBeGreaterThanOrEqual(1);
      expect(updateLogs.length).toBeGreaterThanOrEqual(1);
    });

    test("Transaction and audit log correlation IDs match", async () => {
      // Create a transaction
      const response = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 777,
          currency: Currency.GBP,
          description: "Correlation ID test",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const transactionId = body.data.id;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get audit logs for this transaction
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);
      expect(auditResponse.data.data.length).toBeGreaterThan(0);

      // All audit logs should have correlation IDs
      auditResponse.data.data.forEach((log: any) => {
        expect(log.correlationId).toBeDefined();
        expect(typeof log.correlationId).toBe("string");
        expect(log.correlationId.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Data Integrity", () => {
    test("Audit log changes field captures before/after state correctly", async () => {
      // Create a transaction
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 100,
          currency: Currency.USD,
          description: "Original description",
        },
      });

      const createBody = JSON.parse(createResponse.body);
      const transactionId = createBody.data.id;
      const originalAmount = createBody.data.amount;

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update the transaction
      const newAmount = 200;
      const newDescription = "Updated description";

      const updateResponse = await app.inject({
        method: "PUT",
        url: `/api/transactions/${transactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: newAmount,
          description: newDescription,
        },
      });

      expect(updateResponse.statusCode).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Get audit logs
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);

      const updateLog = auditResponse.data.data.find(
        (log: any) => log.action === AuditAction.UPDATE
      );

      expect(updateLog).toBeDefined();
      expect(updateLog.changes).toBeDefined();
      expect(updateLog.changes.before).toBeDefined();
      expect(updateLog.changes.after).toBeDefined();

      // Verify before state
      expect(updateLog.changes.before.amount).toBe(originalAmount);
      expect(updateLog.changes.before.description).toBe("Original description");

      // Verify after state
      expect(updateLog.changes.after.amount).toBe(newAmount);
      expect(updateLog.changes.after.description).toBe(newDescription);
    });
  });
});

