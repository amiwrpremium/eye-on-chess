import { FastifyRequest, FastifyReply } from "fastify";
import { verifyAccessToken, AccessTokenPayload } from "../lib/jwt.js";

declare module "fastify" {
  interface FastifyRequest {
    user: AccessTokenPayload;
  }
}

/**
 * Fastify preHandler that verifies the Bearer JWT and attaches the user payload to the request.
 * @param request - The incoming Fastify request.
 * @param reply - The Fastify reply used to send 401 on failure.
 */
export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return reply.status(401).send({ code: "UNAUTHORIZED", error: "Missing or invalid token" });
  }

  try {
    const token = header.slice(7);
    request.user = verifyAccessToken(token);
  } catch {
    return reply.status(401).send({ code: "UNAUTHORIZED", error: "Invalid or expired token" });
  }
}
