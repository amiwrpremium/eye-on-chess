import { create } from "zustand";
import api, { setAccessToken } from "../lib/api";
import { useSettingsStore } from "./settings";

interface User {
  id: string;
  email: string;
  username: string;
  rating: number;
  role?: string;
  avatarUrl?: string | null;
  darkMode?: boolean;
  boardTheme?: string;
  pieceSet?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  register: (email: string, username: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

function syncSettings(user: User) {
  if (user.darkMode !== undefined && user.boardTheme && user.pieceSet) {
    useSettingsStore.getState().loadFromUser({
      darkMode: user.darkMode,
      boardTheme: user.boardTheme,
      pieceSet: user.pieceSet,
    });
  }
}

// Prevent concurrent fetchMe calls
let fetchMePromise: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  register: async (email, username, password) => {
    const { data } = await api.post("/api/auth/register", {
      email,
      username,
      password,
    });
    setAccessToken(data.accessToken);
    set({ user: data.user });
  },

  login: async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    setAccessToken(data.accessToken);
    set({ user: data.user, isLoading: false });
    syncSettings(data.user);
  },

  logout: async () => {
    await api.post("/api/auth/logout");
    setAccessToken(null);
    set({ user: null });
  },

  refresh: async () => {
    try {
      const { data } = await api.post("/api/auth/refresh");
      setAccessToken(data.accessToken);
    } catch {
      setAccessToken(null);
      set({ user: null });
    }
  },

  fetchMe: async () => {
    // Deduplicate: if already fetching, wait for the existing promise
    if (fetchMePromise) {
      return fetchMePromise;
    }

    fetchMePromise = (async () => {
      try {
        const refreshRes = await api.post("/api/auth/refresh");
        setAccessToken(refreshRes.data.accessToken);

        const { data } = await api.get("/api/auth/me");
        set({ user: data.user, isLoading: false });
        syncSettings(data.user);
      } catch {
        setAccessToken(null);
        set({ user: null, isLoading: false });
      } finally {
        fetchMePromise = null;
      }
    })();

    return fetchMePromise;
  },
}));
