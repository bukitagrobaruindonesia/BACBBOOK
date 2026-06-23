import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

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

function getRouteConfig(pathname: string): RouteConfig | null {
  return ROUTE_CONFIG.find(route => pathname.startsWith(route.path)) || null;
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname) || pathname.startsWith("/api/");
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicRoute(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  const userSession = request.cookies.get("userSession")?.value;
  const userVerified = request.cookies.get("userVerified")?.value;

  if (!userSession || userVerified !== "true") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let session: { role?: string } = {};
  try {
    session = JSON.parse(userSession);
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const routeConfig = getRouteConfig(pathname);

  if (!routeConfig) {
    return addSecurityHeaders(NextResponse.next());
  }

  if (!routeConfig.roles.includes(session.role || "")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("X-User-Role", session.role || "");

  return addSecurityHeaders(response);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|LogoAGRO.png).*)"],
};

export { getRouteConfig, isPublicRoute, ROUTE_CONFIG };