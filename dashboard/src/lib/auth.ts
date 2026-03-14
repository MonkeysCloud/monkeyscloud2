import { api } from "./api";

interface LoginResponse {
  tokens: { access_token: string; refresh_token: string };
  user: { id: number; email: string; name: string; avatar_url?: string };
}

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  organization_name?: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const data = await api.post<LoginResponse>("/api/v1/auth/login", { email, password });
  if (typeof window !== "undefined" && data.tokens) {
    localStorage.setItem("mc_token", data.tokens.access_token);
    localStorage.setItem("mc_refresh", data.tokens.refresh_token);
  }
  return data;
}

export async function register(payload: RegisterPayload): Promise<LoginResponse> {
  const data = await api.post<LoginResponse>("/api/v1/auth/register", payload);
  if (typeof window !== "undefined" && data.tokens) {
    localStorage.setItem("mc_token", data.tokens.access_token);
    localStorage.setItem("mc_refresh", data.tokens.refresh_token);
  }
  return data;
}

export function logout() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("mc_token");
    localStorage.removeItem("mc_refresh");
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("mc_token");
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
