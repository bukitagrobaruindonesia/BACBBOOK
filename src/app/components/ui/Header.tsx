"use client";

import React from "react";
import { useAuth } from "@/app/context/AuthContext";

interface HeaderProps {
  title: string;
  subtitle?: string;
}

export default function Header(props: HeaderProps) {
  const { title, subtitle } = props;
  const { user, logout } = useAuth();

  const handleLogout = () => {
    if (typeof window !== "undefined" && window.confirm("Apakah Anda yakin ingin keluar?")) {
      logout();
    }
  };

  return (
    <header className="bg-white border-b border-green-100 px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sticky top-0 z-30 shadow-sm rounded-xl mb-6">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-green-800 truncate">{title}</h1>
        {subtitle ? <p className="text-sm text-gray-500 mt-0.5 truncate">{subtitle}</p> : null}
      </div>
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="text-right hidden md:block">
          <p className="text-sm font-semibold text-gray-800">{user?.nama}</p>
          <p className="text-xs text-gray-500">{user?.email}</p>
        </div>
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-600 to-green-800 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {user?.nama ? user.nama.charAt(0).toUpperCase() : "?"}
        </div>
        <button
          onClick={handleLogout}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all md:hidden"
          title="Keluar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </div>
    </header>
  );
}