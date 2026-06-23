import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";

const SECRET_KEY = process.env.MIDDLEWARE_SECRET || "your-256-bit-secret-key-here-min-32-chars";

interface UserSession {
  id: string;
  email: string;
  nama: string;
  role: string;
  iat: number;
  exp: number;
}

interface RouteConfig {
  path: string;
  roles: string[];
  requireVerified: boolean;
}

const ROUTE_CONFIG: RouteConfig[] = [
  { path: "/dashboard", roles: ["admin", "manager", "staff"], requireVerified: true },
  { path: "/rekap-proforma-invoice", roles: ["admin", "manager", "staff"], requireVerified: true },
  { path: "/surat-pengangkutan", roles: ["admin", "manager", "staff"], requireVerified: true },
  { path: "/riwayat-transaksi", roles: ["admin", "manager", "staff"], requireVerified: true },
  { path: "/input-proforma-invoice", roles: ["admin", "manager", "staff"], requireVerified: true },
  { path: "/laporan-stock-gudang-induk", roles: ["admin", "manager", "staff"], requireVerified: true },
  { path: "/transaksi-barang-masuk", roles: ["admin", "manager"], requireVerified: true },
  { path: "/transaksi-barang-keluar", roles: ["admin", "manager"], requireVerified: true },
  { path: "/arsip-invoice", roles: ["admin", "manager"], requireVerified: true },
  { path: "/arsip-invoice-sementara", roles: ["admin", "manager"], requireVerified: true },
  { path: "/bapisp-final", roles: ["admin", "manager"], requireVerified: true },
  { path: "/berita-acara", roles: ["admin"], requireVerified: true },
  { path: "/data-karyawan", roles: ["admin"], requireVerified: true },
  { path: "/input-do", roles: ["admin"], requireVerified: true },
  { path: "/fot", roles: ["admin", "manager"], requireVerified: true },
  { path: "/add-customer", roles: ["admin", "manager"], requireVerified: true },
  { path: "/riwayat-customer", roles: ["admin", "manager", "staff"], requireVerified: true },
  { path: "/pembatalan-pemesanan", roles: ["admin", "manager"], requireVerified: true },
  { path: "/ttd", roles: ["admin"], requireVerified: true },
];

const PUBLIC_ROUTES = ["/login", "/", "/api/auth"];
const API_PUBLIC_ROUTES = ["/api/auth/login"];

function signToken(payload: string): string {
  const hmac = createHmac("sha256", SECRET_KEY);
  hmac.update(payload);
  return hmac.digest("hex");
}

function verifyToken(token: string): UserSession | null {
  try {
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;

    const decodedPayload = Buffer.from(payload, "base64url").toString("utf-8");
    const expectedSignature = signToken(decodedPayload);

    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    const session: UserSession = JSON.parse(decodedPayload);

    if (Date.now() > session.exp) {
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function createToken(session: UserSession): string {
  const payload = JSON.stringify(session);
  const base64Payload = Buffer.from(payload).toString("base64url");
  const signature = signToken(payload);
  return `${base64Payload}.${signature}`;
}

function getRouteConfig(pathname: string): RouteConfig | null {
  return ROUTE_CONFIG.find(route => pathname.startsWith(route.path)) || null;
}

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname.startsWith("/api/")) {
    return API_PUBLIC_ROUTES.some(route => pathname.startsWith(route));
  }
  return false;
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com;");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}

function createErrorResponse(request: NextRequest, message: string, status: number): NextResponse {
  const response = NextResponse.json({ error: message }, { status });
  return addSecurityHeaders(response);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  if (isPublicRoute(pathname)) {
    if (pathname === "/login") {
      const sessionToken = request.cookies.get("session")?.value;
      if (sessionToken) {
        const session = verifyToken(sessionToken);
        if (session && Date.now() < session.exp) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
        }
      }
    }
    return addSecurityHeaders(NextResponse.next());
  }

  const sessionToken = request.cookies.get("session")?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = verifyToken(sessionToken);

  if (!session) {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete("session");
    response.cookies.delete("userSession");
    response.cookies.delete("userVerified");
    return addSecurityHeaders(response);
  }

  const routeConfig = getRouteConfig(pathname);

  if (!routeConfig) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (!routeConfig.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (routeConfig.requireVerified) {
    const userVerified = request.cookies.get("userVerified")?.value;
    if (userVerified !== "true") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-User-Id", session.id);
  response.headers.set("X-User-Role", session.role);

  return addSecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

export { createToken, verifyToken, getRouteConfig, isPublicRoute, ROUTE_CONFIG };
