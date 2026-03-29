import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost",
  withCredentials: true,
});

let accessToken: string | null = null;

/**
 * Sets the in-memory access token used for API request authorization.
 *
 * @param token - The JWT access token, or null to clear it.
 */
export function setAccessToken(token: string | null) {
  accessToken = token;
}

/**
 * Returns the current in-memory access token.
 *
 * @returns The JWT access token, or null if not set.
 */
export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // Don't retry refresh or login/register requests
    if (
      originalRequest.url?.includes("/api/v1/auth/refresh") ||
      originalRequest.url?.includes("/api/v1/auth/login") ||
      originalRequest.url?.includes("/api/v1/auth/register")
    ) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve) => {
        refreshSubscribers.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const { data } = await api.post("/api/v1/auth/refresh");
      accessToken = data.accessToken;
      isRefreshing = false;
      onRefreshed(data.accessToken);
      originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
      return api(originalRequest);
    } catch {
      isRefreshing = false;
      accessToken = null;
      refreshSubscribers = [];
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
  }
);

/** Pre-configured Axios instance with auth token injection and automatic 401 refresh. */
export default api;
