import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { envConfig } from "./config/env.config";
import { AppDataSource } from "./config/data-source";
import { errorHandlerPlugin, responseInterceptorPlugin } from "./plugins";
import { registerRoutes } from "./routes";
import { AuditLogRepository } from "./repositories";
import { AuditLogService } from "./services";
import { natsClient } from "./infrastructure/nats.client";
import { AuditLogHandler } from "./handlers";
import { AuditLog } from "./entities";

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

  await fastify.register(swagger, {
    swagger: {
      info: {
        title: "Audit Log Service API",
        description: "API documentation for Security Audit Log Service",
        version: "1.0.0",
      },
      host: `localhost:${envConfig.port}`,
      schemes: ["http"],
      consumes: ["application/json"],
      produces: ["application/json"],
      tags: [
        { name: "Audit Logs", description: "Audit log management endpoints" },
      ],
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

    fastify.log.info("Running database migrations...");
    const migrations = await AppDataSource.runMigrations();
    if (migrations.length > 0) {
      fastify.log.info(`Successfully ran ${migrations.length} migration(s)`);
    } else {
      fastify.log.info("No migrations to run");
    }
  }

  await natsClient.connect();

  const auditLogRepository = new AuditLogRepository(
    AppDataSource.getRepository(AuditLog)
  );

  const auditLogService = new AuditLogService(auditLogRepository);

  fastify.decorate("auditLogService", auditLogService);

  const auditLogHandler = new AuditLogHandler(
    auditLogService,
    natsClient,
    fastify.log
  );
  await auditLogHandler.setupHandlers();

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
