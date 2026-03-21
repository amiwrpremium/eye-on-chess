import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedRoutes = ["/play", "/friends", "/game", "/settings", "/admin", "/history"];
const authRoutes = ["/login", "/register"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = request.cookies.has("refresh_token");

  // Redirect authenticated users away from auth pages
  if (authRoutes.some((r) => pathname.startsWith(r)) && hasRefreshToken) {
    return NextResponse.redirect(new URL("/play", request.url));
  }

  // Redirect unauthenticated users away from protected pages
  if (protectedRoutes.some((r) => pathname.startsWith(r)) && !hasRefreshToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/play/:path*",
    "/friends/:path*",
    "/game/:path*",
    "/settings",
    "/admin/:path*",
    "/history",
    "/login",
    "/register",
  ],
};
