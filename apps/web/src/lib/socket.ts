import { io, Socket } from "socket.io-client";
import { getAccessToken } from "./api";

let socket: Socket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;

export function connectSocket() {
  const token = getAccessToken();
  if (!token) return;

  if (socket?.connected) return;

  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  socket = io(apiUrl, {
    auth: { token },
    withCredentials: true,
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
}

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

export function getSocket(): Socket | null {
  return socket;
}
