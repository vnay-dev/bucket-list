import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Edge-safe Auth.js instance (no database imports).

const { auth } = NextAuth(authConfig);

/**
 * Soft gate for /admin: unauthenticated visitors are sent to login.
 * Real authorization (curator/superadmin) is enforced in the admin layout.
 */
export default auth((request) => {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (!request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
