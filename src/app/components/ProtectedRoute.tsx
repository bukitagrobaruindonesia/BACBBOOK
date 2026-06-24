"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, verified, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !verified)) {
      router.push("/login");
    }
  }, [user, verified, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user || !verified) {
    return null;
  }

  return <>{children}</>;
}