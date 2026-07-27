import "server-only";
import { headers as nextHeaders } from "next/headers";
import { ApiError } from "./api-error";

// Server Components/Route Handlers can't rely on the browser-only /api/* rewrite (there
// is no browser mid-render), so this calls the NestJS API directly and forwards the
// incoming request's Cookie header by hand. No refresh-on-401 retry here (unlike
// api-client.ts) — Server Components can't set response cookies mid-render, so a
// silent refresh here couldn't actually persist the rotated session; a genuinely
// expired access token just surfaces as an ApiError and the caller redirects to
// /login, matching the "presence-only" split with middleware.ts (Build Plan §4.3).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function serverApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const incoming = await nextHeaders();
  const cookie = incoming.get("cookie") ?? "";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...init?.headers, cookie },
    cache: "no-store",
  });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body);
  }
  return body as T;
}
