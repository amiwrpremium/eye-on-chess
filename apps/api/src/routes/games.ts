import { FastifyInstance } from "fastify";
import { Chess } from "chess.js";
import { prisma } from "../lib/prisma.js";
import { authMiddleware } from "../middleware/auth.js";
import { parsePagination, paginationMeta } from "../lib/pagination.js";
import { initClocks, onMove as clockOnMove } from "../lib/gameClock.js";
import { getIO } from "../lib/socket.js";
import { getBotMove } from "../lib/botEngine.js";
import {
  type TimeControl,
  type GameResult,
  type Termination,
  TIME_CONTROL_PRESETS,
  categorizeTimeControl,
  RESULT_PGN,
} from "@eyeonchess/chess";
import { detectGameEnd } from "../lib/gameHelpers.js";
import {
  apiError,
  GAME_SELF_CHALLENGE,
  GAME_NOT_FRIENDS,
  GAME_NOT_FOUND,
  GAME_ALREADY_RESOLVED,
  GAME_NOT_PARTICIPANT,
  GAME_NOT_ACTIVE,
  GAME_NOT_BOT,
  GAME_NOT_YOUR_TURN,
  GAME_INVALID_MOVE,
  GAME_INVALID_PRESET,
  GAME_BOT_ERROR,
} from "../lib/errorCodes.js";
import {
  createFriendGameBodySchema,
  gameActionBodySchema,
  createBotGameBodySchema,
  makeMoveBodySchema,
  syncOfflineGameBodySchema,
  idParamSchema,
  paginationQuerySchema,
} from "../lib/schemas.js";

/** Register game routes (create, challenge, join, move, bot games). */
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
  }>("/games/friend", { schema: { body: createFriendGameBodySchema } }, async (request, reply) => {
    const userId = request.user.userId;
    const { friendId, preset, initialTime: customTime, increment: customIncrement } = request.body;

    if (friendId === userId) {
      return apiError(reply, 400, GAME_SELF_CHALLENGE, "Cannot challenge yourself");
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
      return apiError(reply, 403, GAME_NOT_FRIENDS, "Must be friends to challenge");
    }

    // Resolve time control
    let timeControl: TimeControl;
    let initialTime: number;
    let increment: number;

    if (preset && TIME_CONTROL_PRESETS[preset]) {
      const p = TIME_CONTROL_PRESETS[preset];
      timeControl = p.timeControl;
      initialTime = p.initialTime;
      increment = p.increment;
    } else if (customTime !== undefined) {
      initialTime = customTime;
      increment = customIncrement ?? 0;
      timeControl = categorizeTimeControl(initialTime, increment);
    } else {
      return apiError(reply, 400, GAME_INVALID_PRESET, "Must provide preset or custom time");
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
  app.post<{ Body: { gameId: string } }>(
    "/games/challenge/accept",
    { schema: { body: gameActionBodySchema } },
    async (request, reply) => {
      const userId = request.user.userId;
      const { gameId } = request.body;

      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game) {
        return apiError(reply, 404, GAME_NOT_FOUND, "Game not found");
      }

      if (game.status !== "WAITING") {
        return apiError(reply, 400, GAME_ALREADY_RESOLVED, "Challenge already resolved");
      }

      if (game.whiteId !== userId && game.blackId !== userId) {
        return apiError(reply, 403, GAME_NOT_PARTICIPANT, "Not part of this challenge");
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
    }
  );

  // Decline challenge
  app.post<{ Body: { gameId: string } }>(
    "/games/challenge/decline",
    { schema: { body: gameActionBodySchema } },
    async (request, reply) => {
      const userId = request.user.userId;
      const { gameId } = request.body;

      const game = await prisma.game.findUnique({ where: { id: gameId } });
      if (!game) {
        return apiError(reply, 404, GAME_NOT_FOUND, "Game not found");
      }

      if (game.status !== "WAITING") {
        return apiError(reply, 400, GAME_ALREADY_RESOLVED, "Challenge already resolved");
      }

      if (game.whiteId !== userId && game.blackId !== userId) {
        return apiError(reply, 403, GAME_NOT_PARTICIPANT, "Not part of this challenge");
      }

      await prisma.game.delete({ where: { id: gameId } });

      const io = getIO();
      if (io) {
        io.emit("challenge:declined", { gameId });
      }

      return { success: true };
    }
  );

  // Get game state
  app.get<{ Params: { id: string } }>("/games/:id", async (request, reply) => {
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
      return apiError(reply, 404, GAME_NOT_FOUND, "Game not found");
    }

    return { game };
  });

  // Export PGN
  app.get<{ Params: { id: string } }>("/games/:id/pgn", async (request, reply) => {
    const { id } = request.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        white: { select: { username: true, rating: true } },
        black: { select: { username: true, rating: true } },
        moves: { orderBy: { ply: "asc" }, select: { san: true } },
      },
    });

    if (!game) {
      return apiError(reply, 404, GAME_NOT_FOUND, "Game not found");
    }

    const date = game.createdAt.toISOString().split("T")[0].replace(/-/g, ".");
    const whiteName =
      game.white?.username || (game.isVsBot && !game.whiteId ? `Bot (${game.botElo})` : "?");
    const blackName =
      game.black?.username || (game.isVsBot && !game.blackId ? `Bot (${game.botElo})` : "?");
    const whiteElo = game.white?.rating?.toString() || game.botElo?.toString() || "?";
    const blackElo = game.black?.rating?.toString() || game.botElo?.toString() || "?";

    const result = game.result ? RESULT_PGN[game.result] || "*" : "*";

    const timeStr =
      game.timeControl === "UNLIMITED" ? "-" : `${game.initialTime}+${game.increment}`;
    const termination = game.termination?.toLowerCase() || "unknown";

    // Build PGN text
    let pgn = "";
    pgn += `[Event "EyeOnChess"]\n`;
    pgn += `[Site "${process.env.SITE_URL || "http://localhost"}"]\n`;
    pgn += `[Date "${date}"]\n`;
    pgn += `[Round "-"]\n`;
    pgn += `[White "${whiteName}"]\n`;
    pgn += `[Black "${blackName}"]\n`;
    pgn += `[Result "${result}"]\n`;
    pgn += `[WhiteElo "${whiteElo}"]\n`;
    pgn += `[BlackElo "${blackElo}"]\n`;
    pgn += `[TimeControl "${timeStr}"]\n`;
    pgn += `[Termination "${termination}"]\n`;
    pgn += `\n`;

    // Use stored PGN or reconstruct from moves
    if (game.pgn && game.pgn.trim()) {
      pgn += game.pgn;
    } else {
      const sans = game.moves.map((m) => m.san);
      for (let i = 0; i < sans.length; i++) {
        if (i % 2 === 0) pgn += `${Math.floor(i / 2) + 1}. `;
        pgn += sans[i] + " ";
      }
    }

    if (result !== "*") pgn += ` ${result}`;

    reply.header("Content-Type", "text/plain; charset=utf-8");
    reply.header(
      "Content-Disposition",
      `attachment; filename="${whiteName}_vs_${blackName}_${date}.pgn"`
    );
    return reply.send(pgn);
  });

  // Get user's active game (if any)
  app.get("/games/active", async (request) => {
    const userId = request.user.userId;

    const game = await prisma.game.findFirst({
      where: {
        status: "ACTIVE",
        OR: [{ whiteId: userId }, { blackId: userId }],
      },
      include: {
        white: { select: { id: true, username: true, rating: true, avatarUrl: true } },
        black: { select: { id: true, username: true, rating: true, avatarUrl: true } },
        moves: { orderBy: { ply: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    return { game };
  });

  // Get user's game history
  app.get<{
    Querystring: { page?: string; limit?: string };
  }>("/games/history", async (request) => {
    const userId = request.user.userId;
    const { page, limit, skip, take } = parsePagination(request.query);

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
        skip,
        take,
      }),
      prisma.game.count({ where }),
    ]);

    return {
      games,
      pagination: paginationMeta(page, limit, total),
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
  }>("/games/bot", { schema: { body: createBotGameBodySchema } }, async (request, reply) => {
    const userId = request.user.userId;
    const {
      botElo,
      color,
      preset,
      initialTime: customTime,
      increment: customIncrement,
    } = request.body;

    // Resolve time control
    let timeControl: TimeControl;
    let initialTime: number;
    let increment: number;

    if (preset && TIME_CONTROL_PRESETS[preset]) {
      const p = TIME_CONTROL_PRESETS[preset];
      timeControl = p.timeControl;
      initialTime = p.initialTime;
      increment = p.increment;
    } else if (customTime !== undefined) {
      initialTime = customTime;
      increment = customIncrement ?? 0;
      timeControl = categorizeTimeControl(initialTime, increment);
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
  }>(
    "/games/:id/move",
    { schema: { body: makeMoveBodySchema, params: idParamSchema } },
    async (request, reply) => {
      const userId = request.user.userId;
      const { id: gameId } = request.params;
      const { from, to, promotion } = request.body;

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { moves: { orderBy: { ply: "desc" }, take: 1 } },
      });

      if (!game) return apiError(reply, 404, GAME_NOT_FOUND, "Game not found");
      if (game.status !== "ACTIVE") return apiError(reply, 400, GAME_NOT_ACTIVE, "Game not active");
      if (!game.isVsBot) return apiError(reply, 400, GAME_NOT_BOT, "Not a bot game");
      if (game.whiteId !== userId && game.blackId !== userId) {
        return apiError(reply, 403, GAME_NOT_PARTICIPANT, "Not your game");
      }

      const chess = new Chess(game.fen);

      // Verify it's the player's turn
      const isWhiteTurn = chess.turn() === "w";
      const playerIsWhite = game.whiteId === userId;
      if (isWhiteTurn !== playerIsWhite) {
        return apiError(reply, 400, GAME_NOT_YOUR_TURN, "Not your turn");
      }

      // Validate and apply player move
      const playerMove = chess.move({ from, to, promotion: promotion || undefined });
      if (!playerMove) return apiError(reply, 400, GAME_INVALID_MOVE, "Invalid move");

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
      const ended = detectGameEnd(chess);
      if (ended) {
        await prisma.game.update({
          where: { id: gameId },
          data: {
            fen: chess.fen(),
            pgn: chess.pgn(),
            status: "COMPLETED",
            result: ended.result,
            termination: ended.termination,
            endedAt: new Date(),
          },
        });

        return {
          playerMove: {
            from,
            to,
            promotion,
            san: playerMove.san,
            fen: chess.fen(),
            ply: currentPly,
          },
          botMove: null,
          gameOver: { result: ended.result, termination: ended.termination },
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
        return apiError(reply, 500, GAME_BOT_ERROR, "Bot produced invalid move");
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
      const botEnded = detectGameEnd(chess);
      const gameOver = botEnded
        ? { result: botEnded.result, termination: botEnded.termination }
        : null;

      if (botEnded) {
        await prisma.game.update({
          where: { id: gameId },
          data: {
            fen: chess.fen(),
            pgn: chess.pgn(),
            status: "COMPLETED",
            result: botEnded.result,
            termination: botEnded.termination,
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
    }
  );

  // Resign bot game
  app.post<{ Params: { id: string } }>("/games/:id/resign", async (request, reply) => {
    const userId = request.user.userId;
    const { id: gameId } = request.params;

    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== "ACTIVE") {
      return apiError(reply, 400, GAME_NOT_ACTIVE, "Game not active");
    }
    if (game.whiteId !== userId && game.blackId !== userId) {
      return apiError(reply, 403, GAME_NOT_PARTICIPANT, "Not your game");
    }

    const result = game.whiteId === userId ? "BLACK_WIN" : "WHITE_WIN";

    await prisma.game.update({
      where: { id: gameId },
      data: { status: "COMPLETED", result, termination: "RESIGNATION", endedAt: new Date() },
    });

    return { result, termination: "RESIGNATION" };
  });

  // Sync an offline bot game
  app.post<{
    Body: {
      botElo: number;
      playerIsWhite: boolean;
      moves: { ply: number; san: string; uci: string; fen: string }[];
      result: string | null;
      termination: string | null;
      startedAt: string;
      endedAt: string | null;
    };
  }>("/games/sync", { schema: { body: syncOfflineGameBodySchema } }, async (request, reply) => {
    const userId = request.user.userId;
    const { botElo, playerIsWhite, moves, result, termination, startedAt, endedAt } = request.body;

    // Validate moves by replaying
    const chess = new Chess();
    for (const m of moves) {
      const move = chess.move(m.san);
      if (!move) {
        return apiError(reply, 400, GAME_INVALID_MOVE, `Invalid move at ply ${m.ply}: ${m.san}`);
      }
    }

    // Create game + moves in a transaction (atomic)
    const game = await prisma.$transaction(async (tx) => {
      const g = await tx.game.create({
        data: {
          whiteId: playerIsWhite ? userId : null,
          blackId: playerIsWhite ? null : userId,
          status: result ? "COMPLETED" : "ABORTED",
          result: result as GameResult | null,
          termination: termination as Termination | null,
          fen: chess.fen(),
          pgn: chess.pgn(),
          timeControl: "UNLIMITED",
          initialTime: 0,
          increment: 0,
          isVsBot: true,
          botElo,
          startedAt: new Date(startedAt),
          endedAt: endedAt ? new Date(endedAt) : null,
        },
      });

      await tx.move.createMany({
        data: moves.map((m) => ({
          gameId: g.id,
          ply: m.ply,
          san: m.san,
          uci: m.uci,
          fen: m.fen,
        })),
      });

      return g;
    });

    return { success: true, gameId: game.id };
  });
}
