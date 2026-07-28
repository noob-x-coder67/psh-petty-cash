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
  // psh-logo.png (apps/web/public/) must stay excluded alongside favicon.ico: next/image's
  // optimizer fetches public/ source files via an internal HTTP request on this same
  // server, which without this exclusion gets caught by the auth check above and
  // redirected to /login — Next then reports "not a valid image" for what was actually
  // an HTML redirect response, not a bad file. Any future public/ asset referenced by
  // <Image>/<img> on a page needs the same treatment here.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|psh-logo.png|api).*)"],
};
