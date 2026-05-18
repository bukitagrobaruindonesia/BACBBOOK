import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/api/public"];
const STATIC_PATHS = ["/_next", "/static", "/favicon.ico", "/manifest.json"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (STATIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get("next-auth.session-token") || request.cookies.get("__session");
  const hasSessionHeader = request.headers.get("x-session-verified") === "true";

  if (pathname.startsWith("/dashboard") && !sessionCookie && !hasSessionHeader) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firestore.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
    );
  }

  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};