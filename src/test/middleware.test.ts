import { describe, it, expect, vi, beforeEach } from "vitest";
import { createToken, verifyToken, getRouteConfig, isPublicRoute, ROUTE_CONFIG } from "@/middleware";

describe("Middleware Security", () => {
  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    nama: "Test User",
    role: "staff",
    iat: Date.now(),
    exp: Date.now() + 24 * 60 * 60 * 1000,
  };

  describe("Token Creation & Verification", () => {
    it("creates and verifies valid token", () => {
      const token = createToken(mockUser);
      expect(token).toBeTruthy();
      expect(token.split(".").length).toBe(2);

      const decoded = verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.id).toBe("user-123");
      expect(decoded?.email).toBe("test@example.com");
      expect(decoded?.role).toBe("staff");
    });

    it("rejects tampered token", () => {
      const token = createToken(mockUser);
      const tampered = token.slice(0, -5) + "xxxxx";
      expect(verifyToken(tampered)).toBeNull();
    });

    it("rejects expired token", () => {
      const expiredUser = { ...mockUser, exp: Date.now() - 1000 };
      const token = createToken(expiredUser);
      expect(verifyToken(token)).toBeNull();
    });

    it("rejects invalid token format", () => {
      expect(verifyToken("invalid")).toBeNull();
      expect(verifyToken("")).toBeNull();
      expect(verifyToken("abc.def.ghi")).toBeNull();
    });

    it("rejects token with wrong signature", () => {
      const token = createToken(mockUser);
      const [payload] = token.split(".");
      const fakeToken = payload + ".fakesignature123456789";
      expect(verifyToken(fakeToken)).toBeNull();
    });
  });

  describe("Route Configuration", () => {
    it("returns config for protected routes", () => {
      expect(getRouteConfig("/dashboard")).toEqual(
        expect.objectContaining({ path: "/dashboard", roles: ["admin", "manager", "staff"] })
      );
      expect(getRouteConfig("/data-karyawan")).toEqual(
        expect.objectContaining({ path: "/data-karyawan", roles: ["admin"] })
      );
    });

    it("returns null for unconfigured routes", () => {
      expect(getRouteConfig("/unknown")).toBeNull();
    });

    it("identifies public routes", () => {
      expect(isPublicRoute("/login")).toBe(true);
      expect(isPublicRoute("/")).toBe(true);
      expect(isPublicRoute("/api/auth/login")).toBe(true);
    });

    it("identifies protected routes", () => {
      expect(isPublicRoute("/dashboard")).toBe(false);
      expect(isPublicRoute("/data-karyawan")).toBe(false);
    });
  });

  describe("Role-Based Access Control", () => {
    it("allows admin to access all routes", () => {
      const adminRoutes = ["/dashboard", "/data-karyawan", "/berita-acara", "/input-do"];
      adminRoutes.forEach(route => {
        const config = getRouteConfig(route);
        expect(config?.roles).toContain("admin");
      });
    });

    it("restricts admin-only routes from staff", () => {
      const adminOnly = ["/data-karyawan", "/berita-acara", "/ttd", "/input-do"];
      adminOnly.forEach(route => {
        const config = getRouteConfig(route);
        expect(config?.roles).not.toContain("staff");
      });
    });

    it("allows manager to access manager routes", () => {
      const managerRoutes = ["/dashboard", "/rekap-proforma-invoice", "/arsip-invoice"];
      managerRoutes.forEach(route => {
        const config = getRouteConfig(route);
        expect(config?.roles).toContain("manager");
      });
    });
  });

  describe("Security Headers", () => {
    it("has all route configs requiring verification", () => {
      ROUTE_CONFIG.forEach(config => {
        expect(config.requireVerified).toBe(true);
      });
    });

    it("has no duplicate routes", () => {
      const paths = ROUTE_CONFIG.map(c => c.path);
      const uniquePaths = new Set(paths);
      expect(uniquePaths.size).toBe(paths.length);
    });
  });
});

export { createToken, verifyToken };
