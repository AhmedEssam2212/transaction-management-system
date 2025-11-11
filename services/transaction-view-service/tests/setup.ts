import { AppDataSource } from "../src/config/data-source";

beforeAll(async () => {
  // Initialize database connection
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  // Drop and recreate database to ensure clean state
  // This handles any leftover data from previous failed test runs
  await AppDataSource.dropDatabase();
  await AppDataSource.synchronize();

  // Run migrations to set up the schema properly
  try {
    await AppDataSource.runMigrations();
  } catch (error) {
    // Migrations might fail if already run, that's okay
    console.log("Migration warning (can be ignored):", (error as Error).message);
  }

  console.log(
    "E2E Test setup complete - Database initialized with clean state"
  );
});

afterAll(async () => {
  // Clean up database and close connection
  if (AppDataSource.isInitialized) {
    // Drop database to clean up test data
    await AppDataSource.dropDatabase();
    await AppDataSource.destroy();
  }

  console.log("E2E Test teardown complete - Database cleaned up");
});
