"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/ui/Sidebar";
import MobileBottomNav from "@/app/components/ui/MobileBottomNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    if (loading) return;

    const verifyAccess = async () => {
      if (!isAuthenticated || !user) {
        const currentPath = encodeURIComponent(pathname);
        router.replace(`/login?redirect=${currentPath}`);
        return;
      }
      setIsVerifying(false);
    };

    verifyAccess();
  }, [loading, isAuthenticated, user, router, pathname]);

  if (loading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-green-100 to-amber-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-700"></div>
          <p className="text-green-800 font-medium animate-pulse">Memverifikasi akses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-green-50/50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden lg:ml-0 pb-20 lg:pb-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
      <MobileBottomNav />
    </div>
  );
}