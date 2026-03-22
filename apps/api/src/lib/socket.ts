import { Server as HttpServer } from "http";
import { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "./jwt.js";
import { setOnline, setOffline } from "./redis.js";

let io: SocketServer;

/**
 * Initialize the Socket.IO server with JWT authentication and online-status tracking.
 * @param httpServer - The HTTP server to attach Socket.IO to.
 * @returns The configured Socket.IO server instance.
 */
export function setupSocket(httpServer: HttpServer) {
  io = new SocketServer(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error("Missing token"));
    }
    try {
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.data.userId as string;
    await setOnline(userId);

    socket.on("heartbeat", async () => {
      await setOnline(userId);
    });

    socket.on("disconnect", async () => {
      await setOffline(userId);
    });
  });

  return io;
}

/**
 * Return the shared Socket.IO server instance.
 * @returns The Socket.IO server.
 */
export function getIO(): SocketServer {
  return io;
}
