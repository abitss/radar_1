import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/signup",
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

function harden(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico" || pathname.endsWith(".svg") || pathname.endsWith(".png")) return NextResponse.next();
  if (PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) return harden(NextResponse.next());

  const session = request.cookies.get("radar_session")?.value;
  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return harden(NextResponse.redirect(url));
  }

  const exact = LEGACY_REDIRECTS[pathname];
  if (exact) {
    const url = request.nextUrl.clone();
    url.pathname = exact;
    url.search = "";
    return harden(NextResponse.redirect(url));
  }
  return harden(NextResponse.next());
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
