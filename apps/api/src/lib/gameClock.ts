import { redis } from "./redis.js";
import { prisma } from "./prisma.js";
import type { ClockState } from "@eyeonchess/chess";
/** Re-exported clock state representing each player's remaining time and turn info. */
export type { ClockState } from "@eyeonchess/chess";

function clockKey(gameId: string) {
  return `clock:${gameId}`;
}

const ACTIVE_GAMES_KEY = "active_games";

/**
 * Initialize clocks for a new game and register it as active.
 * @param gameId - The game identifier.
 * @param initialTimeMs - Starting time for each player in milliseconds.
 * @param incrementMs - Increment added per move in milliseconds.
 */
export async function initClocks(gameId: string, initialTimeMs: number, incrementMs: number) {
  const state: ClockState = {
    whiteTimeLeft: initialTimeMs,
    blackTimeLeft: initialTimeMs,
    lastMoveTimestamp: Date.now(),
    turn: "white",
    increment: incrementMs,
  };
  const pipeline = redis.pipeline();
  pipeline.set(clockKey(gameId), JSON.stringify(state));
  pipeline.sadd(ACTIVE_GAMES_KEY, gameId);
  await pipeline.exec();
}

/**
 * Retrieve the stored clock state for a game without adjusting for elapsed time.
 * @param gameId - The game identifier.
 * @returns The clock state, or null if not found.
 */
export async function getClocks(gameId: string): Promise<ClockState | null> {
  const raw = await redis.get(clockKey(gameId));
  if (!raw) return null;
  return JSON.parse(raw);
}

/**
 * Retrieve the clock state with elapsed time deducted for the active player.
 * @param gameId - The game identifier.
 * @returns The real-time adjusted clock state, or null if not found.
 */
/**
 * Attempt to recover clock state from the database when Redis key is missing.
 * Resets clocks to initial time — not perfect, but prevents stuck games.
 */
async function recoverClocks(gameId: string): Promise<ClockState | null> {
  try {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        initialTime: true,
        increment: true,
        timeControl: true,
        moves: { orderBy: { ply: "desc" as const }, take: 1, select: { createdAt: true } },
      },
    });
    if (!game || game.timeControl === "UNLIMITED") return null;

    const initialTimeMs = game.initialTime * 1000;
    const incrementMs = game.increment * 1000;
    await initClocks(gameId, initialTimeMs, incrementMs);
    return getClocks(gameId);
  } catch {
    return null;
  }
}

export async function getClocksRealtime(gameId: string): Promise<ClockState | null> {
  let state = await getClocks(gameId);
  if (!state) {
    // Attempt recovery from DB
    state = await recoverClocks(gameId);
    if (!state) return null;
  }

  // Deduct elapsed time for the active player
  const elapsed = Date.now() - state.lastMoveTimestamp;
  if (state.turn === "white") {
    state.whiteTimeLeft = Math.max(0, state.whiteTimeLeft - elapsed);
  } else {
    state.blackTimeLeft = Math.max(0, state.blackTimeLeft - elapsed);
  }
  return state;
}

/**
 * Update clocks after a move: deduct elapsed time, add increment, and switch turns.
 * @param gameId - The game identifier.
 * @param isUnlimited - If true, skip time deduction and increment.
 * @returns The updated clock state, or null if not found.
 */
export async function onMove(gameId: string, isUnlimited: boolean): Promise<ClockState | null> {
  const state = await getClocks(gameId);
  if (!state) return null;

  if (!isUnlimited) {
    const elapsed = Date.now() - state.lastMoveTimestamp;
    if (state.turn === "white") {
      state.whiteTimeLeft = Math.max(0, state.whiteTimeLeft - elapsed) + state.increment;
    } else {
      state.blackTimeLeft = Math.max(0, state.blackTimeLeft - elapsed) + state.increment;
    }
  }

  state.turn = state.turn === "white" ? "black" : "white";
  state.lastMoveTimestamp = Date.now();

  await redis.set(clockKey(gameId), JSON.stringify(state));
  return state;
}

/**
 * Check whether either player has run out of time.
 * @param gameId - The game identifier.
 * @returns The color that timed out, or null if neither has.
 */
export async function isTimeout(gameId: string): Promise<"white" | "black" | null> {
  const state = await getClocksRealtime(gameId);
  if (!state) return null;
  if (state.whiteTimeLeft <= 0) return "white";
  if (state.blackTimeLeft <= 0) return "black";
  return null;
}

/**
 * Remove a game from the active set and delete its clock data from Redis.
 * @param gameId - The game identifier.
 */
export async function removeActiveGame(gameId: string) {
  const pipeline = redis.pipeline();
  pipeline.srem(ACTIVE_GAMES_KEY, gameId);
  pipeline.del(clockKey(gameId));
  await pipeline.exec();
}

/**
 * Return the IDs of all games currently tracked as active.
 * @returns An array of active game IDs.
 */
export async function getActiveGameIds(): Promise<string[]> {
  return redis.smembers(ACTIVE_GAMES_KEY);
}
