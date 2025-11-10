import "reflect-metadata";
import { buildApp } from "./app";
import { envConfig } from "./config/env.config";

async function start() {
  try {
    const app = await buildApp();

    await app.listen({
      port: envConfig.port,
      host: "0.0.0.0",
    });

    app.log.info("🚀 Audit Log Service is running!");
    app.log.info(
      `📝 API Documentation: http://localhost:${envConfig.port}/documentation`
    );
    app.log.info(`🏥 Health Check: http://localhost:${envConfig.port}/health`);
  } catch (error) {
    // If app is not initialized, create a basic logger
    const logger =
      error instanceof Error && "log" in error ? (error as any).log : console;

    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
  }
}

start();
