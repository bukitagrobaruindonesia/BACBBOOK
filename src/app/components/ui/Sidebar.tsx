"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

const menuItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/input-proforma-invoice",
    label: "Input PI",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/rekap-proforma-invoice",
    label: "Rekap PI",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/laporan-stock-gudang",
    label: "Laporan & Input Stock",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/dashboard/transaksi-barang-masuk",
    label: "Barang Masuk",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18M13 5l7 7-7 7" />
      </svg>
    ),
  },
  {
    href: "/dashboard/transaksi-barang-keluar",
    label: "Barang Keluar",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
    ),
  },
  {
    href: "/dashboard/riwayat-transaksi",
    label: "Riwayat Transaksi",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    if (typeof window !== "undefined" && window.confirm("Apakah Anda yakin ingin keluar?")) {
      logout();
    }
  };

  return (
    <React.Fragment>
      <button
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-green-800 text-white rounded-xl shadow-lg"
        aria-label={isMobileMenuOpen ? "Tutup menu" : "Buka menu"}
        aria-expanded={isMobileMenuOpen}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
        </svg>
      </button>

      {isMobileMenuOpen ? (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} role="presentation"></div>
      ) : null}

      <aside
        className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen bg-gradient-to-b from-green-900 to-green-800 text-white flex flex-col shadow-2xl
        transition-transform duration-300 ease-in-out
        w-72
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
        aria-label="Sidebar navigasi"
      >
        <div className="p-6 border-b border-green-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 rounded-xl shadow-lg">
              <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight">REKAP ADMIN</h2>
              <p className="text-xs text-green-300">PT Bukit Agrochemical Baru</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto" role="navigation">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-green-800 text-white shadow-lg border-l-4 border-amber-400"
                    : "text-green-200 hover:text-white hover:bg-green-800/50"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.icon}
                <span className="font-medium text-sm">{item.label}</span>
                {isActive ? (
                  <svg className="w-4 h-4 ml-auto text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-green-700/50">
          <div className="bg-green-800/50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-xs font-bold">
                {user?.nama ? user.nama.charAt(0).toUpperCase() : "?"}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate">{user?.nama || "User"}</p>
                <p className="text-xs text-green-300 truncate">{user?.role || "User"}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/20 text-red-300 hover:bg-red-600/30 rounded-lg transition-colors text-sm font-medium"
              aria-label="Keluar dari sistem"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Keluar
            </button>
          </div>
        </div>
      </aside>
    </React.Fragment>
  );
}