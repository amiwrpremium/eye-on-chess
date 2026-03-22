import { FastifyInstance } from "fastify";

const SENSITIVE_FIELDS = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "refresh_token",
  "secret",
  "jwt",
  "authorization",
  "cookie",
  "set-cookie",
]);

function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 5) return "[too deep]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redactObject(item, depth + 1));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "string" && key.toLowerCase() === "authorization") {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactObject(value, depth + 1);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

function redactHeaders(
  headers: Record<string, string | string[] | undefined>
): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_FIELDS.has(key.toLowerCase())) {
      safe[key] = "[REDACTED]";
    } else {
      safe[key] = value;
    }
  }
  return safe;
}

/**
 * Register request/response logging hooks that redact sensitive fields.
 * @param app - The Fastify application instance.
 */
export function registerRequestLogger(app: FastifyInstance) {
  app.addHook("onRequest", async (request) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers["user-agent"],
        headers: redactHeaders(request.headers as Record<string, string>),
      },
      "incoming request"
    );
  });

  app.addHook("preHandler", async (request) => {
    // Log request body for mutations (POST, PUT, PATCH, DELETE)
    if (request.body && ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
      request.log.info(
        {
          reqId: request.id,
          method: request.method,
          url: request.url,
          body: redactObject(request.body),
        },
        "request body"
      );
    }

    // Log query params if present
    const query = request.query as Record<string, unknown>;
    if (query && Object.keys(query).length > 0) {
      request.log.info(
        {
          reqId: request.id,
          url: request.url,
          query: redactObject(query),
        },
        "request query"
      );
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
        ip: request.ip,
      },
      "request completed"
    );
  });

  app.addHook("onError", async (request, _reply, error) => {
    request.log.error(
      {
        reqId: request.id,
        method: request.method,
        url: request.url,
        ip: request.ip,
        error: {
          message: error.message,
          code: (error as { code?: string }).code,
          stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
        },
      },
      "request error"
    );
  });
}
