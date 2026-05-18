"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lockoutMessage, setLockoutMessage] = useState("");
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/dashboard";

  const sanitizeRedirect = (path: string): string => {
    if (!path.startsWith("/")) return "/dashboard";
    if (path.includes("://") || path.includes("//")) return "/dashboard";
    const blockedPaths = ["/login", "/api", "/_next", "/static"];
    if (blockedPaths.some((bp) => path.startsWith(bp))) return "/dashboard";
    return path;
  };

  const safeRedirect = sanitizeRedirect(redirectPath);

  useEffect(() => {
    if (!loading && user) {
      router.replace(safeRedirect);
    }
  }, [loading, user, router, safeRedirect]);

  const validateInputs = useCallback((): boolean => {
    setError("");
    setLockoutMessage("");

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError("Email dan password wajib diisi");
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError("Format email tidak valid");
      return false;
    }

    if (trimmedPassword.length < 6) {
      setError("Password minimal 6 karakter");
      return false;
    }

    if (trimmedPassword.length > 128) {
      setError("Password terlalu panjang");
      return false;
    }

    return true;
  }, [email, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateInputs()) return;

    setIsLoading(true);
    setError("");
    setLockoutMessage("");

    try {
      const success = await login(email, password);
      if (success) {
        window.location.href = safeRedirect;
      } else {
        setError("Email atau password salah. Silakan coba lagi.");
      }
    } catch (err: any) {
      if (err.message && err.message.includes("terkunci")) {
        setLockoutMessage(err.message);
      } else {
        setError("Terjadi kesalahan sistem. Silakan coba lagi.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-green-100 to-amber-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-700"></div>
          <p className="text-green-800 font-medium animate-pulse">Memuat...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-green-100 to-amber-50 p-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 p-6 sm:p-8">
          <div className="text-center mb-6 sm:mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-600 to-green-800 rounded-xl shadow-xl mb-4">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-green-900 mb-2">REKAP DATA</h1>
            <p className="text-green-700 font-medium">PT Bukit Agrochemical</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Sistem Administrasi Distributor Pupuk</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5" autoComplete="off">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Masukkan email"
              required
              autoComplete="username"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan Password"
              required
              autoComplete="current-password"
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {lockoutMessage && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-700 text-sm">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium">{lockoutMessage}</span>
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
              Masuk ke Sistem
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => router.push("/")}
              className="text-sm text-green-600 hover:text-green-800 font-medium transition-colors"
            >
              Kembali ke Halaman Utama
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}