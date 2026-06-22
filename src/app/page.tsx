"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Select from "@/app/components/ui/Select";
import { StockGudang } from "@/app/types";

const ParticleBackground = () => {
  const particles = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 20 + 15,
      delay: Math.random() * 10,
      opacity: Math.random() * 0.4 + 0.1,
    }));
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08)_0%,_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(5,150,105,0.06)_0%,_transparent_50%)]" />
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full bg-emerald-400/20"
          style={{
            left: p.left,
            top: p.top,
            width: `${p.size}px`,
            height: `${p.size}px`,
            opacity: p.opacity,
            animation: `particleFloat ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent" />
    </div>
  );
};

export default function PublicPage() {
  const router = useRouter();
  const [stockData, setStockData] = useState<StockGudang[]>([]);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFot, setSelectedFot] = useState("");
  const [selectedBulan, setSelectedBulan] = useState("");
  const [selectedTahun, setSelectedTahun] = useState("");
  const [selectedTanggal, setSelectedTanggal] = useState("");
  const [fotList, setFotList] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [activeGlowCard, setActiveGlowCard] = useState<number | null>(null);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  useEffect(() => {
    fetchStockData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFot, selectedBulan, selectedTahun, selectedTanggal, searchTerm, itemsPerPage]);

  const fetchStockData = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("kodeBarang", "asc"));
      const snapshot = await getDocs(q);
      const items: StockGudang[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as StockGudang));
      setStockData(items);

      const fotSet = new Set<string>();
      items.forEach((item: StockGudang) => {
        if (item.fot && typeof item.fot === "string" && item.fot.trim()) {
          fotSet.add(item.fot.trim().toUpperCase());
        }
      });
      setFotList(Array.from(fotSet).sort());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingStock(false);
    }
  };

  const filteredStockData = stockData.filter((item: StockGudang) => {
    const matchSearch =
      item.kodeBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.namaProdusen || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchFot = selectedFot ? item.fot === selectedFot : true;
    const matchBulanTahun = (() => {
      if (!selectedBulan && !selectedTahun && !selectedTanggal) return true;
      const date = item.createdAt instanceof Date ? item.createdAt : new Date();
      const matchBulan = selectedBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === selectedBulan : true;
      const matchTahun = selectedTahun ? date.getFullYear().toString() === selectedTahun : true;
      const matchTanggal = selectedTanggal
        ? date.getDate().toString().padStart(2, "0") === selectedTanggal.split("-")[2] &&
          (date.getMonth() + 1).toString().padStart(2, "0") === selectedTanggal.split("-")[1] &&
          date.getFullYear().toString() === selectedTanggal.split("-")[0]
        : true;
      return matchBulan && matchTahun && matchTanggal;
    })();
    return matchSearch && matchFot && matchBulanTahun;
  });

  const totalPages = Math.ceil(filteredStockData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredStockData.slice(startIndex, endIndex);

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }, [currentPage, totalPages]);

  const bulanOptions = [
    { value: "", label: "Semua Bulan" },
    { value: "01", label: "Januari" },
    { value: "02", label: "Februari" },
    { value: "03", label: "Maret" },
    { value: "04", label: "April" },
    { value: "05", label: "Mei" },
    { value: "06", label: "Juni" },
    { value: "07", label: "Juli" },
    { value: "08", label: "Agustus" },
    { value: "09", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

  const tahunOptions = [
    { value: "", label: "Semua Tahun" },
    ...Array.from({ length: 5 }, (_, i) => {
      const year = (new Date().getFullYear() - 2 + i).toString();
      return { value: year, label: year };
    }),
  ];

  const fotOptions = [
    { value: "", label: "Semua FOT" },
    ...fotList.map((f: string) => ({ value: f, label: f })),
  ];

  const itemsPerPageOptions = [
    { value: "5", label: "5 per halaman" },
    { value: "10", label: "10 per halaman" },
    { value: "25", label: "25 per halaman" },
    { value: "50", label: "50 per halaman" },
    { value: "100", label: "100 per halaman" },
  ];

  const getUnitBadgeClass = (unit: string) => {
    if (unit === "ZAK") return "bg-blue-500/10 text-blue-400 border-blue-500/20";
    if (unit === "DUS") return "bg-purple-500/10 text-purple-400 border-purple-500/20";
    if (unit === "BOTOL") return "bg-pink-500/10 text-pink-400 border-pink-500/20";
    return "bg-gray-500/10 text-gray-400 border-gray-500/20";
  };

  const formatDusDisplay = (row: StockGudang, unitField: number) => {
    if (row.unit === "DUS") {
      const dusCount = unitField || 0;
      const botolCount = dusCount * (row.botolPerDus || 20);
      return `${dusCount.toLocaleString("id-ID", { maximumFractionDigits: 10 })} DUS (${botolCount.toLocaleString("id-ID", { maximumFractionDigits: 10 })} botol)`;
    }
    if (row.unit === "BOTOL") {
      return `${(unitField || 0).toLocaleString("id-ID", { maximumFractionDigits: 10 })} botol`;
    }
    return `${(unitField || 0).toLocaleString("id-ID", { maximumFractionDigits: 10 })} ${row.unit}`;
  };

  const hitungStokAwalKG = (row: StockGudang) => {
    if (row.unit === "ZAK") {
      return (row.stokAwalUnit || 0) * (row.bobotPerUnit || 50);
    }
    if (row.unit === "DUS" || row.unit === "BOTOL") {
      return 0;
    }
    return row.stokAwalKG || 0;
  };

  const hitungStokAkhirKG = (row: StockGudang) => {
    if (row.unit === "ZAK") {
      return (row.stokAkhirUnit || 0) * (row.bobotPerUnit || 50);
    }
    if (row.unit === "DUS" || row.unit === "BOTOL") {
      return 0;
    }
    return row.stokAkhirKG || 0;
  };

  const getStockStatus = (row: StockGudang) => {
    const kg = hitungStokAkhirKG(row);
    if (row.unit === "DUS" || row.unit === "BOTOL") {
      const unitCount = row.stokAkhirUnit || 0;
      if (unitCount <= 0) return { label: "Habis", color: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-500" };
      if (unitCount < 50) return { label: "Menipis", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", dot: "bg-orange-500" };
      if (unitCount < 200) return { label: "Sedang", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-500" };
      return { label: "Aman", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" };
    }
    if (kg <= 0) return { label: "Habis", color: "bg-red-500/10 text-red-400 border-red-500/20", dot: "bg-red-500" };
    if (kg < 1000) return { label: "Menipis", color: "bg-orange-500/10 text-orange-400 border-orange-500/20", dot: "bg-orange-500" };
    if (kg < 5000) return { label: "Sedang", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", dot: "bg-yellow-500" };
    return { label: "Aman", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", dot: "bg-emerald-500" };
  };

  const getTotalUnit = (unitType: string) => {
    return filteredStockData
      .filter((d: StockGudang) => d.unit === unitType)
      .reduce((sum: number, d: StockGudang) => sum + (d.stokAkhirUnit || 0), 0);
  };

  const formatTanggalDisplay = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    return `${d}-${m}-${y}`;
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const statCards = [
    { label: "Total Jenis", value: filteredStockData.length, color: "emerald", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Total ZAK", value: getTotalUnit("ZAK"), color: "blue", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Total DUS", value: getTotalUnit("DUS"), color: "purple", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Total BOTOL", value: getTotalUnit("BOTOL"), color: "pink", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Stock Menipis", value: filteredStockData.filter((d: StockGudang) => {
      if (d.unit === "DUS" || d.unit === "BOTOL") return (d.stokAkhirUnit || 0) < 50;
      return (d.unit === "ZAK" ? (d.stokAkhirUnit || 0) * (d.bobotPerUnit || 50) : d.stokAkhirKG) < 1000;
    }).length, color: "red", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" },
  ];

  const colorMap: Record<string, { border: string; text: string; glow: string; accent: string }> = {
    emerald: { border: "border-emerald-500/20", text: "text-emerald-400", glow: "shadow-emerald-500/10", accent: "bg-emerald-500" },
    blue: { border: "border-blue-500/20", text: "text-blue-400", glow: "shadow-blue-500/10", accent: "bg-blue-500" },
    purple: { border: "border-purple-500/20", text: "text-purple-400", glow: "shadow-purple-500/10", accent: "bg-purple-500" },
    pink: { border: "border-pink-500/20", text: "text-pink-400", glow: "shadow-pink-500/10", accent: "bg-pink-500" },
    red: { border: "border-red-500/20", text: "text-red-400", glow: "shadow-red-500/10", accent: "bg-red-500" },
  };

  return (
    <>
      <style jsx global>{`
        @keyframes particleFloat {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
          50% { transform: translateY(-10px) translateX(-5px); opacity: 0.4; }
          75% { transform: translateY(-30px) translateX(5px); opacity: 0.5; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(16,185,129,0.1); }
          50% { box-shadow: 0 0 40px rgba(16,185,129,0.25), 0 0 80px rgba(16,185,129,0.1); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(16,185,129,0.1); }
          50% { border-color: rgba(16,185,129,0.4); }
        }
        @keyframes textShine {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-count-up {
          animation: countUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-delay-100 { animation-delay: 0.1s; opacity: 0; }
        .animate-delay-200 { animation-delay: 0.2s; opacity: 0; }
        .animate-delay-300 { animation-delay: 0.3s; opacity: 0; }
        .animate-delay-400 { animation-delay: 0.4s; opacity: 0; }
        .animate-delay-500 { animation-delay: 0.5s; opacity: 0; }
        .animate-delay-600 { animation-delay: 0.6s; opacity: 0; }
        .stat-card-glow {
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          backdrop-filter: blur(12px);
        }
        .stat-card-glow:hover {
          transform: translateY(-6px) scale(1.02);
          box-shadow: 0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(16,185,129,0.2);
        }
        .stat-card-glow.active {
          animation: glowPulse 3s ease-in-out infinite;
          transform: translateY(-4px) scale(1.01);
        }
        .row-interactive {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .row-interactive:hover {
          transform: translateX(6px);
          border-color: rgba(16,185,129,0.3) !important;
          box-shadow: 0 8px 30px rgba(0,0,0,0.3), 0 0 0 1px rgba(16,185,129,0.15);
        }
        .row-interactive.active {
          animation: borderGlow 2s ease-in-out infinite;
          transform: translateX(6px);
        }
        .btn-glow {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .btn-glow:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 30px -5px rgba(16,185,129,0.3);
        }
        .btn-glow:active {
          transform: translateY(0) scale(0.98);
        }
        .shimmer-bg {
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%);
          background-size: 200% 100%;
          animation: shimmer 4s ease-in-out infinite;
        }
        .text-gradient {
          background: linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .glass-card {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
        }
        .glass-input {
          background: rgba(30, 41, 59, 0.6);
          border: 1px solid rgba(255,255,255,0.1);
          color: #e2e8f0;
        }
        .glass-input:focus {
          background: rgba(30, 41, 59, 0.8);
          border-color: rgba(16,185,129,0.4);
          box-shadow: 0 0 0 3px rgba(16,185,129,0.1);
        }
        .glass-input::placeholder {
          color: rgba(148,163,184,0.6);
        }
      `}</style>

      <ParticleBackground />

      <div className="min-h-screen relative z-10">
        <nav className="sticky top-0 z-50 animate-fade-in-up">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl border-b border-white/10" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">REKAP DATA</h1>
                  <p className="text-xs text-emerald-400 font-medium">PT Bukit Agrochemical Baru</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="primary" size="sm" onClick={() => router.push("/login")} className="btn-glow bg-emerald-600 hover:bg-emerald-500 border-0">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Login Admin
                </Button>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
          <section className="text-center py-12 animate-fade-in-up animate-delay-100">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/20 mb-6">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-3 tracking-tight">PT Bukit Agrochemical Baru</h2>
            <p className="text-lg text-emerald-400 mb-2 font-medium">Sistem Administrasi Distributor Pupuk</p>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Platform digital untuk monitoring stock gudang secara real-time.
            </p>
          </section>

          <section className="animate-fade-in-up animate-delay-200">
            <Card className="glass-card shadow-2xl rounded-3xl border-0">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">Laporan Stock Gudang</h3>
                  <p className="text-sm text-slate-400 mt-1">Data persediaan barang per lokasi FOT</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-full text-sm font-semibold border border-emerald-500/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Mode Lihat Saja
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Filter FOT</label>
                  <select
                    value={selectedFot}
                    onChange={(e) => setSelectedFot(e.target.value)}
                    className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm"
                  >
                    {fotOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Filter Tanggal</label>
                  <input
                    type="date"
                    value={selectedTanggal}
                    onChange={(e) => setSelectedTanggal(e.target.value)}
                    className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Filter Bulan</label>
                  <select
                    value={selectedBulan}
                    onChange={(e) => setSelectedBulan(e.target.value)}
                    className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm"
                  >
                    {bulanOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Filter Tahun</label>
                  <select
                    value={selectedTahun}
                    onChange={(e) => setSelectedTahun(e.target.value)}
                    className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm"
                  >
                    {tahunOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative w-full sm:w-96 mb-8">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari kode, nama barang, atau unit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {statCards.map((card, idx) => {
                  const c = colorMap[card.color];
                  const isActive = activeGlowCard === idx;
                  return (
                    <div
                      key={card.label}
                      className={`p-5 rounded-2xl border ${c.border} bg-slate-800/50 hover:bg-slate-800/80 transition-all duration-500 animate-count-up animate-delay-${(idx + 1) * 100} stat-card-glow ${isActive ? "active" : ""} cursor-pointer`}
                      onClick={() => setActiveGlowCard(isActive ? null : idx)}
                      onMouseEnter={() => setActiveGlowCard(idx)}
                      onMouseLeave={() => setActiveGlowCard(null)}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <p className={`text-xs uppercase tracking-wider font-bold ${c.text}`}>{card.label}</p>
                        <svg className={`w-4 h-4 ${c.text} opacity-50`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                        </svg>
                      </div>
                      <p className={`text-3xl font-bold ${c.text} tracking-tight transition-all duration-300 ${isActive ? "scale-110" : ""}`}>
                        {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                      </p>
                      {isActive && (
                        <div className="mt-3 h-0.5 w-full rounded-full shimmer-bg" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="text-sm text-slate-400 font-medium flex flex-wrap items-center gap-2">
                  <span>Menampilkan {filteredStockData.length} dari {stockData.length} data</span>
                  {selectedFot && <span className="px-2 py-0.5 bg-slate-700/50 rounded-md text-xs text-slate-300">FOT: {selectedFot}</span>}
                  {selectedTanggal && <span className="px-2 py-0.5 bg-slate-700/50 rounded-md text-xs text-slate-300">Tanggal: {formatTanggalDisplay(selectedTanggal)}</span>}
                  {selectedBulan && <span className="px-2 py-0.5 bg-slate-700/50 rounded-md text-xs text-slate-300">{bulanOptions.find((b) => b.value === selectedBulan)?.label}</span>}
                  {selectedTahun && <span className="px-2 py-0.5 bg-slate-700/50 rounded-md text-xs text-slate-300">{selectedTahun}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 font-medium">Tampilkan:</span>
                  <select
                    value={itemsPerPage.toString()}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="w-36 text-sm glass-input rounded-lg px-3 py-2 focus:outline-none"
                  >
                    {itemsPerPageOptions.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
                    ))}
                  </select>
                  <span className="text-sm text-slate-500">per halaman</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                {isLoadingStock ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-emerald-500/20 border-t-emerald-500"></div>
                    <p className="text-sm text-slate-500 font-medium">Memuat data stock...</p>
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-slate-500">
                    <div className="w-20 h-20 bg-slate-800/50 rounded-2xl flex items-center justify-center mb-4 border border-slate-700/50">
                      <svg className="w-10 h-10 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="font-semibold text-lg text-slate-400">Belum ada data stock gudang</p>
                    <p className="text-sm mt-1 text-slate-500">Data akan muncul setelah admin menginput stock</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <div className="col-span-1">FOT</div>
                      <div className="col-span-2">Kode / Nama</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-1 text-right">Konversi</div>
                      <div className="col-span-2 text-right">Stok Awal</div>
                      <div className="col-span-1 text-right">Masuk</div>
                      <div className="col-span-1 text-right">Keluar</div>
                      <div className="col-span-2 text-right">Stok Akhir</div>
                      <div className="col-span-1 text-center">Status</div>
                    </div>

                    <div className="space-y-2">
                      {paginatedData.map((row: StockGudang, index: number) => {
                        const status = getStockStatus(row);
                        const isRowActive = hoveredRow === row.id;
                        return (
                          <div
                            key={row.id}
                            className={`group bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 animate-fade-in-up overflow-hidden row-interactive ${isRowActive ? "active" : ""} cursor-pointer`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                            onClick={() => setHoveredRow(isRowActive ? null : row.id)}
                            onMouseEnter={() => setHoveredRow(row.id)}
                            onMouseLeave={() => setHoveredRow(null)}
                          >
                            <div className="lg:hidden p-5 space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg text-sm border border-emerald-500/20">
                                      {row.fot || "-"}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getUnitBadgeClass(row.unit)}`}>
                                      {row.unit}
                                    </span>
                                  </div>
                                  <p className="font-mono text-sm font-semibold text-emerald-300">{row.kodeBarang}</p>
                                  <p className="text-sm font-medium text-slate-200">{row.namaBarang}</p>
                                  {row.namaProdusen && <p className="text-xs text-slate-500">{row.namaProdusen}</p>}
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${status.color}`}>
                                  <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                                  {status.label}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                                  <p className="text-xs text-slate-500 mb-1">Stok Awal</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono font-semibold text-slate-200">{formatDusDisplay(row, row.stokAwalUnit)}</p>
                                  )}
                                  {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                    <p className="text-slate-500 text-xs">{hitungStokAwalKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                  )}
                                </div>
                                <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                                  <p className="text-xs text-slate-500 mb-1">Stok Akhir</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono font-bold text-emerald-400">{formatDusDisplay(row, row.stokAkhirUnit)}</p>
                                  )}
                                  {row.unit === "KG" && (
                                    <p className="font-mono font-bold text-emerald-400">{row.stokAkhirKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                  )}
                                  {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                    <p className="text-slate-500 text-xs">{hitungStokAkhirKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                  )}
                                </div>
                                <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                                  <p className="text-xs text-emerald-400 mb-1">Masuk</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono text-emerald-300 font-semibold">+{formatDusDisplay(row, row.barangMasukUnit)}</p>
                                  )}
                                  {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                    <p className="text-emerald-500 text-xs">+{row.barangMasukKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                  )}
                                </div>
                                <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                                  <p className="text-xs text-red-400 mb-1">Keluar</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono text-red-300 font-semibold">-{formatDusDisplay(row, row.barangKeluarUnit)}</p>
                                  )}
                                  {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                    <p className="text-red-500 text-xs">-{row.barangKeluarKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                  )}
                                </div>
                              </div>

                              {row.unit !== "KG" && (
                                <div className="text-xs text-slate-500">
                                  {row.unit === "BOTOL" || row.unit === "DUS" ? (
                                    <span>{row.botolPerDus || 20} botol/DUS | {row.volumeMl || 500}ml/botol</span>
                                  ) : (
                                    <span>Bobot: {row.bobotPerUnit?.toLocaleString()} KG / {row.unit}</span>
                                  )}
                                </div>
                              )}
                            </div>

                            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 items-center group-hover:bg-emerald-500/5 transition-colors duration-500">
                              <div className="col-span-1">
                                <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg text-sm inline-block border border-emerald-500/20">
                                  {row.fot || "-"}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <p className="font-mono text-sm font-semibold text-emerald-300">{row.kodeBarang}</p>
                                <p className="text-sm text-slate-300 mt-0.5 line-clamp-1">{row.namaBarang}</p>
                                {row.namaProdusen && <p className="text-xs text-slate-500 mt-0.5">{row.namaProdusen}</p>}
                              </div>
                              <div className="col-span-1 text-center">
                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${getUnitBadgeClass(row.unit)}`}>
                                  {row.unit}
                                </span>
                              </div>
                              <div className="col-span-1 text-right">
                                <span className="font-mono text-sm text-slate-400">
                                  {row.unit === "KG" ? "-" : row.unit === "BOTOL" || row.unit === "DUS" ? (
                                    <div className="text-xs">
                                      <p className="text-pink-400">{row.botolPerDus || 20} botol/DUS</p>
                                      <p className="text-pink-300">{row.volumeMl || 500}ml/botol</p>
                                    </div>
                                  ) : `${row.bobotPerUnit?.toLocaleString()} KG`}
                                </span>
                              </div>
                              <div className="col-span-2 text-right">
                                {row.unit !== "KG" && (
                                  <p className="font-mono text-sm font-medium text-slate-200">{formatDusDisplay(row, row.stokAwalUnit)}</p>
                                )}
                                {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                  <p className="text-slate-500 text-xs">{hitungStokAwalKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                )}
                              </div>
                              <div className="col-span-1 text-right">
                                {row.unit !== "KG" && (
                                  <p className="text-emerald-400 font-mono text-sm font-medium">+{formatDusDisplay(row, row.barangMasukUnit)}</p>
                                )}
                                {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                  <p className="text-emerald-500 text-xs">+{row.barangMasukKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                )}
                              </div>
                              <div className="col-span-1 text-right">
                                {row.unit !== "KG" && (
                                  <p className="text-red-400 font-mono text-sm font-medium">-{formatDusDisplay(row, row.barangKeluarUnit)}</p>
                                )}
                                {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                  <p className="text-red-500 text-xs">-{row.barangKeluarKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                )}
                              </div>
                              <div className="col-span-2 text-right">
                                {row.unit !== "KG" && (
                                  <p className="font-mono font-bold text-emerald-400 text-sm">{formatDusDisplay(row, row.stokAkhirUnit)}</p>
                                )}
                                {row.unit === "KG" && (
                                  <p className="font-mono font-bold text-emerald-400 text-sm">{row.stokAkhirKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                )}
                                {row.unit !== "DUS" && row.unit !== "BOTOL" && (
                                  <p className="text-slate-500 text-xs">{hitungStokAkhirKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
                                )}
                              </div>
                              <div className="col-span-1 text-center">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${status.color}`}>
                                  <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                                  {status.label}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-700/50 pt-6 animate-fade-in-up">
                  <div className="text-sm text-slate-400 font-medium">
                    Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredStockData.length)} dari {filteredStockData.length} item
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => goToPage(1)}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow"
                    >
                      Awal
                    </button>
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <div className="flex items-center gap-1">
                      {pageNumbers.map((page: number) => (
                        <button
                          key={page}
                          onClick={() => goToPage(page)}
                          className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 btn-glow ${
                            currentPage === page
                              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110"
                              : "text-slate-300 hover:bg-slate-700/50"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => goToPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow"
                    >
                      Akhir
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          <footer className="text-center py-8 border-t border-slate-700/30 animate-fade-in-up animate-delay-300">
            <p className="text-sm text-slate-400 font-medium">
              PT Bukit Agrochemical Baru | Sistem Administrasi Distributor Pupuk
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Untuk mengelola data, silakan login sebagai admin
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}