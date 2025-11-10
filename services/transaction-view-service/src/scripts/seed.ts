import "reflect-metadata";
import { AppDataSource } from "../config/data-source";
import { User } from "../entities/user.entity";
import bcrypt from "bcrypt";

async function seed() {
  try {
    await AppDataSource.initialize();
    console.log("Database connected");

    const userRepository = AppDataSource.getRepository(User);

    const existingUser = await userRepository.findOne({
      where: { username: "testuser" },
    });

    if (existingUser) {
      console.log("Test user already exists");
      await AppDataSource.destroy();
      return;
    }

    // Create test user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const user = await userRepository.save({
      username: "testuser",
      email: "test@example.com",
      password: hashedPassword,
    });

    console.log("✅ Test user created successfully!");
    console.log("Username: testuser");
    console.log("Password: password123");
    console.log("User ID:", user.id);

    await AppDataSource.destroy();
    console.log("Seed completed");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
}

seed();
