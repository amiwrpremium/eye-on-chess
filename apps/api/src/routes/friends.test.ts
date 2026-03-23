import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import {
  getPrisma,
  authHeader,
  TEST_USER,
  type FastifyInstance,
  createApp,
} from "../test/setup.js";

import { friendRoutes } from "./friends.js";

describe("friendRoutes", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createApp(async (a) => {
      await a.register(friendRoutes);
    });
  });

  afterAll(() => app.close());

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /friends ────────────────────────────────

  describe("GET /friends", () => {
    it("returns list of friends", async () => {
      const prisma = getPrisma();
      prisma.friendship.findMany.mockResolvedValue([
        {
          id: "f-1",
          requesterId: TEST_USER.id,
          addresseeId: "other-id",
          status: "ACCEPTED",
          requester: { id: TEST_USER.id, username: "testuser", rating: 1200, avatarUrl: null },
          addressee: { id: "other-id", username: "friend1", rating: 1300, avatarUrl: null },
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/friends",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.friends).toHaveLength(1);
      expect(body.friends[0].username).toBe("friend1");
      expect(body.friends[0]).toHaveProperty("isOnline");
    });

    it("returns 401 without auth", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/friends",
      });

      expect(res.statusCode).toBe(401);
    });
  });

  // ── GET /friends/requests ───────────────────────

  describe("GET /friends/requests", () => {
    it("returns pending friend requests", async () => {
      const prisma = getPrisma();
      prisma.friendship.findMany.mockResolvedValue([
        {
          id: "f-2",
          requesterId: "other-id",
          addresseeId: TEST_USER.id,
          status: "PENDING",
          createdAt: new Date(),
          requester: { id: "other-id", username: "requester1", rating: 1100, avatarUrl: null },
        },
      ]);

      const res = await app.inject({
        method: "GET",
        url: "/friends/requests",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.requests).toHaveLength(1);
      expect(body.requests[0].username).toBe("requester1");
    });
  });

  // ── POST /friends/request ───────────────────────

  describe("POST /friends/request", () => {
    it("sends a friend request successfully", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: "target-id", username: "target" });
      prisma.friendship.findFirst.mockResolvedValue(null);
      prisma.friendship.create.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/friends/request",
        headers: authHeader(),
        payload: { username: "target" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 400 when username is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/friends/request",
        headers: authHeader(),
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it("returns 404 when target user not found", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/friends/request",
        headers: authHeader(),
        payload: { username: "nonexistent" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 400 when requesting self", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: TEST_USER.id, username: TEST_USER.username });

      const res = await app.inject({
        method: "POST",
        url: "/friends/request",
        headers: authHeader(),
        payload: { username: TEST_USER.username },
      });

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/yourself/i);
    });

    it("returns 409 when already friends", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: "target-id", username: "target" });
      prisma.friendship.findFirst.mockResolvedValue({
        id: "f-1",
        status: "ACCEPTED",
        requesterId: TEST_USER.id,
        addresseeId: "target-id",
      });

      const res = await app.inject({
        method: "POST",
        url: "/friends/request",
        headers: authHeader(),
        payload: { username: "target" },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error).toMatch(/already friends/i);
    });

    it("returns 409 when request already pending", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: "target-id", username: "target" });
      prisma.friendship.findFirst.mockResolvedValue({
        id: "f-1",
        status: "PENDING",
        requesterId: TEST_USER.id,
        addresseeId: "target-id",
      });

      const res = await app.inject({
        method: "POST",
        url: "/friends/request",
        headers: authHeader(),
        payload: { username: "target" },
      });

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body).error).toMatch(/pending/i);
    });

    it("re-requests after prior decline", async () => {
      const prisma = getPrisma();
      prisma.user.findUnique.mockResolvedValue({ id: "target-id", username: "target" });
      prisma.friendship.findFirst.mockResolvedValue({
        id: "f-1",
        status: "DECLINED",
        requesterId: TEST_USER.id,
        addresseeId: "target-id",
      });
      prisma.friendship.update.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/friends/request",
        headers: authHeader(),
        payload: { username: "target" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });
  });

  // ── POST /friends/accept ────────────────────────

  describe("POST /friends/accept", () => {
    it("accepts a friend request", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: "other-id",
        addresseeId: TEST_USER.id,
        status: "PENDING",
      });
      prisma.friendship.update.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/friends/accept",
        headers: authHeader(),
        payload: { friendshipId: "f-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 404 when request not found", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/friends/accept",
        headers: authHeader(),
        payload: { friendshipId: "nonexistent" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when not the recipient", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: "other-id",
        addresseeId: "someone-else",
        status: "PENDING",
      });

      const res = await app.inject({
        method: "POST",
        url: "/friends/accept",
        headers: authHeader(),
        payload: { friendshipId: "f-1" },
      });

      expect(res.statusCode).toBe(403);
    });

    it("returns 400 when request is not pending", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: "other-id",
        addresseeId: TEST_USER.id,
        status: "ACCEPTED",
      });

      const res = await app.inject({
        method: "POST",
        url: "/friends/accept",
        headers: authHeader(),
        payload: { friendshipId: "f-1" },
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /friends/decline ───────────────────────

  describe("POST /friends/decline", () => {
    it("declines a friend request", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: "other-id",
        addresseeId: TEST_USER.id,
        status: "PENDING",
      });
      prisma.friendship.update.mockResolvedValue({});

      const res = await app.inject({
        method: "POST",
        url: "/friends/decline",
        headers: authHeader(),
        payload: { friendshipId: "f-1" },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 404 when request not found", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/friends/decline",
        headers: authHeader(),
        payload: { friendshipId: "nonexistent" },
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when not the recipient", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: "other-id",
        addresseeId: "someone-else",
        status: "PENDING",
      });

      const res = await app.inject({
        method: "POST",
        url: "/friends/decline",
        headers: authHeader(),
        payload: { friendshipId: "f-1" },
      });

      expect(res.statusCode).toBe(403);
    });
  });

  // ── DELETE /friends/:friendshipId ───────────────

  describe("DELETE /friends/:friendshipId", () => {
    it("removes a friend successfully", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: TEST_USER.id,
        addresseeId: "other-id",
      });
      prisma.friendship.delete.mockResolvedValue({});

      const res = await app.inject({
        method: "DELETE",
        url: "/friends/f-1",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).success).toBe(true);
    });

    it("returns 404 when friendship not found", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue(null);

      const res = await app.inject({
        method: "DELETE",
        url: "/friends/nonexistent",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(404);
    });

    it("returns 403 when not part of friendship", async () => {
      const prisma = getPrisma();
      prisma.friendship.findUnique.mockResolvedValue({
        id: "f-1",
        requesterId: "someone",
        addresseeId: "someone-else",
      });

      const res = await app.inject({
        method: "DELETE",
        url: "/friends/f-1",
        headers: authHeader(),
      });

      expect(res.statusCode).toBe(403);
    });
  });
});
