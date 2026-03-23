import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./prisma.js", () => ({
  prisma: { $disconnect: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("./redis.js", () => ({
  redis: { quit: vi.fn().mockResolvedValue(undefined) },
}));

import { prisma } from "./prisma.js";
import { redis } from "./redis.js";
import { registerShutdown } from "./shutdown.js";

const mockPrismaDisconnect = prisma.$disconnect as ReturnType<typeof vi.fn>;
const mockRedisQuit = (redis as unknown as { quit: ReturnType<typeof vi.fn> }).quit;

describe("registerShutdown", () => {
  const mockFastifyClose = vi.fn().mockResolvedValue(undefined);
  const mockIoClose = vi.fn((cb: () => void) => cb());
  const mockLogger = { info: vi.fn(), error: vi.fn() };
  const mockExit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

  const mockFastify = { close: mockFastifyClose } as unknown as Parameters<
    typeof registerShutdown
  >[0];
  const mockIo = { close: mockIoClose } as unknown as Parameters<typeof registerShutdown>[1];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
  });

  it("registers SIGTERM and SIGINT handlers", () => {
    const termBefore = process.listenerCount("SIGTERM");
    const intBefore = process.listenerCount("SIGINT");

    registerShutdown(mockFastify, mockIo, mockLogger);

    expect(process.listenerCount("SIGTERM")).toBe(termBefore + 1);
    expect(process.listenerCount("SIGINT")).toBe(intBefore + 1);
  });

  it("closes Fastify on SIGTERM", async () => {
    registerShutdown(mockFastify, mockIo, mockLogger);
    process.emit("SIGTERM");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFastifyClose).toHaveBeenCalled();
  });

  it("disconnects Prisma on shutdown", async () => {
    registerShutdown(mockFastify, mockIo, mockLogger);
    process.emit("SIGTERM");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockPrismaDisconnect).toHaveBeenCalled();
  });

  it("disconnects Redis on shutdown", async () => {
    registerShutdown(mockFastify, mockIo, mockLogger);
    process.emit("SIGTERM");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockRedisQuit).toHaveBeenCalled();
  });

  it("closes Socket.io on shutdown", async () => {
    registerShutdown(mockFastify, mockIo, mockLogger);
    process.emit("SIGTERM");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockIoClose).toHaveBeenCalled();
  });

  it("calls process.exit(0) on successful shutdown", async () => {
    registerShutdown(mockFastify, mockIo, mockLogger);
    process.emit("SIGTERM");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("works without Socket.io", async () => {
    registerShutdown(mockFastify, null, mockLogger);
    process.emit("SIGINT");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFastifyClose).toHaveBeenCalled();
    expect(mockPrismaDisconnect).toHaveBeenCalled();
    expect(mockRedisQuit).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(0);
  });

  it("only shuts down once on multiple signals", async () => {
    registerShutdown(mockFastify, mockIo, mockLogger);
    process.emit("SIGTERM");
    process.emit("SIGTERM");
    await new Promise((r) => setTimeout(r, 50));
    expect(mockFastifyClose).toHaveBeenCalledTimes(1);
  });
});
