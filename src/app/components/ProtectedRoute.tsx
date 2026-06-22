"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, verified, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login");
      } else if (!verified) {
        router.replace("/login");
      }
    }
  }, [user, verified, loading, router]);

  if (loading || !user || !verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-green-700"></div>
          <p className="text-gray-600 text-sm">Memuat...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}