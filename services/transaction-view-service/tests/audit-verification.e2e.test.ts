import { FastifyInstance } from "fastify";
import { buildApp } from "../src/app";
import { AppDataSource } from "../src/config/data-source";
import { User } from "../src/entities/user.entity";
import bcrypt from "bcrypt";
import { Currency, AuditAction, AuditStatus } from "@transaction-system/shared";
import axios from "axios";

describe("Audit Log Verification E2E Tests", () => {
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
      username: "auditverifyuser",
      email: "auditverify@example.com",
      password: hashedPassword,
    });
    testUserId = user.id;

    // Login to get auth token
    const loginResponse = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: {
        username: "auditverifyuser",
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

  describe("Audit Log Query and Filter", () => {
    let transactionId: string;
    let correlationId: string;

    beforeAll(async () => {
      // Create a transaction to generate audit logs
      const response = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 500,
          currency: Currency.USD,
          description: "Audit query test transaction",
        },
      });

      const body = JSON.parse(response.body);
      transactionId = body.data.id;

      // Wait for audit log to be created
      await new Promise((resolve) => setTimeout(resolve, 2000));
    });

    test("Can query audit logs from audit service", async () => {
      const response = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          page: 1,
          limit: 10,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toBeDefined();
      expect(response.data.data.data).toBeDefined();
      expect(Array.isArray(response.data.data.data)).toBe(true);
      expect(response.data.data.total).toBeGreaterThan(0);
    });

    test("Can filter audit logs by entity type", async () => {
      const response = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          entityType: "Transaction",
          limit: 50,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.data).toBeDefined();
      if (response.data.data.data.length > 0) {
        response.data.data.data.forEach((log: any) => {
          expect(log.entityType).toBe("Transaction");
        });
      }
    });

    test("Can filter audit logs by action", async () => {
      const response = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          action: AuditAction.CREATE,
          limit: 50,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.data).toBeDefined();
      if (response.data.data.data.length > 0) {
        response.data.data.data.forEach((log: any) => {
          expect(log.action).toBe(AuditAction.CREATE);
        });
      }
    });

    test("Can filter audit logs by status", async () => {
      const response = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          status: AuditStatus.SUCCESS,
          limit: 50,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.data).toBeDefined();
      if (response.data.data.data.length > 0) {
        response.data.data.data.forEach((log: any) => {
          expect(log.status).toBe(AuditStatus.SUCCESS);
        });
      }
    });

    test("Can get audit logs by entity ID", async () => {
      const response = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.data)).toBe(true);
      if (response.data.data.length > 0) {
        response.data.data.forEach((log: any) => {
          expect(log.entityId).toBe(transactionId);
          expect(log.entityType).toBe("Transaction");
        });
      }
    });

    test("Can filter audit logs by user ID", async () => {
      const response = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          userId: testUserId,
          limit: 50,
        },
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.data).toBeDefined();
      if (response.data.data.data.length > 0) {
        response.data.data.data.forEach((log: any) => {
          expect(log.userId).toBe(testUserId);
        });
      }
    });
  });

  describe("Audit Log Consistency Verification", () => {
    test("Every successful transaction has exactly one corresponding CREATE audit log", async () => {
      // Create a transaction
      const txResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 123.45,
          currency: Currency.EUR,
          description: "Consistency test",
        },
      });

      expect(txResponse.statusCode).toBe(201);
      const txBody = JSON.parse(txResponse.body);
      const transactionId = txBody.data.id;

      // Wait for audit log
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query audit logs for this transaction
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.status).toBe(200);
      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);

      const createLogs = auditResponse.data.data.filter(
        (log: any) => log.action === AuditAction.CREATE
      );

      // Should have exactly one CREATE audit log
      expect(createLogs).toHaveLength(1);
      expect(createLogs[0].status).toBe(AuditStatus.SUCCESS);
      expect(createLogs[0].entityId).toBe(transactionId);
    });

    test("Update transaction creates exactly one UPDATE audit log", async () => {
      // Create a transaction
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 200,
          currency: Currency.GBP,
          description: "Update audit test",
        },
      });

      const createBody = JSON.parse(createResponse.body);
      const transactionId = createBody.data.id;

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update the transaction
      const updateResponse = await app.inject({
        method: "PUT",
        url: `/api/transactions/${transactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 250,
          description: "Updated for audit test",
        },
      });

      expect(updateResponse.statusCode).toBe(200);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query audit logs
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);

      const updateLogs = auditResponse.data.data.filter(
        (log: any) => log.action === AuditAction.UPDATE
      );

      // Should have exactly one UPDATE audit log
      expect(updateLogs).toHaveLength(1);
      expect(updateLogs[0].status).toBe(AuditStatus.SUCCESS);
      expect(updateLogs[0].changes).toBeDefined();
      expect(updateLogs[0].changes.before).toBeDefined();
      expect(updateLogs[0].changes.after).toBeDefined();
    });

    test("Delete transaction creates exactly one DELETE audit log", async () => {
      // Create a transaction
      const createResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 300,
          currency: Currency.USD,
          description: "Delete audit test",
        },
      });

      const createBody = JSON.parse(createResponse.body);
      const transactionId = createBody.data.id;

      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Delete the transaction
      const deleteResponse = await app.inject({
        method: "DELETE",
        url: `/api/transactions/${transactionId}`,
        headers: {
          authorization: `Bearer ${authToken}`,
        },
      });

      expect(deleteResponse.statusCode).toBe(204);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query audit logs
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);

      const deleteLogs = auditResponse.data.data.filter(
        (log: any) => log.action === AuditAction.DELETE
      );

      // Should have exactly one DELETE audit log
      expect(deleteLogs).toHaveLength(1);
      expect(deleteLogs[0].status).toBe(AuditStatus.SUCCESS);
    });

    test("Audit log contains all required metadata", async () => {
      // Create a transaction
      const txResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 999.99,
          currency: Currency.USD,
          description: "Metadata test",
        },
      });

      const txBody = JSON.parse(txResponse.body);
      const transactionId = txBody.data.id;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query audit logs
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);

      const createLog = auditResponse.data.data.find(
        (log: any) => log.action === AuditAction.CREATE
      );

      expect(createLog).toBeDefined();
      expect(createLog.id).toBeDefined();
      expect(createLog.action).toBe(AuditAction.CREATE);
      expect(createLog.entityType).toBe("Transaction");
      expect(createLog.entityId).toBe(transactionId);
      expect(createLog.userId).toBe(testUserId);
      expect(createLog.status).toBe(AuditStatus.SUCCESS);
      expect(createLog.correlationId).toBeDefined();
      expect(createLog.serviceName).toBe("transaction-view-service");
      expect(createLog.createdAt).toBeDefined();
      expect(createLog.metadata).toBeDefined();
    });

    test("Audit log timestamps are accurate", async () => {
      const beforeCreate = new Date();

      // Create a transaction
      const txResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: 111.11,
          currency: Currency.EUR,
          description: "Timestamp test",
        },
      });

      const afterCreate = new Date();
      const txBody = JSON.parse(txResponse.body);
      const transactionId = txBody.data.id;

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query audit logs
      const auditResponse = await axios.get(
        `${AUDIT_SERVICE_URL}/entity/Transaction/${transactionId}`
      );

      expect(auditResponse.data.success).toBe(true);
      expect(Array.isArray(auditResponse.data.data)).toBe(true);

      const createLog = auditResponse.data.data.find(
        (log: any) => log.action === AuditAction.CREATE
      );

      expect(createLog).toBeDefined();
      const auditTimestamp = new Date(createLog.createdAt);

      // Audit log timestamp should be within reasonable range
      // Allow 5 seconds before and 10 seconds after for processing time
      expect(auditTimestamp.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime() - 5000
      );
      expect(auditTimestamp.getTime()).toBeLessThanOrEqual(
        afterCreate.getTime() + 10000
      );
    });

    test("Failed validation does not create audit log", async () => {
      // Attempt to create invalid transaction
      const txResponse = await app.inject({
        method: "POST",
        url: "/api/transactions",
        headers: {
          authorization: `Bearer ${authToken}`,
        },
        payload: {
          amount: -500, // Invalid
          currency: Currency.USD,
        },
      });

      expect(txResponse.statusCode).toBe(400);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Query recent audit logs for this user
      const auditResponse = await axios.get(AUDIT_SERVICE_URL, {
        params: {
          userId: testUserId,
          limit: 50,
        },
      });

      expect(auditResponse.data.success).toBe(true);
      expect(auditResponse.data.data.data).toBeDefined();

      // Check that no audit log exists for negative amount transaction
      const invalidLogs = auditResponse.data.data.data.filter((log: any) => {
        return (
          log.metadata &&
          log.metadata.amount &&
          log.metadata.amount < 0
        );
      });

      expect(invalidLogs).toHaveLength(0);
    });
  });
});

