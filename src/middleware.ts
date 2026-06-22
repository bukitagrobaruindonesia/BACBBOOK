import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userSession = request.cookies.get("userSession")?.value;
  const userVerified = request.cookies.get("userVerified")?.value;

  const isProtected = pathname.startsWith("/dashboard");

  if (isProtected && (!userSession || userVerified !== "true")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login" && userSession && userVerified === "true") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};