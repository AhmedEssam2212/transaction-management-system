import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { AuthService } from "../services";
import { loginSchema } from "../validators";
import {
  LoginDto,
  LoginResponseDto,
  JwtPayload,
} from "@transaction-system/shared";
import { envConfig } from "../config/env.config";

export async function authRoutes(fastify: FastifyInstance) {
  const authService: AuthService = (fastify as any).authService;

  fastify.post<{ Body: LoginDto }>(
    "/login",
    {
      schema: {
        description: "User login",
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: { type: "string", minLength: 3, maxLength: 50 },
            password: { type: "string", minLength: 6 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  accessToken: { type: "string" },
                  tokenType: { type: "string" },
                  expiresIn: { type: "number" },
                  user: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      username: { type: "string" },
                      email: { type: "string" },
                      createdAt: { type: "string" },
                    },
                  },
                },
              },
              timestamp: { type: "string" },
              path: { type: "string" },
            },
          },
        },
      },
    },
    async (
      request: FastifyRequest<{ Body: LoginDto }>,
      reply: FastifyReply
    ) => {
      const validatedData = loginSchema.parse(request.body);

      const { user } = await authService.login(validatedData);

      const payload: JwtPayload = {
        sub: user.id,
        username: user.username,
        email: user.email,
      };

      const token = fastify.jwt.sign(payload, {
        expiresIn: envConfig.jwt.expiresIn,
      });

      const response: LoginResponseDto = {
        accessToken: token,
        tokenType: "Bearer",
        expiresIn: 86400, // 24 hours in seconds
        user: authService.mapUserToDto(user),
      };

      return response;
    }
  );

  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: "Get current user information",
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  username: { type: "string" },
                  email: { type: "string" },
                },
              },
              timestamp: { type: "string" },
              path: { type: "string" },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      return request.user;
    }
  );
}
