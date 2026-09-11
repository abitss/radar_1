import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/magic-link",
  "/api/auth/session-from-token",
  "/api/radar/firecrawl-webhook",
];
const LEGACY_REDIRECTS: Record<string,string> = {
  "/customers":"/market",
  "/money":"/market",
  "/briefings":"/signals",
  "/actions":"/decisions",
  "/outcomes":"/decisions",
  "/market-map":"/market",
  "/watch-graph":"/market",
  "/monitor":"/market",
  "/intelligence":"/market",
  "/brain":"/settings",
  "/sources":"/settings",
  "/system-health":"/settings",
};

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) return NextResponse.next();
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname.endsWith(".svg") || pathname.endsWith(".png")) return NextResponse.next();

  const session = request.cookies.get("radar_session")?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const exact = LEGACY_REDIRECTS[pathname];
  if (exact) {
    const url = request.nextUrl.clone();
    url.pathname = exact;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
