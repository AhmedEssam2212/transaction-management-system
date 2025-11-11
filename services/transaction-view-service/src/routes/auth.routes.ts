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
        description: `Authenticate user and receive JWT access token. Creates audit log for login action.

**Success Response Example (200):**
\`\`\`json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDAiLCJ1c2VybmFtZSI6InRlc3R1c2VyIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzYyODY0MDAwLCJleHAiOjE3NjI5NTA0MDB9.example_signature",
    "tokenType": "Bearer",
    "expiresIn": 86400,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "testuser",
      "email": "test@example.com",
      "createdAt": "2025-11-01T10:00:00.000Z"
    }
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/auth/login"
}
\`\`\`

**Error Response Example (401 - Invalid Credentials):**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials"
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/auth/login"
}
\`\`\``,
        tags: ["Authentication"],
        body: {
          type: "object",
          required: ["username", "password"],
          properties: {
            username: {
              type: "string",
              minLength: 3,
              maxLength: 50,
              description: "Username",
              example: "testuser",
            },
            password: {
              type: "string",
              minLength: 6,
              description: "Password (minimum 6 characters)",
              example: "password123",
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

      fastify.log.info({ response }, "Login response before return");
      return response;
    }
  );

  fastify.get(
    "/me",
    {
      onRequest: [fastify.authenticate],
      schema: {
        description: `Get current authenticated user information from JWT token

**Success Response Example (200):**
\`\`\`json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "username": "testuser",
    "email": "test@example.com"
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/auth/me"
}
\`\`\`

**Error Response Example (401 - Unauthorized):**
\`\`\`json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  },
  "timestamp": "2025-11-11T12:00:00.000Z",
  "path": "/api/auth/me"
}
\`\`\``,
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // request.user contains the JWT payload: { sub, username, email, iat, exp }
      const jwtPayload = request.user as JwtPayload;

      return {
        id: jwtPayload.sub,
        username: jwtPayload.username,
        email: jwtPayload.email,
      };
    }
  );
}
