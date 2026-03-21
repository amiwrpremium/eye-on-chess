import api from "./api";

let csrfToken: string | null = null;

export async function fetchCsrfToken() {
  const { data } = await api.get("/api/admin/csrf");
  csrfToken = data.token;
  return csrfToken;
}

export async function adminRequest(
  method: "get" | "post" | "put" | "patch" | "delete",
  url: string,
  body?: unknown
) {
  // Ensure CSRF token for mutations
  if (method !== "get" && !csrfToken) {
    await fetchCsrfToken();
  }

  const headers: Record<string, string> = {};
  if (method !== "get" && csrfToken) {
    headers["x-csrf-token"] = csrfToken;
  }

  const { data } = await api.request({
    method,
    url,
    data: body,
    headers,
  });
  return data;
}
