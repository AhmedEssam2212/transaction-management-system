import { FastifyRequest, FastifyReply } from "fastify";
import { AuthService, TransactionService } from "../services";
import { UserRepository } from "../repositories";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
    authService: AuthService;
    transactionService: TransactionService;
    userRepository: UserRepository;
  }

  interface FastifyRequest {
    user?: {
      sub: string;
      username: string;
      email: string;
      iat?: number;
      exp?: number;
    };
  }
}
