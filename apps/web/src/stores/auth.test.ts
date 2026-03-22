import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the api module and setAccessToken
vi.mock("../lib/api", () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
  setAccessToken: vi.fn(),
}));

// Mock the settings store
vi.mock("./settings", () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      loadFromUser: vi.fn(),
    })),
  },
}));

import { useAuthStore } from "./auth";
import api, { setAccessToken } from "../lib/api";

describe("useAuthStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store to initial-like state
    useAuthStore.setState({ user: null, isLoading: true });
  });

  it("has correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoading).toBe(true);
  });

  it("has expected interface shape", () => {
    const state = useAuthStore.getState();
    expect(state).toHaveProperty("user");
    expect(state).toHaveProperty("isLoading");
    expect(typeof state.register).toBe("function");
    expect(typeof state.login).toBe("function");
    expect(typeof state.logout).toBe("function");
    expect(typeof state.refresh).toBe("function");
    expect(typeof state.fetchMe).toBe("function");
  });

  it("login sets user and calls setAccessToken", async () => {
    const mockUser = {
      id: "1",
      email: "test@test.com",
      username: "tester",
      rating: 1200,
      darkMode: true,
      boardTheme: "classic",
      pieceSet: "classic",
      soundEnabled: true,
    };

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { accessToken: "tok-123", user: mockUser },
    });

    await useAuthStore.getState().login("test@test.com", "pass");

    expect(api.post).toHaveBeenCalledWith("/api/auth/login", {
      email: "test@test.com",
      password: "pass",
    });
    expect(setAccessToken).toHaveBeenCalledWith("tok-123");
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("logout clears user and token", async () => {
    useAuthStore.setState({ user: { id: "1", email: "a@b.com", username: "u", rating: 1200 } });

    vi.mocked(api.post).mockResolvedValueOnce({ data: {} });

    await useAuthStore.getState().logout();

    expect(api.post).toHaveBeenCalledWith("/api/auth/logout");
    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("register sets user and token", async () => {
    const mockUser = { id: "2", email: "new@test.com", username: "newuser", rating: 1000 };

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { accessToken: "tok-new", user: mockUser },
    });

    await useAuthStore.getState().register("new@test.com", "newuser", "password123");

    expect(api.post).toHaveBeenCalledWith("/api/auth/register", {
      email: "new@test.com",
      username: "newuser",
      password: "password123",
      inviteCode: undefined,
    });
    expect(setAccessToken).toHaveBeenCalledWith("tok-new");
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it("refresh sets token on success", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { accessToken: "tok-refreshed" },
    });

    await useAuthStore.getState().refresh();

    expect(api.post).toHaveBeenCalledWith("/api/auth/refresh");
    expect(setAccessToken).toHaveBeenCalledWith("tok-refreshed");
  });

  it("refresh clears user on failure", async () => {
    useAuthStore.setState({ user: { id: "1", email: "a@b.com", username: "u", rating: 1200 } });

    vi.mocked(api.post).mockRejectedValueOnce(new Error("expired"));

    await useAuthStore.getState().refresh();

    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("fetchMe refreshes token then fetches user profile", async () => {
    const mockUser = {
      id: "1",
      email: "me@test.com",
      username: "me",
      rating: 1500,
      darkMode: true,
      boardTheme: "classic",
      pieceSet: "classic",
    };

    vi.mocked(api.post).mockResolvedValueOnce({
      data: { accessToken: "tok-fresh" },
    });
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { user: mockUser },
    });

    await useAuthStore.getState().fetchMe();

    expect(api.post).toHaveBeenCalledWith("/api/auth/refresh");
    expect(api.get).toHaveBeenCalledWith("/api/auth/me");
    expect(setAccessToken).toHaveBeenCalledWith("tok-fresh");
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isLoading).toBe(false);
  });

  it("fetchMe clears user on failure", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("fail"));

    await useAuthStore.getState().fetchMe();

    expect(setAccessToken).toHaveBeenCalledWith(null);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isLoading).toBe(false);
  });
});
