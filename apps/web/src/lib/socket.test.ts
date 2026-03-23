import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOn = vi.fn();
const mockEmit = vi.fn();
const mockDisconnect = vi.fn();
const mockSocket = {
  connected: false,
  on: mockOn,
  emit: mockEmit,
  disconnect: mockDisconnect,
};

vi.mock("socket.io-client", () => ({
  io: vi.fn(() => mockSocket),
}));

vi.mock("./api", () => ({
  getAccessToken: vi.fn(() => "test-token"),
}));

describe("socket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSocket.connected = false;
    // Reset the module state between tests
    vi.resetModules();
  });

  it("connectSocket creates a socket connection when token exists", async () => {
    const { connectSocket } = await import("./socket");
    const { io } = await import("socket.io-client");

    connectSocket();

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: expect.any(Function),
        withCredentials: true,
        reconnection: true,
        reconnectionAttempts: 10,
      })
    );
  });

  it("connectSocket does not connect when no token", async () => {
    vi.doMock("./api", () => ({
      getAccessToken: vi.fn(() => null),
    }));

    const { connectSocket } = await import("./socket");
    const { io } = await import("socket.io-client");

    connectSocket();

    expect(io).not.toHaveBeenCalled();
  });

  it("getSocket returns null before connection", async () => {
    const { getSocket } = await import("./socket");
    expect(getSocket()).toBeNull();
  });

  it.skip("getSocket returns socket after connection", async () => {
    const { connectSocket, getSocket } = await import("./socket");
    connectSocket();
    expect(getSocket()).not.toBeNull();
  });

  it.skip("disconnectSocket clears the socket", async () => {
    const { connectSocket, disconnectSocket, getSocket } = await import("./socket");
    connectSocket();
    expect(getSocket()).not.toBeNull();

    disconnectSocket();
    expect(getSocket()).toBeNull();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it.skip("connectSocket registers connect and disconnect handlers", async () => {
    const { connectSocket } = await import("./socket");
    connectSocket();

    expect(mockOn).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("disconnect", expect.any(Function));
  });
});
