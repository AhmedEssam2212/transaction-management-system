import bcrypt from "bcrypt";
import { UserRepository } from "../repositories";
import { LoginDto, UserDto } from "@transaction-system/shared";
import { UnauthorizedException, ConflictException } from "../exceptions";
import { User } from "../entities";

export class AuthService {
  constructor(private userRepository: UserRepository) {}

  async login(loginDto: LoginDto): Promise<{ user: User }> {
    const user = await this.userRepository.findByUsername(loginDto.username);

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    return { user };
  }

  async register(
    username: string,
    email: string,
    password: string
  ): Promise<User> {
    const existingUser = await this.userRepository.findByUsername(username);
    if (existingUser) {
      throw new ConflictException("Username already exists");
    }

    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) {
      throw new ConflictException("Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepository.create({
      username,
      email,
      password: hashedPassword,
    });

    return user;
  }

  mapUserToDto(user: User): UserDto {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
