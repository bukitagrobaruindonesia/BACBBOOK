"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/ui/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-700"></div>
          <p className="text-green-800 font-medium animate-pulse">Memuat sistem...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-green-50/50">
      <Sidebar />
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden lg:ml-0 pb-20 lg:pb-0">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}