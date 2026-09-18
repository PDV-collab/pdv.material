import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/auth/session";

// Public routes that unauthenticated users are allowed to access
const PUBLIC_PREFIXES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/unauthorized",
  "/api/auth",
];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  // 1. Pass through static files, images, icons, and API auth
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico" ||
    pathname === "/icon.svg" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  // 2. Read and verify session cookie
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session = null;
  if (token) {
    session = await verifySessionToken(token);
  }

  // 3. If unauthenticated and accessing a protected page -> Redirect to /login
  if (!session) {
    if (!isPublicRoute) {
      const loginUrl = new URL("/login", request.url);
      if (pathname !== "/") {
        loginUrl.searchParams.set("from", pathname);
      }
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 4. If authenticated and accessing login/auth pages -> Forward to appropriate dashboard
  if (pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password") {
    const destination = session.role === "SUPPLIER" ? "/supplier" : "/";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // 5. Role restrictions: Suppliers cannot access admin operations
  if (session.role === "SUPPLIER" && !pathname.startsWith("/supplier") && !isPublicRoute) {
    return NextResponse.redirect(new URL("/supplier", request.url));
  }

  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
