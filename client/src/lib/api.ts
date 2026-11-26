// const API_BASE_URL = "/api";
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "/api";

export function getToken() {
  return localStorage.getItem("teamflow_token");
}

export function setToken(token: string) {
  localStorage.setItem("teamflow_token", token);
}

export function clearToken() {
  localStorage.removeItem("teamflow_token");
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers = new Headers(options.headers);

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }

  return data as T;
}