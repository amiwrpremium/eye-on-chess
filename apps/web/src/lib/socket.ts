import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./api";

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Establishes a Socket.IO connection to the API server.
 *
 * Configured with resilient reconnection:
 * - Auth token refreshed on each reconnect attempt (handles JWT expiry)
 * - Exponential backoff: 1s → 10s cap, up to 10 attempts
 * - Heartbeat every 20s to maintain online presence
 */
export function connectSocket() {
  const token = getAccessToken();
  if (!token) return;

  if (socket?.connected) return;

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost";

  socket = io(apiUrl, {
    // Auth as function — called on each reconnect to get fresh token
    auth: (cb) => {
      cb({ token: getAccessToken() || token });
    },
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });

  socket.on("connect", () => {
    // Start heartbeat
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      socket?.emit("heartbeat");
    }, 20_000);
  });

  socket.on("disconnect", () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  // Handle auth errors on reconnect — try refreshing token
  socket.on("connect_error", async (err) => {
    if (err.message === "Invalid token" || err.message === "Missing token") {
      try {
        const api = (await import("./api")).default;
        await api.post("/api/auth/refresh");
      } catch {
        // Token refresh failed — user will need to re-login
      }
    }
  });
}

/**
 * Disconnects the active Socket.IO connection and clears the heartbeat interval.
 */
export function disconnectSocket() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Returns the current Socket.IO client instance, or null if not connected.
 *
 * @returns The active socket instance or null.
 */
export function getSocket(): Socket | null {
  return socket;
}
