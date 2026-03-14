const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown,
    message?: string
  ) {
    super(message || `API Error ${status}`);
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const raw =
    typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
  const token = raw && raw !== "undefined" && raw !== "null" ? raw : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(res.status, data, data?.error || res.statusText);
  }

  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Upload FormData (multipart) — does NOT set Content-Type so browser adds boundary */
  upload: <T>(path: string, formData: FormData) => {
    const raw =
      typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
    const token = raw && raw !== "undefined" && raw !== "null" ? raw : null;
    return fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new ApiError(res.status, data, data?.error || res.statusText);
      }
      if (res.status === 204) return null as T;
      return res.json() as Promise<T>;
    });
  },
};

// SWR fetcher
export const fetcher = <T>(path: string) => api.get<T>(path);
