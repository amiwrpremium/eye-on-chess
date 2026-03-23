import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma.js";
import crypto from "crypto";

// ── Role check ──────────────────────────────────────────
export async function adminMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user?.userId;
  if (!userId) {
    return reply.status(401).send({ code: "UNAUTHORIZED", error: "Not authenticated" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, active: true },
  });

  if (!user || !user.active || user.role !== "ADMIN") {
    return reply.status(403).send({ code: "ADMIN_FORBIDDEN", error: "Admin access required" });
  }
}

// ── Rate limiting (in-memory, per IP) ───────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60_000;

export async function adminRateLimit(request: FastifyRequest, reply: FastifyReply) {
  const ip = request.ip || "unknown";
  const now = Date.now();

  let entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }

  entry.count++;

  reply.header("X-RateLimit-Limit", RATE_LIMIT);
  reply.header("X-RateLimit-Remaining", Math.max(0, RATE_LIMIT - entry.count));

  if (entry.count > RATE_LIMIT) {
    return reply.status(429).send({ code: "ADMIN_RATE_LIMITED", error: "Too many requests" });
  }
}

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now > entry.resetAt) rateLimitMap.delete(ip);
  }
}, 300_000);

// ── CSRF double-submit ──────────────────────────────────
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function csrfProtection(request: FastifyRequest, reply: FastifyReply) {
  // Only protect mutations
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;

  const cookieToken = request.cookies[CSRF_COOKIE];
  const headerToken = request.headers[CSRF_HEADER] as string | undefined;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return reply.status(403).send({ code: "ADMIN_CSRF_INVALID", error: "Invalid CSRF token" });
  }
}

// ── Audit logging ───────────────────────────────────────
export async function auditLog(
  adminId: string,
  action: string,
  targetType: string,
  targetId: string | null,
  details: Record<string, unknown> | null,
  ip: string | null
) {
  await prisma.auditLog.create({
    data: {
      adminId,
      action,
      targetType,
      targetId,
      details: details ? JSON.stringify(details) : null,
      ip,
    },
  });
}

// ── Input sanitization ──────────────────────────────────
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+=/gi, "")
    .trim();
}
