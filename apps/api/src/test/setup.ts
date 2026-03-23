/**
 * Shared test setup for API route integration tests.
 * Provides a pre-configured Fastify app with mocked Prisma and Redis,
 * and helper functions for authenticated requests.
 */
import { vi } from "vitest";

// Must set env before any imports that read it
process.env.JWT_SECRET = "test-secret-for-integration-tests";

import Fastify, { type FastifyInstance, type FastifyError } from "fastify";
import { validatorCompiler } from "fastify-type-provider-zod";
import cookie from "@fastify/cookie";
import jwt from "jsonwebtoken";

// ── Mock Prisma ─────────────────────────────────────────
const mockPrismaClient: Record<string, unknown> = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
    upsert: vi.fn(),
  },
  game: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  move: {
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
  },
  friendship: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  refreshToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  collection: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    upsert: vi.fn(),
  },
  gameCollection: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  invite: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  gameNote: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
  },
  gameAnalysis: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
  },
  siteSettings: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  botProfile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    count: vi.fn(),
  },
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(mockPrismaClient)),
};

vi.mock("../lib/prisma.js", () => ({
  prisma: mockPrismaClient,
}));

// ── Mock Redis ──────────────────────────────────────────
const mockRedis: Record<string, ReturnType<typeof vi.fn>> = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  exists: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  sadd: vi.fn(),
  srem: vi.fn(),
  smembers: vi.fn(),
  llen: vi.fn(),
  lpush: vi.fn(),
  pipeline: vi.fn(() => ({ exec: vi.fn().mockResolvedValue([]) })),
};

vi.mock("../lib/redis.js", () => ({
  redis: mockRedis,
  setOnline: vi.fn(),
  setOffline: vi.fn(),
  isOnline: vi.fn().mockResolvedValue(false),
  bulkIsOnline: vi.fn().mockResolvedValue({}),
  checkReactionRateLimit: vi.fn().mockResolvedValue(true),
}));

// ── Mock Socket ─────────────────────────────────────────
vi.mock("../lib/socket.js", () => ({
  setupSocket: vi.fn(),
  getIO: vi.fn(() => ({ emit: vi.fn(), to: vi.fn(() => ({ emit: vi.fn() })) })),
}));

// ── Mock Game Clock ─────────────────────────────────────
vi.mock("../lib/gameClock.js", () => ({
  initClocks: vi.fn(),
  getClocks: vi.fn(),
  getClocksRealtime: vi.fn(),
  onMove: vi.fn(),
  isTimeout: vi.fn(),
  removeActiveGame: vi.fn(),
  getActiveGameIds: vi.fn().mockResolvedValue([]),
}));

// ── Mock Bot Engine ─────────────────────────────────────
vi.mock("../lib/botEngine.js", () => ({
  getBotMove: vi.fn().mockResolvedValue("e2e4"),
}));

// ── Mock Settings ───────────────────────────────────────
vi.mock("../lib/settings.js", () => ({
  getSiteSettings: vi.fn().mockResolvedValue({
    siteName: "EyeOnChess",
    registrationOpen: true,
    maxUsers: 0,
    requireEmailVerification: false,
  }),
}));

// ── Mock Rate Limit Config ──────────────────────────────
vi.mock("../lib/rateLimit.js", () => ({
  initRateLimitConfig: vi.fn().mockReturnValue({ global: { max: 1000, timeWindow: "1 minute" } }),
  getRateLimitConfig: vi.fn().mockReturnValue({ global: { max: 1000, timeWindow: "1 minute" } }),
  getRouteLimit: vi.fn().mockReturnValue({ max: 1000, timeWindow: "1 minute" }),
}));

// ── Mock Logger ─────────────────────────────────────────
vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  createChildLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ── Mock Request Logger ─────────────────────────────────
vi.mock("../middleware/requestLogger.js", () => ({
  registerRequestLogger: vi.fn(),
}));

// ── Mock Game Socket ────────────────────────────────────
vi.mock("../lib/gameSocket.js", () => ({
  setupGameSocket: vi.fn(),
}));

// ── Test Helpers ────────────────────────────────────────

const TEST_USER = {
  id: "test-user-id",
  email: "test@example.com",
  username: "testuser",
  role: "USER",
  rating: 1200,
  active: true,
  verified: true,
  tosAccepted: true,
  avatarUrl: null,
  darkMode: true,
  boardTheme: "classic",
  pieceSet: "classic",
  soundEnabled: true,
  passwordHash: "$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const ADMIN_USER = {
  ...TEST_USER,
  id: "admin-user-id",
  email: "admin@example.com",
  username: "admin",
  role: "ADMIN",
};

function signToken(payload: {
  userId: string;
  email: string;
  username: string;
  role: string;
}): string {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: "15m" });
}

function authHeader(user: typeof TEST_USER = TEST_USER): Record<string, string> {
  const token = signToken({
    userId: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
  });
  return { authorization: `Bearer ${token}` };
}

function getPrisma() {
  return mockPrismaClient as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
}

function getRedis(): Record<string, ReturnType<typeof vi.fn>> {
  return mockRedis;
}

async function createApp(
  registerRoutes: (app: FastifyInstance) => Promise<void> | void
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.setValidatorCompiler(validatorCompiler);

  // Match server.ts validation error format
  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error.validation) {
      const messages = error.validation.map((v: { message?: string }) => v.message).join("; ");
      return reply.status(400).send({ error: messages || "Validation failed" });
    }
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ error: error.message });
    }
    reply.status(500).send({ error: "Internal server error" });
  });

  await app.register(cookie);
  await registerRoutes(app);
  await app.ready();
  return app;
}

export {
  mockPrismaClient,
  mockRedis,
  TEST_USER,
  ADMIN_USER,
  signToken,
  authHeader,
  getPrisma,
  getRedis,
  createApp,
  Fastify,
  cookie,
  type FastifyInstance,
};
