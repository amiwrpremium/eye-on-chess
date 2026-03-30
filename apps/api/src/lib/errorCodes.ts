import { FastifyReply } from "fastify";

// ── Generic ────────────────────────────────────────────
export const VALIDATION_FAILED = "VALIDATION_FAILED";
export const NOT_FOUND = "NOT_FOUND";
export const UNAUTHORIZED = "UNAUTHORIZED";
export const FORBIDDEN = "FORBIDDEN";
export const INTERNAL_ERROR = "INTERNAL_ERROR";

// ── Auth ───────────────────────────────────────────────
export const AUTH_INVALID_INVITE = "AUTH_INVALID_INVITE";
export const AUTH_INVITE_USED = "AUTH_INVITE_USED";
export const AUTH_REGISTRATION_CLOSED = "AUTH_REGISTRATION_CLOSED";
export const AUTH_MAX_USERS = "AUTH_MAX_USERS";
export const AUTH_EMAIL_EXISTS = "AUTH_EMAIL_EXISTS";
export const AUTH_USERNAME_EXISTS = "AUTH_USERNAME_EXISTS";
export const AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS";
export const AUTH_ACCOUNT_DEACTIVATED = "AUTH_ACCOUNT_DEACTIVATED";
export const AUTH_EMAIL_NOT_VERIFIED = "AUTH_EMAIL_NOT_VERIFIED";
export const AUTH_NO_REFRESH_TOKEN = "AUTH_NO_REFRESH_TOKEN";
export const AUTH_INVALID_REFRESH_TOKEN = "AUTH_INVALID_REFRESH_TOKEN";
export const AUTH_TOKEN_USED = "AUTH_TOKEN_USED";
export const AUTH_USER_NOT_FOUND = "AUTH_USER_NOT_FOUND";

// ── Games ──────────────────────────────────────────────
export const GAME_NOT_FOUND = "GAME_NOT_FOUND";\nexport const GAME_NOT_SHAREABLE = "GAME_NOT_SHAREABLE";
export const GAME_SELF_CHALLENGE = "GAME_SELF_CHALLENGE";
export const GAME_NOT_FRIENDS = "GAME_NOT_FRIENDS";
export const GAME_ALREADY_RESOLVED = "GAME_ALREADY_RESOLVED";
export const GAME_NOT_PARTICIPANT = "GAME_NOT_PARTICIPANT";
export const GAME_NOT_ACTIVE = "GAME_NOT_ACTIVE";
export const GAME_NOT_BOT = "GAME_NOT_BOT";
export const GAME_NOT_YOUR_TURN = "GAME_NOT_YOUR_TURN";
export const GAME_INVALID_MOVE = "GAME_INVALID_MOVE";
export const GAME_INVALID_PRESET = "GAME_INVALID_PRESET";
export const GAME_BOT_ERROR = "GAME_BOT_ERROR";

// ── Friends ────────────────────────────────────────────
export const FRIEND_USER_NOT_FOUND = "FRIEND_USER_NOT_FOUND";
export const FRIEND_SELF_REQUEST = "FRIEND_SELF_REQUEST";
export const FRIEND_ALREADY_FRIENDS = "FRIEND_ALREADY_FRIENDS";
export const FRIEND_ALREADY_PENDING = "FRIEND_ALREADY_PENDING";
export const FRIEND_REQUEST_NOT_FOUND = "FRIEND_REQUEST_NOT_FOUND";
export const FRIEND_NOT_RECIPIENT = "FRIEND_NOT_RECIPIENT";
export const FRIEND_NOT_PENDING = "FRIEND_NOT_PENDING";
export const FRIEND_NOT_FOUND = "FRIEND_NOT_FOUND";
export const FRIEND_NOT_PARTICIPANT = "FRIEND_NOT_PARTICIPANT";

// ── Admin ──────────────────────────────────────────────
export const ADMIN_FORBIDDEN = "ADMIN_FORBIDDEN";
export const ADMIN_CSRF_INVALID = "ADMIN_CSRF_INVALID";
export const ADMIN_RATE_LIMITED = "ADMIN_RATE_LIMITED";
export const ADMIN_SELF_DEMOTE = "ADMIN_SELF_DEMOTE";
export const ADMIN_SELF_DEACTIVATE = "ADMIN_SELF_DEACTIVATE";
export const ADMIN_LAST_ADMIN = "ADMIN_LAST_ADMIN";
export const ADMIN_SELF_DELETE = "ADMIN_SELF_DELETE";
export const ADMIN_USER_NOT_FOUND = "ADMIN_USER_NOT_FOUND";
export const ADMIN_GAME_NOT_FOUND = "ADMIN_GAME_NOT_FOUND";
export const ADMIN_EMAIL_EXISTS = "ADMIN_EMAIL_EXISTS";
export const ADMIN_USERNAME_EXISTS = "ADMIN_USERNAME_EXISTS";
export const ADMIN_BOT_NOT_FOUND = "ADMIN_BOT_NOT_FOUND";
export const ADMIN_BOT_ID_EXISTS = "ADMIN_BOT_ID_EXISTS";

// ── Collections ────────────────────────────────────────
export const COLLECTION_NOT_FOUND = "COLLECTION_NOT_FOUND";
export const COLLECTION_FORBIDDEN = "COLLECTION_FORBIDDEN";
export const COLLECTION_FAVORITES_PROTECTED = "COLLECTION_FAVORITES_PROTECTED";
export const COLLECTION_NAME_EXISTS = "COLLECTION_NAME_EXISTS";

// ── Invites ────────────────────────────────────────────
export const INVITE_NOT_FOUND = "INVITE_NOT_FOUND";
export const INVITE_ALREADY_USED = "INVITE_ALREADY_USED";
export const INVITE_LIMIT_REACHED = "INVITE_LIMIT_REACHED";

// ── Notes ──────────────────────────────────────────────
export const NOTE_GAME_NOT_FOUND = "NOTE_GAME_NOT_FOUND";

// ── Analysis ───────────────────────────────────────────
export const ANALYSIS_GAME_NOT_FOUND = "ANALYSIS_GAME_NOT_FOUND";
export const ANALYSIS_NOT_COMPLETED = "ANALYSIS_NOT_COMPLETED";
export const ANALYSIS_NOT_PARTICIPANT = "ANALYSIS_NOT_PARTICIPANT";

// ── Helper ─────────────────────────────────────────────

export function apiError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.status(status).send({ code, error: message });
}
