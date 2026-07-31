import { NextResponse, type NextRequest } from "next/server";

// Build Plan §4.3: "Route protection is enforced in a server-side middleware.ts (session
// presence) plus a per-segment server check (role/permission)." (Next.js 16.2 renamed
// the middleware.ts/middleware() convention to proxy.ts/proxy() — same mechanism, new
// name.) This only checks that an access-token cookie exists — it deliberately does not
// verify the JWT (that needs the signing secret and would mean re-implementing
// verification here); a present-but-expired token still reaches the page/layout, whose
// serverApiFetch("/me") call will get a real 401 and redirect from there. Client-side tab
// hiding is cosmetic only per the same section — this is the actual enforcement point,
// alongside per-segment server checks.
const ACCESS_TOKEN_COOKIE = "psh_access_token";
const PUBLIC_PATHS = ["/login"];

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const hasSession = request.cookies.has(ACCESS_TOKEN_COOKIE);

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Public image/PWA assets must stay outside the auth redirect: next/image fetches its
  // source internally, and browsers must be able to fetch the manifest and its icons
  // before deciding whether the app is installable.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|psh-logo.png|manifest.json|icon-192.png|icon-512.png|api).*)",
  ],
};
