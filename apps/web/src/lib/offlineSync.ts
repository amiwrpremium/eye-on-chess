"use client";

import api from "./api";

interface OfflineGame {
  id: string;
  botElo: number;
  playerIsWhite: boolean;
  moves: { ply: number; san: string; uci: string; fen: string }[];
  result: string | null;
  termination: string | null;
  startedAt: string;
  endedAt: string | null;
}

const STORAGE_KEY = "eyeonchess-offline-games";

function loadPending(): OfflineGame[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePending(games: OfflineGame[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  } catch {
    // storage full — drop oldest
  }
}

/**
 * Saves or updates an offline game in localStorage for later sync.
 *
 * @param game - The offline game data to persist.
 */
export function saveOfflineGame(game: OfflineGame) {
  const pending = loadPending();
  // Replace if same id exists, otherwise append
  const idx = pending.findIndex((g) => g.id === game.id);
  if (idx >= 0) {
    pending[idx] = game;
  } else {
    pending.push(game);
  }
  savePending(pending);
}

/**
 * Returns the number of offline games waiting to be synced.
 *
 * @returns The count of pending offline games in localStorage.
 */
export function getPendingCount(): number {
  return loadPending().length;
}

/**
 * Attempts to sync all pending offline games to the server.
 * Games that fail to sync remain in localStorage for the next attempt.
 *
 * @returns The number of games successfully synced.
 */
export async function syncOfflineGames(): Promise<{ synced: number; failed: number }> {
  const pending = loadPending();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  const remaining: OfflineGame[] = [];

  for (const game of pending) {
    try {
      await api.post("/api/v1/games/sync", {
        botElo: game.botElo,
        playerIsWhite: game.playerIsWhite,
        moves: game.moves,
        result: game.result,
        termination: game.termination,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
      });
      synced++;
    } catch {
      remaining.push(game);
    }
  }

  savePending(remaining);
  return { synced, failed: remaining.length };
}

/**
 * Generates a unique ID for an offline game using timestamp and random suffix.
 *
 * @returns A string ID prefixed with "offline-".
 */
export function generateOfflineGameId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pending sync queue (for online games that failed to sync moves) ──

interface PendingSync {
  gameId: string;
  moves: { ply: number; san: string; uci: string; fen: string }[];
  result: string | null;
  termination: string | null;
}

const PENDING_SYNC_KEY = "eyeonchess-pending-syncs";

function loadPendingSyncs(): PendingSync[] {
  try {
    const raw = localStorage.getItem(PENDING_SYNC_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePendingSyncs(syncs: PendingSync[]) {
  try {
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(syncs));
  } catch {}
}

export function savePendingSync(sync: PendingSync) {
  const pending = loadPendingSyncs();
  const idx = pending.findIndex((s) => s.gameId === sync.gameId);
  if (idx >= 0) {
    pending[idx] = sync;
  } else {
    pending.push(sync);
  }
  savePendingSyncs(pending);
}

export function getPendingSyncCount(): number {
  return loadPendingSyncs().length;
}

export async function retryPendingSyncs(): Promise<{ synced: number; failed: number }> {
  const pending = loadPendingSyncs();
  if (pending.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  const remaining: PendingSync[] = [];

  for (const sync of pending) {
    try {
      await api.post(`/api/v1/games/${sync.gameId}/sync-moves`, {
        moves: sync.moves,
        fen: "",
        result: sync.result,
        termination: sync.termination,
      });
      synced++;
    } catch {
      remaining.push(sync);
    }
  }

  savePendingSyncs(remaining);
  return { synced, failed: remaining.length };
}

// ── In-progress game persistence (prevents mid-game data loss) ──

export interface InProgressGame {
  id: string;
  botElo: number;
  playerIsWhite: boolean;
  moves: { ply: number; san: string; uci: string; fen: string }[];
  gameStartTime: string;
  activeSettings: Record<string, boolean>;
  botId: string | null;
  isOnline: boolean;
  savedAt: string;
}

const IN_PROGRESS_PREFIX = "eyeonchess-game-";

export function saveInProgress(id: string, data: InProgressGame) {
  try {
    localStorage.setItem(IN_PROGRESS_PREFIX + id, JSON.stringify(data));
  } catch {}
}

export function loadInProgress(id: string): InProgressGame | null {
  try {
    const raw = localStorage.getItem(IN_PROGRESS_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearInProgress(id: string) {
  try {
    localStorage.removeItem(IN_PROGRESS_PREFIX + id);
  } catch {}
}
