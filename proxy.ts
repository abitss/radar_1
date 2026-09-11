import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/signup", "/api/radar/firecrawl-webhook"];

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
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
