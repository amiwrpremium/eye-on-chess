import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { bulkIsOnline } from "../lib/redis.js";
import { sendFriendRequestBodySchema, friendActionBodySchema } from "../lib/schemas.js";
import {
  apiError,
  FRIEND_USER_NOT_FOUND,
  FRIEND_SELF_REQUEST,
  FRIEND_ALREADY_FRIENDS,
  FRIEND_ALREADY_PENDING,
  FRIEND_REQUEST_NOT_FOUND,
  FRIEND_NOT_RECIPIENT,
  FRIEND_NOT_PENDING,
  FRIEND_NOT_FOUND,
  FRIEND_NOT_PARTICIPANT,
} from "../lib/errorCodes.js";

/** Register friend routes (send request, accept, remove, list friends). */
export async function friendRoutes(app: FastifyInstance) {
  // All friend routes require auth
  app.addHook("preHandler", authMiddleware);

  // My friends list (accepted)
  app.get("/friends", async (request) => {
    const userId = request.user.userId;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: {
          select: { id: true, username: true, rating: true, avatarUrl: true },
        },
        addressee: {
          select: { id: true, username: true, rating: true, avatarUrl: true },
        },
      },
    });

    const friends = friendships.map((f) => {
      const friend = f.requesterId === userId ? f.addressee : f.requester;
      return { friendshipId: f.id, ...friend };
    });

    // Bulk check online status
    const friendIds = friends.map((f) => f.id);
    const onlineMap = await bulkIsOnline(friendIds);

    return {
      friends: friends.map((f) => ({
        ...f,
        isOnline: onlineMap[f.id] || false,
      })),
    };
  });

  // Incoming pending requests
  app.get("/friends/requests", async (request) => {
    const userId = request.user.userId;

    const requests = await prisma.friendship.findMany({
      where: {
        addresseeId: userId,
        status: "PENDING",
      },
      include: {
        requester: {
          select: { id: true, username: true, rating: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      requests: requests.map((r) => ({
        friendshipId: r.id,
        ...r.requester,
        createdAt: r.createdAt,
      })),
    };
  });

  // Send friend request
  app.post<{ Body: { username: string } }>(
    "/friends/request",
    { schema: { body: sendFriendRequestBodySchema } },
    async (request, reply) => {
      const userId = request.user.userId;
      const { username } = request.body;

      const target = await prisma.user.findUnique({ where: { username } });
      if (!target) {
        return apiError(reply, 404, FRIEND_USER_NOT_FOUND, "User not found");
      }

      if (target.id === userId) {
        return apiError(reply, 400, FRIEND_SELF_REQUEST, "Cannot send friend request to yourself");
      }

      // Check for existing friendship in either direction
      const existing = await prisma.friendship.findFirst({
        where: {
          OR: [
            { requesterId: userId, addresseeId: target.id },
            { requesterId: target.id, addresseeId: userId },
          ],
        },
      });

      if (existing) {
        if (existing.status === "ACCEPTED") {
          return apiError(reply, 409, FRIEND_ALREADY_FRIENDS, "Already friends");
        }
        if (existing.status === "PENDING") {
          return apiError(reply, 409, FRIEND_ALREADY_PENDING, "Friend request already pending");
        }
        if (existing.status === "DECLINED") {
          // Allow re-requesting after decline
          await prisma.friendship.update({
            where: { id: existing.id },
            data: {
              requesterId: userId,
              addresseeId: target.id,
              status: "PENDING",
            },
          });
          return { success: true, message: "Friend request sent" };
        }
      }

      await prisma.friendship.create({
        data: {
          requesterId: userId,
          addresseeId: target.id,
        },
      });

      return { success: true, message: "Friend request sent" };
    }
  );

  // Accept friend request
  app.post<{ Body: { friendshipId: string } }>(
    "/friends/accept",
    { schema: { body: friendActionBodySchema } },
    async (request, reply) => {
      const userId = request.user.userId;
      const { friendshipId } = request.body;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });

      if (!friendship) {
        return apiError(reply, 404, FRIEND_REQUEST_NOT_FOUND, "Request not found");
      }

      if (friendship.addresseeId !== userId) {
        return apiError(reply, 403, FRIEND_NOT_RECIPIENT, "Only the recipient can accept");
      }

      if (friendship.status !== "PENDING") {
        return apiError(reply, 400, FRIEND_NOT_PENDING, "Request is not pending");
      }

      await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: "ACCEPTED" },
      });

      return { success: true, message: "Friend request accepted" };
    }
  );

  // Decline friend request
  app.post<{ Body: { friendshipId: string } }>(
    "/friends/decline",
    { schema: { body: friendActionBodySchema } },
    async (request, reply) => {
      const userId = request.user.userId;
      const { friendshipId } = request.body;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });

      if (!friendship) {
        return apiError(reply, 404, FRIEND_REQUEST_NOT_FOUND, "Request not found");
      }

      if (friendship.addresseeId !== userId) {
        return apiError(reply, 403, FRIEND_NOT_RECIPIENT, "Only the recipient can decline");
      }

      if (friendship.status !== "PENDING") {
        return apiError(reply, 400, FRIEND_NOT_PENDING, "Request is not pending");
      }

      await prisma.friendship.update({
        where: { id: friendshipId },
        data: { status: "DECLINED" },
      });

      return { success: true, message: "Friend request declined" };
    }
  );

  // Remove friend
  app.delete<{ Params: { friendshipId: string } }>(
    "/friends/:friendshipId",
    async (request, reply) => {
      const userId = request.user.userId;
      const { friendshipId } = request.params;

      const friendship = await prisma.friendship.findUnique({
        where: { id: friendshipId },
      });

      if (!friendship) {
        return apiError(reply, 404, FRIEND_NOT_FOUND, "Friendship not found");
      }

      if (friendship.requesterId !== userId && friendship.addresseeId !== userId) {
        return apiError(reply, 403, FRIEND_NOT_PARTICIPANT, "Not part of this friendship");
      }

      await prisma.friendship.delete({ where: { id: friendshipId } });

      return { success: true, message: "Friend removed" };
    }
  );
}
