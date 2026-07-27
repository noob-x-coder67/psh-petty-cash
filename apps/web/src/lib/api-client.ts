import { ApiError } from "./api-error";

// Browser-side fetch wrapper — goes through the /api/* rewrite (next.config.ts) so the
// session cookie stays first-party (Build Plan §6.2). Reads the CSRF cookie itself:
// psh_csrf_token is deliberately non-httpOnly so JS can echo it back as X-CSRF-Token on
// state-changing requests (auth.controller.ts's CsrfGuard, double-submit pattern).

function readCsrfToken(): string | null {
  const match = /(?:^|;\s*)psh_csrf_token=([^;]+)/.exec(document.cookie);
  const value = match?.[1];
  return value ? decodeURIComponent(value) : null;
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const headers = new Headers(init?.headers);
  if (method !== "GET" && method !== "HEAD") {
    const csrfToken = readCsrfToken();
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }
  if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(`/api${path}`, { ...init, headers, credentials: "same-origin" });
}

let refreshInFlight: Promise<boolean> | null = null;

// Access tokens live 15 minutes; refresh tokens live 12 hours (auth.service.ts). A 401
// on any authenticated call is attempted exactly once against /auth/refresh before
// giving up, so a user mid-session doesn't get bounced to /login just because the access
// token happened to expire between page loads.
async function attemptRefresh(): Promise<boolean> {
  refreshInFlight ??= rawFetch("/auth/refresh", { method: "POST" })
    .then((res) => res.ok)
    .finally(() => {
      refreshInFlight = null;
    });
  return refreshInFlight;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res = await rawFetch(path, init);
  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/refresh") {
    const refreshed = await attemptRefresh();
    if (refreshed) {
      res = await rawFetch(path, init);
    }
  }
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}
