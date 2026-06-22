"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"login" | "verify">("login");
  const [countdown, setCountdown] = useState(0);
  const [generatedCode, setGeneratedCode] = useState("");
  const { login, user, verified, loading, markVerified } = useAuth();
  const router = useRouter();
  const emailjsRef = useRef<any>(null);

  useEffect(() => {
    if (!loading && user && verified) {
      router.replace("/dashboard");
    }
  }, [loading, user, verified, router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  const loadEmailJS = async () => {
    if (emailjsRef.current) return emailjsRef.current;
    try {
      const emailjs = await import("@emailjs/browser");
      emailjsRef.current = emailjs;
      return emailjs;
    } catch (err) {
      console.error("Failed to load emailjs:", err);
      return null;
    }
  };

  const sendVerificationEmail = async (targetEmail: string, code: string) => {
    const emailjs = await loadEmailJS();
    if (!emailjs) return;

    const serviceId = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
    const templateId = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "";
    const publicKey = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

    if (!serviceId || !templateId || !publicKey) return;

    try {
      const templateParams = {
        user_email: targetEmail,
        verification_code: code,
        company_name: "PT Bukit Agrochemical Baru",
        expiry_time: "10 menit",
      };
      await emailjs.send(serviceId, templateId, templateParams, publicKey);
    } catch (err: any) {
      console.error("EmailJS send error:", err);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        const code = generateCode();
        setGeneratedCode(code);
        await sendVerificationEmail(email, code);
        setStep("verify");
        setCountdown(60);
        setPassword("");
      } else {
        setError("Email atau password salah. Silakan coba lagi.");
      }
    } catch (err: any) {
      setError("Terjadi kesalahan. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    setIsLoading(true);
    try {
      const code = generateCode();
      setGeneratedCode(code);
      await sendVerificationEmail(email, code);
      setCountdown(60);
      setVerificationCode("");
      setError("");
    } catch (err: any) {
      setError("Gagal mengirim ulang kode. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (verificationCode === generatedCode) {
        markVerified();
      } else {
        setError("Kode verifikasi tidak valid. Silakan coba lagi.");
      }
    } catch (err: any) {
      setError("Terjadi kesalahan verifikasi. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setStep("login");
    setVerificationCode("");
    setGeneratedCode("");
    setError("");
    setCountdown(0);
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

  if (user && verified) {
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
            <p className="text-green-700 font-medium">PT Bukit Agrochemical Baru</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Sistem Administrasi Distributor Pupuk</p>
          </div>

          {step === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4 sm:space-y-5">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Masukkan email"
                required
              />

              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan Password"
                required
              />

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                Masuk ke Sistem
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifySubmit} className="space-y-4 sm:space-y-5">
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600">
                  Kode verifikasi 6 digit telah dikirim ke
                </p>
                <p className="text-sm font-semibold text-green-800 mt-1">{email}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Kode Verifikasi
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setVerificationCode(val);
                  }}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all"
                  required
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={isLoading}>
                Verifikasi & Masuk
              </Button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Kembali
                </button>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={countdown > 0 || isLoading}
                  className={`text-sm font-medium transition-colors ${
                    countdown > 0 || isLoading
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-green-600 hover:text-green-800"
                  }`}
                >
                  {countdown > 0 ? `Kirim ulang (${countdown}s)` : "Kirim Ulang Kode"}
                </button>
              </div>
            </form>
          )}

          {step === "login" && (
            <div className="mt-6 text-center">
              <button
                onClick={() => router.push("/")}
                className="text-sm text-green-600 hover:text-green-800 font-medium transition-colors"
              >
                Kembali ke Halaman Utama
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}