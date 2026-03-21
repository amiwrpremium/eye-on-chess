import { FastifyInstance } from "fastify";
import { Chess } from "chess.js";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { initClocks, onMove as clockOnMove } from "../lib/gameClock.js";
import { getIO } from "../lib/socket.js";
import { getBotMove } from "../lib/botEngine.js";
import type { TimeControl } from "@prisma/client";

const TIME_CONTROL_MAP: Record<
  string,
  { timeControl: TimeControl; initialTime: number; increment: number }
> = {
  bullet_1_0: { timeControl: "BULLET", initialTime: 60, increment: 0 },
  bullet_2_1: { timeControl: "BULLET", initialTime: 120, increment: 1 },
  blitz_3_0: { timeControl: "BLITZ", initialTime: 180, increment: 0 },
  blitz_5_0: { timeControl: "BLITZ", initialTime: 300, increment: 0 },
  blitz_5_3: { timeControl: "BLITZ", initialTime: 300, increment: 3 },
  rapid_10_0: { timeControl: "RAPID", initialTime: 600, increment: 0 },
  rapid_15_10: { timeControl: "RAPID", initialTime: 900, increment: 10 },
  classical_30_0: { timeControl: "CLASSICAL", initialTime: 1800, increment: 0 },
  unlimited: { timeControl: "UNLIMITED", initialTime: 0, increment: 0 },
};

export async function gameRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authMiddleware);

  // Challenge a friend
  app.post<{
    Body: {
      friendId: string;
      preset?: string;
      initialTime?: number;
      increment?: number;
    };
  }>("/api/games/friend", async (request, reply) => {
    const userId = request.user.userId;
    const { friendId, preset, initialTime: customTime, increment: customIncrement } = request.body;

    if (!friendId) {
      return reply.status(400).send({ error: "friendId is required" });
    }

    if (friendId === userId) {
      return reply.status(400).send({ error: "Cannot challenge yourself" });
    }

    // Verify friendship
    const friendship = await prisma.friendship.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });

    if (!friendship) {
      return reply.status(403).send({ error: "Must be friends to challenge" });
    }

    // Resolve time control
    let timeControl: TimeControl;
    let initialTime: number;
    let increment: number;

    if (preset && TIME_CONTROL_MAP[preset]) {
      const p = TIME_CONTROL_MAP[preset];
      timeControl = p.timeControl;
      initialTime = p.initialTime;
      increment = p.increment;
    } else if (customTime !== undefined) {
      initialTime = customTime;
      increment = customIncrement ?? 0;
      // Categorize
      const totalSeconds = initialTime + increment * 40;
      if (totalSeconds < 180) timeControl = "BULLET";
      else if (totalSeconds < 480) timeControl = "BLITZ";
      else if (totalSeconds < 1500) timeControl = "RAPID";
      else timeControl = "CLASSICAL";
    } else {
      return reply.status(400).send({ error: "Must provide preset or custom time" });
    }

    // Randomly assign colors
    const whiteId = Math.random() < 0.5 ? userId : friendId;
    const blackId = whiteId === userId ? friendId : userId;

    const game = await prisma.game.create({
      data: {
        whiteId,
        blackId,
        status: "WAITING",
        timeControl,
        initialTime,
        increment,
        whiteTimeLeft: initialTime * 1000,
        blackTimeLeft: initialTime * 1000,
      },
      include: {
        white: { select: { id: true, username: true, rating: true, avatarUrl: true } },
        black: { select: { id: true, username: true, rating: true, avatarUrl: true } },
      },
    });

    // Notify the challenged friend via socket
    const io = getIO();
    if (io) {
      io.emit("challenge:incoming", {
        gameId: game.id,
        challenger: game.whiteId === userId ? game.white : game.black,
        timeControl,
        initialTime,
        increment,
      });
    }

    return { game };
  });

  // Accept challenge
  app.post<{ Body: { gameId: string } }>("/api/games/challenge/accept", async (request, reply) => {
    const userId = request.user.userId;
    const { gameId } = request.body;

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      return reply.status(404).send({ error: "Game not found" });
    }

    if (game.status !== "WAITING") {
      return reply.status(400).send({ error: "Challenge already resolved" });
    }

    if (game.whiteId !== userId && game.blackId !== userId) {
      return reply.status(403).send({ error: "Not part of this challenge" });
    }

    await prisma.game.update({
      where: { id: gameId },
      data: { status: "ACTIVE", startedAt: new Date() },
    });

    // Init clocks in Redis (skip for unlimited)
    if (game.timeControl !== "UNLIMITED") {
      await initClocks(gameId, game.initialTime * 1000, game.increment * 1000);
    }

    const io = getIO();
    if (io) {
      io.emit("challenge:accepted", { gameId });
    }

    return { success: true, gameId };
  });

  // Decline challenge
  app.post<{ Body: { gameId: string } }>("/api/games/challenge/decline", async (request, reply) => {
    const userId = request.user.userId;
    const { gameId } = request.body;

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) {
      return reply.status(404).send({ error: "Game not found" });
    }

    if (game.status !== "WAITING") {
      return reply.status(400).send({ error: "Challenge already resolved" });
    }

    if (game.whiteId !== userId && game.blackId !== userId) {
      return reply.status(403).send({ error: "Not part of this challenge" });
    }

    await prisma.game.delete({ where: { id: gameId } });

    const io = getIO();
    if (io) {
      io.emit("challenge:declined", { gameId });
    }

    return { success: true };
  });

  // Get game state
  app.get<{ Params: { id: string } }>("/api/games/:id", async (request, reply) => {
    const { id } = request.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        white: { select: { id: true, username: true, rating: true, avatarUrl: true } },
        black: { select: { id: true, username: true, rating: true, avatarUrl: true } },
        moves: { orderBy: { ply: "asc" } },
      },
    });

    if (!game) {
      return reply.status(404).send({ error: "Game not found" });
    }

    return { game };
  });

  // Get user's game history
  app.get<{
    Querystring: { page?: string; limit?: string };
  }>("/api/games/history", async (request) => {
    const userId = request.user.userId;
    const page = Math.max(1, parseInt(request.query.page || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(request.query.limit || "20")));

    const where = {
      status: { in: ["COMPLETED" as const, "ABORTED" as const] },
      OR: [{ whiteId: userId }, { blackId: userId }],
    };

    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        select: {
          id: true,
          status: true,
          result: true,
          termination: true,
          timeControl: true,
          isVsBot: true,
          botElo: true,
          createdAt: true,
          endedAt: true,
          whiteId: true,
          blackId: true,
          white: { select: { username: true, rating: true } },
          black: { select: { username: true, rating: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.game.count({ where }),
    ]);

    return {
      games,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  });

  // ── Bot Games ───────────────────────────────────────

  // Create bot game
  app.post<{
    Body: {
      botElo: number;
      color: "white" | "black" | "random";
      preset?: string;
      initialTime?: number;
      increment?: number;
    };
  }>("/api/games/bot", async (request, reply) => {
    const userId = request.user.userId;
    const {
      botElo,
      color,
      preset,
      initialTime: customTime,
      increment: customIncrement,
    } = request.body;

    if (!botElo || botElo < 200 || botElo > 3200) {
      return reply.status(400).send({ error: "botElo must be between 200 and 3200" });
    }

    // Resolve time control
    let timeControl: TimeControl;
    let initialTime: number;
    let increment: number;

    if (preset && TIME_CONTROL_MAP[preset]) {
      const p = TIME_CONTROL_MAP[preset];
      timeControl = p.timeControl;
      initialTime = p.initialTime;
      increment = p.increment;
    } else if (customTime !== undefined) {
      initialTime = customTime;
      increment = customIncrement ?? 0;
      if (initialTime === 0 && increment === 0) {
        timeControl = "UNLIMITED";
      } else {
        const totalSeconds = initialTime + increment * 40;
        if (totalSeconds < 180) timeControl = "BULLET";
        else if (totalSeconds < 480) timeControl = "BLITZ";
        else if (totalSeconds < 1500) timeControl = "RAPID";
        else timeControl = "CLASSICAL";
      }
    } else {
      timeControl = "RAPID";
      initialTime = 600;
      increment = 0;
    }

    // Assign colors
    const playerIsWhite =
      color === "white" ? true : color === "black" ? false : Math.random() < 0.5;

    const game = await prisma.game.create({
      data: {
        whiteId: playerIsWhite ? userId : null,
        blackId: playerIsWhite ? null : userId,
        status: "ACTIVE",
        timeControl,
        initialTime,
        increment,
        whiteTimeLeft: initialTime * 1000,
        blackTimeLeft: initialTime * 1000,
        isVsBot: true,
        botElo,
        startedAt: new Date(),
      },
      include: {
        white: { select: { id: true, username: true, rating: true, avatarUrl: true } },
        black: { select: { id: true, username: true, rating: true, avatarUrl: true } },
      },
    });

    // Init clocks
    if (timeControl !== "UNLIMITED") {
      await initClocks(game.id, initialTime * 1000, increment * 1000);
    }

    // If bot plays white, make the first move
    let botFirstMove = null;
    if (!playerIsWhite) {
      const botMoveUci = await getBotMove(game.fen, botElo);
      const chess = new Chess(game.fen);
      const from = botMoveUci.slice(0, 2);
      const to = botMoveUci.slice(2, 4);
      const promotion = botMoveUci[4] || undefined;
      const move = chess.move({ from, to, promotion });

      if (move) {
        await prisma.move.create({
          data: { gameId: game.id, ply: 1, san: move.san, uci: botMoveUci, fen: chess.fen() },
        });
        await prisma.game.update({
          where: { id: game.id },
          data: { fen: chess.fen(), pgn: chess.pgn() },
        });
        if (timeControl !== "UNLIMITED") {
          await clockOnMove(game.id, false);
        }
        botFirstMove = { from, to, promotion, san: move.san, fen: chess.fen(), ply: 1 };
      }
    }

    return { game, botFirstMove, playerIsWhite };
  });

  // Make a move in a bot game
  app.post<{
    Params: { id: string };
    Body: { from: string; to: string; promotion?: string };
  }>("/api/games/:id/move", async (request, reply) => {
    const userId = request.user.userId;
    const { id: gameId } = request.params;
    const { from, to, promotion } = request.body;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: { moves: { orderBy: { ply: "desc" }, take: 1 } },
    });

    if (!game) return reply.status(404).send({ error: "Game not found" });
    if (game.status !== "ACTIVE") return reply.status(400).send({ error: "Game not active" });
    if (!game.isVsBot) return reply.status(400).send({ error: "Not a bot game" });
    if (game.whiteId !== userId && game.blackId !== userId) {
      return reply.status(403).send({ error: "Not your game" });
    }

    const chess = new Chess(game.fen);

    // Verify it's the player's turn
    const isWhiteTurn = chess.turn() === "w";
    const playerIsWhite = game.whiteId === userId;
    if (isWhiteTurn !== playerIsWhite) {
      return reply.status(400).send({ error: "Not your turn" });
    }

    // Validate and apply player move
    const playerMove = chess.move({ from, to, promotion: promotion || undefined });
    if (!playerMove) return reply.status(400).send({ error: "Invalid move" });

    const currentPly = (game.moves[0]?.ply ?? 0) + 1;

    await prisma.move.create({
      data: {
        gameId,
        ply: currentPly,
        san: playerMove.san,
        uci: `${from}${to}${promotion || ""}`,
        fen: chess.fen(),
      },
    });

    // Update clocks
    const isUnlimited = game.timeControl === "UNLIMITED";
    let clocks = null;
    if (!isUnlimited) {
      clocks = await clockOnMove(gameId, false);
    }

    // Check if game ended after player move
    if (chess.isGameOver()) {
      let result: "WHITE_WIN" | "BLACK_WIN" | "DRAW";
      let termination: "CHECKMATE" | "AGREEMENT";
      if (chess.isCheckmate()) {
        result = chess.turn() === "w" ? "BLACK_WIN" : "WHITE_WIN";
        termination = "CHECKMATE";
      } else {
        result = "DRAW";
        termination = "AGREEMENT";
      }

      await prisma.game.update({
        where: { id: gameId },
        data: {
          fen: chess.fen(),
          pgn: chess.pgn(),
          status: "COMPLETED",
          result,
          termination,
          endedAt: new Date(),
        },
      });

      return {
        playerMove: { from, to, promotion, san: playerMove.san, fen: chess.fen(), ply: currentPly },
        botMove: null,
        gameOver: { result, termination },
        clocks,
      };
    }

    // Update game state before bot thinks
    await prisma.game.update({
      where: { id: gameId },
      data: { fen: chess.fen(), pgn: chess.pgn() },
    });

    // Get bot response
    const botMoveUci = await getBotMove(chess.fen(), game.botElo!);
    const botFrom = botMoveUci.slice(0, 2);
    const botTo = botMoveUci.slice(2, 4);
    const botPromotion = botMoveUci[4] || undefined;
    const botMove = chess.move({ from: botFrom, to: botTo, promotion: botPromotion });

    if (!botMove) {
      return reply.status(500).send({ error: "Bot produced invalid move" });
    }

    const botPly = currentPly + 1;

    await prisma.move.create({
      data: {
        gameId,
        ply: botPly,
        san: botMove.san,
        uci: botMoveUci,
        fen: chess.fen(),
      },
    });

    if (!isUnlimited) {
      clocks = await clockOnMove(gameId, false);
    }

    // Check if game ended after bot move
    let gameOver = null;
    if (chess.isGameOver()) {
      let result: "WHITE_WIN" | "BLACK_WIN" | "DRAW";
      let termination: "CHECKMATE" | "AGREEMENT";
      if (chess.isCheckmate()) {
        result = chess.turn() === "w" ? "BLACK_WIN" : "WHITE_WIN";
        termination = "CHECKMATE";
      } else {
        result = "DRAW";
        termination = "AGREEMENT";
      }
      gameOver = { result, termination };

      await prisma.game.update({
        where: { id: gameId },
        data: {
          fen: chess.fen(),
          pgn: chess.pgn(),
          status: "COMPLETED",
          result,
          termination,
          endedAt: new Date(),
        },
      });
    } else {
      await prisma.game.update({
        where: { id: gameId },
        data: { fen: chess.fen(), pgn: chess.pgn() },
      });
    }

    return {
      playerMove: {
        from,
        to,
        promotion,
        san: playerMove.san,
        fen: playerMove.after,
        ply: currentPly,
      },
      botMove: {
        from: botFrom,
        to: botTo,
        promotion: botPromotion,
        san: botMove.san,
        fen: chess.fen(),
        ply: botPly,
      },
      gameOver,
      clocks,
    };
  });

  // Resign bot game
  app.post<{ Params: { id: string } }>("/api/games/:id/resign", async (request, reply) => {
    const userId = request.user.userId;
    const { id: gameId } = request.params;

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== "ACTIVE") {
      return reply.status(400).send({ error: "Game not active" });
    }
    if (game.whiteId !== userId && game.blackId !== userId) {
      return reply.status(403).send({ error: "Not your game" });
    }

    const result = game.whiteId === userId ? "BLACK_WIN" : "WHITE_WIN";

    await prisma.game.update({
      where: { id: gameId },
      data: { status: "COMPLETED", result, termination: "RESIGNATION", endedAt: new Date() },
    });

    return { result, termination: "RESIGNATION" };
  });
}
