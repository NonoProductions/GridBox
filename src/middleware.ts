import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Server-side middleware for route protection.
 * - Blocks test/debug routes in production
 * - Requires auth headers on admin API routes
 * - Requires station key on ESP API routes
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Block test/debug routes in production ---
  if (process.env.NODE_ENV === "production") {
    if (
      pathname.startsWith("/test-env") ||
      pathname.startsWith("/simple-test") ||
      pathname.startsWith("/qr-test")
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  // --- Protect admin API routes: require Authorization header ---
  if (pathname.startsWith("/api/admin/")) {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Authentication required" },
        { status: 401 }
      );
    }
  }

  // --- Protect ESP API routes: require X-Station-Key header ---
  if (pathname.startsWith("/api/esp/")) {
    const stationKey = request.headers.get("x-station-key");
    if (!stationKey) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/admin/:path*",
    "/api/esp/:path*",
    "/test-env",
    "/simple-test",
    "/qr-test",
  ],
};
