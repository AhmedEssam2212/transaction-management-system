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

  // Run migrations to set up schema
  await AppDataSource.runMigrations();

  console.log(
    "E2E Test setup complete - Database initialized with clean state"
  );
});

afterEach(async () => {
  // Clean up data after each test to prevent test pollution
  // This ensures each test starts with a clean slate
  if (AppDataSource.isInitialized) {
    const entities = AppDataSource.entityMetadatas;

    for (const entity of entities) {
      const repository = AppDataSource.getRepository(entity.name);
      await repository.clear(); // Removes all rows from the table
    }
  }
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
