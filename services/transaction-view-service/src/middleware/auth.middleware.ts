import { FastifyRequest, FastifyReply } from "fastify";
import { UnauthorizedException } from "../exceptions";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
  } catch (error) {
    throw new UnauthorizedException("Invalid or missing authentication token");
  }
}
