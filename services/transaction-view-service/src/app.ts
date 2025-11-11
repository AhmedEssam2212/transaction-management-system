import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { envConfig } from "./config/env.config";
import { AppDataSource } from "./config/data-source";
import { errorHandlerPlugin, responseInterceptorPlugin } from "./plugins";
import { registerRoutes } from "./routes";
import { UserRepository, TransactionRepository } from "./repositories";
import { AuthService, TransactionService } from "./services";
import { natsClient } from "./infrastructure/nats.client";
import { authMiddleware } from "./middleware";
import { User, Transaction } from "./entities";

export async function buildApp(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: envConfig.nodeEnv === "development" ? "debug" : "info",
      transport:
        envConfig.nodeEnv === "development"
          ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
          : undefined,
    },
    ajv: {
      customOptions: {
        removeAdditional: false,
        useDefaults: true,
        coerceTypes: false,
        allErrors: true,
      },
      plugins: [
        function (ajv: any) {
          ajv.addKeyword("example");
        },
      ],
    },
  });

  await fastify.register(cors, {
    origin:
      envConfig.nodeEnv === "production" ? envConfig.cors.allowedOrigins : true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Rate limiting to prevent brute force and DDoS attacks
  await fastify.register(rateLimit, {
    max: 100, // Maximum 100 requests
    timeWindow: "15 minutes", // Per 15 minutes
    cache: 10000, // Cache up to 10,000 different IPs
    allowList: ["127.0.0.1"], // Whitelist localhost for development
    redis: undefined, // Use in-memory store (upgrade to Redis for production)
    skipOnError: true, // Don't block requests if rate limiter fails
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please try again later.",
    }),
  });

  await fastify.register(jwt, {
    secret: envConfig.jwt.secret,
  });

  fastify.decorate("authenticate", authMiddleware);

  await fastify.register(swagger, {
    swagger: {
      info: {
        title: "Transaction View Service API",
        description: "API documentation for Transaction View Service",
        version: "1.0.0",
      },
      host: `localhost:${envConfig.port}`,
      schemes: ["http"],
      consumes: ["application/json"],
      produces: ["application/json"],
      tags: [
        { name: "Authentication", description: "Authentication endpoints" },
        {
          name: "Transactions",
          description: "Transaction management endpoints",
        },
      ],
      securityDefinitions: {
        bearerAuth: {
          type: "apiKey",
          name: "Authorization",
          in: "header",
          description: "Enter your bearer token in the format: Bearer <token>",
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: "/documentation",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  await fastify.register(responseInterceptorPlugin);
  await fastify.register(errorHandlerPlugin);

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    fastify.log.info("Database connected");

    // Run migrations
    fastify.log.info("Running database migrations...");
    const migrations = await AppDataSource.runMigrations();
    if (migrations.length > 0) {
      fastify.log.info(`Successfully ran ${migrations.length} migration(s)`);
    } else {
      fastify.log.info("No migrations to run");
    }
  }

  await natsClient.connect();

  const userRepository = new UserRepository(AppDataSource.getRepository(User));
  const transactionRepository = new TransactionRepository(
    AppDataSource.getRepository(Transaction)
  );

  const authService = new AuthService(userRepository);
  const transactionService = new TransactionService(
    transactionRepository,
    natsClient,
    AppDataSource
  );

  fastify.decorate("authService", authService);
  fastify.decorate("transactionService", transactionService);
  fastify.decorate("userRepository", userRepository);

  await registerRoutes(fastify);

  const closeGracefully = async (signal: string) => {
    fastify.log.info(`Received ${signal}, closing gracefully`);
    await natsClient.close();
    await AppDataSource.destroy();
    await fastify.close();
    process.exit(0);
  };

  process.on("SIGINT", () => closeGracefully("SIGINT"));
  process.on("SIGTERM", () => closeGracefully("SIGTERM"));

  return fastify;
}
