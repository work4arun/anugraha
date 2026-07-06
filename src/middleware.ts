import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Public auth pages — never gate these (prevents a redirect loop where
    // /admin/login would keep redirecting to itself).
    if (pathname.startsWith("/admin/login") || pathname.startsWith("/login")) {
      return NextResponse.next();
    }

    if (!token || token.revoked) {
      // Not authenticated — redirect to appropriate login
      const loginUrl = pathname.startsWith("/admin")
        ? "/admin/login"
        : "/login";
      return NextResponse.redirect(new URL(loginUrl, req.url));
    }

    // Admin routes — require admin userType
    if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
      if (token.userType !== "admin") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }

    // Student routes — require student userType
    if (
      pathname.startsWith("/dashboard") ||
      pathname.startsWith("/induction") ||
      pathname.startsWith("/review") ||
      pathname.startsWith("/complete") ||
      pathname.startsWith("/reset-password")
    ) {
      if (token.userType !== "student") {
        return NextResponse.redirect(new URL("/admin/login", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // Let the middleware function handle the logic
      authorized: () => true,
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/induction/:path*",
    "/review/:path*",
    "/complete/:path*",
    "/reset-password/:path*",
    "/admin/:path*",
  ],
};
