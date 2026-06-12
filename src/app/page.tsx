"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Select from "@/app/components/ui/Select";
import { StockGudang } from "@/app/types";

const PalmTree = ({ delay, height, left, scale, zIndex }: { delay: number; height: number; left: string; scale: number; zIndex: number }) => (
  <div
    className="absolute bottom-0"
    style={{
      left,
      height: `${height}px`,
      transform: `scale(${scale})`,
      transformOrigin: "bottom center",
      animation: `sway ${3 + Math.random() * 2}s ease-in-out infinite`,
      animationDelay: `${delay}s`,
      zIndex,
    }}
  >
    <svg viewBox="0 0 100 200" className="h-full w-auto" fill="none">
      <path
        d="M50 200 Q48 150 50 100 Q52 50 50 20"
        stroke="#5D4037"
        strokeWidth="6"
        fill="none"
        style={{ transformOrigin: "50% 100%", animation: `trunkSway ${3 + Math.random() * 2}s ease-in-out infinite`, animationDelay: `${delay}s` }}
      />
      <g style={{ transformOrigin: "50px 20px", animation: `frondSway ${2 + Math.random() * 2}s ease-in-out infinite`, animationDelay: `${delay + 0.3}s` }}>
        <path d="M50 20 Q15 5 5 25 Q25 20 50 20" fill="#1B5E20" opacity="0.95" />
        <path d="M50 20 Q85 5 95 25 Q75 20 50 20" fill="#2E7D32" opacity="0.95" />
        <path d="M50 20 Q25 -5 15 10 Q35 5 50 20" fill="#388E3C" opacity="0.9" />
        <path d="M50 20 Q75 -5 85 10 Q65 5 50 20" fill="#43A047" opacity="0.9" />
        <path d="M50 20 Q35 -15 50 0 Q60 -10 50 20" fill="#66BB6A" opacity="0.95" />
        <path d="M50 20 Q20 30 10 45 Q30 35 50 20" fill="#1B5E20" opacity="0.85" />
        <path d="M50 20 Q80 30 90 45 Q70 35 50 20" fill="#2E7D32" opacity="0.85" />
      </g>
    </svg>
  </div>
);

const Cloud = ({ top, left, duration, delay, scale }: { top: string; left: string; duration: number; delay: number; scale: number }) => (
  <div
    className="absolute opacity-70"
    style={{
      top,
      left,
      transform: `scale(${scale})`,
      animation: `float ${duration}s linear infinite`,
      animationDelay: `${delay}s`,
    }}
  >
    <svg width="120" height="50" viewBox="0 0 120 50" fill="white">
      <ellipse cx="35" cy="30" rx="30" ry="18" />
      <ellipse cx="65" cy="22" rx="35" ry="22" />
      <ellipse cx="90" cy="30" rx="25" ry="15" />
      <ellipse cx="50" cy="15" rx="20" ry="12" />
    </svg>
  </div>
);

const Bird = ({ top, left, duration, delay }: { top: string; left: string; duration: number; delay: number }) => (
  <div
    className="absolute"
    style={{
      top,
      left,
      animation: `fly ${duration}s linear infinite`,
      animationDelay: `${delay}s`,
    }}
  >
    <svg width="25" height="15" viewBox="0 0 25 15" fill="none" stroke="#374151" strokeWidth="1.5">
      <path d="M2 8 Q8 3 12 8 Q18 3 23 8" style={{ animation: `wingFlap 0.4s ease-in-out infinite`, transformOrigin: "12px 8px" }} />
    </svg>
  </div>
);

const Sun = () => (
  <div className="absolute top-6 right-12 w-28 h-28">
    <div
      className="w-full h-full rounded-full bg-gradient-to-br from-yellow-300 via-orange-300 to-orange-400 shadow-lg"
      style={{ animation: "pulse 5s ease-in-out infinite" }}
    />
    <div
      className="absolute inset-0 rounded-full bg-yellow-200 opacity-40"
      style={{ animation: "sunGlow 4s ease-in-out infinite" }}
    />
    <div
      className="absolute -inset-4 rounded-full bg-yellow-100 opacity-20"
      style={{ animation: "sunGlow 6s ease-in-out infinite reverse" }}
    />
  </div>
);

const PalmPlantationBackground = () => {
  const trees = useMemo(() => {
    const treeArray = [];
    for (let i = 0; i < 18; i++) {
      treeArray.push({
        id: i,
        delay: Math.random() * 4,
        height: 120 + Math.random() * 130,
        left: `${(i / 18) * 100 + Math.random() * 4}%`,
        scale: 0.5 + Math.random() * 0.5,
        zIndex: Math.floor(Math.random() * 3),
      });
    }
    return treeArray;
  }, []);

  const clouds = useMemo(() => {
    return [
      { top: "3%", left: "-10%", duration: 35, delay: 0, scale: 0.8 },
      { top: "12%", left: "-15%", duration: 45, delay: 8, scale: 1.0 },
      { top: "6%", left: "-8%", duration: 30, delay: 15, scale: 0.6 },
      { top: "18%", left: "-20%", duration: 40, delay: 22, scale: 0.9 },
    ];
  }, []);

  const birds = useMemo(() => {
    return [
      { top: "15%", left: "-5%", duration: 18, delay: 0 },
      { top: "25%", left: "-8%", duration: 22, delay: 6 },
      { top: "20%", left: "-3%", duration: 20, delay: 12 },
      { top: "30%", left: "-10%", duration: 25, delay: 18 },
    ];
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-300 via-sky-200 to-emerald-100" />
      <Sun />
      {clouds.map((cloud, idx) => (
        <Cloud key={`cloud-${idx}`} {...cloud} />
      ))}
      {birds.map((bird, idx) => (
        <Bird key={`bird-${idx}`} {...bird} />
      ))}
      <div className="absolute bottom-0 w-full h-40 bg-gradient-to-t from-emerald-800 via-emerald-700 to-emerald-500 opacity-25" />
      {trees.map((tree) => (
        <PalmTree key={tree.id} {...tree} />
      ))}
      <div className="absolute bottom-0 w-full h-6 bg-emerald-900 opacity-35" />
      <div className="absolute bottom-0 w-full h-20 bg-gradient-to-t from-green-900/20 to-transparent" />
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
      item.unit.toLowerCase().includes(searchTerm.toLowerCase());
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

  const getUnitBadgeClass = (unit: string) => {
    if (unit === "ZAK") return "bg-blue-50 text-blue-600 border-blue-100";
    if (unit === "DUS") return "bg-purple-50 text-purple-600 border-purple-100";
    if (unit === "BOTOL") return "bg-pink-50 text-pink-600 border-pink-100";
    return "bg-gray-50 text-gray-600 border-gray-100";
  };

  const hitungStokAwalKG = (row: StockGudang) => {
    if (row.unit === "ZAK") {
      return (row.stokAwalUnit || 0) * (row.bobotPerUnit || 50);
    }
    return row.stokAwalKG || 0;
  };

  const hitungStokAkhirKG = (row: StockGudang) => {
    if (row.unit === "ZAK") {
      return (row.stokAkhirUnit || 0) * (row.bobotPerUnit || 50);
    }
    return row.stokAkhirKG || 0;
  };

  const getStockStatus = (row: StockGudang) => {
    const kg = hitungStokAkhirKG(row);
    if (kg <= 0) return { label: "Habis", color: "bg-red-50 text-red-600 border-red-100", dot: "bg-red-500" };
    if (kg < 1000) return { label: "Menipis", color: "bg-orange-50 text-orange-600 border-orange-100", dot: "bg-orange-500" };
    if (kg < 5000) return { label: "Sedang", color: "bg-yellow-50 text-yellow-600 border-yellow-100", dot: "bg-yellow-500" };
    return { label: "Aman", color: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" };
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

  return (
    <>
      <style jsx global>{`
        @keyframes sway {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes trunkSway {
          0%, 100% { transform: rotate(-1.5deg); }
          50% { transform: rotate(1.5deg); }
        }
        @keyframes frondSway {
          0%, 100% { transform: rotate(-4deg) scale(1); }
          50% { transform: rotate(4deg) scale(1.03); }
        }
        @keyframes float {
          0% { transform: translateX(-200px) scale(var(--cloud-scale, 1)); }
          100% { transform: translateX(calc(100vw + 200px)) scale(var(--cloud-scale, 1)); }
        }
        @keyframes fly {
          0% { transform: translateX(-60px) translateY(0px); }
          20% { transform: translateX(20vw) translateY(-15px); }
          40% { transform: translateX(40vw) translateY(8px); }
          60% { transform: translateX(60vw) translateY(-8px); }
          80% { transform: translateX(80vw) translateY(5px); }
          100% { transform: translateX(calc(100vw + 60px)) translateY(0px); }
        }
        @keyframes wingFlap {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(-0.6); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.92; }
        }
        @keyframes sunGlow {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.4); opacity: 0.15; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(25px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(-30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes countUp {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s ease-out forwards;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.7s ease-out forwards;
        }
        .animate-count-up {
          animation: countUp 0.5s ease-out forwards;
        }
        .animate-delay-100 { animation-delay: 0.1s; opacity: 0; }
        .animate-delay-200 { animation-delay: 0.2s; opacity: 0; }
        .animate-delay-300 { animation-delay: 0.3s; opacity: 0; }
        .animate-delay-400 { animation-delay: 0.4s; opacity: 0; }
        .animate-delay-500 { animation-delay: 0.5s; opacity: 0; }
        .animate-delay-600 { animation-delay: 0.6s; opacity: 0; }
      `}</style>

      <PalmPlantationBackground />

      <div className="min-h-screen relative z-10">
        <nav className="bg-white/80 backdrop-blur-xl border-b border-green-200/60 sticky top-0 z-50 animate-fade-in-up">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-800 rounded-xl flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-300">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-green-900 tracking-tight">REKAP DATA</h1>
                  <p className="text-xs text-green-700 font-medium">PT Bukit Agrochemical</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="primary" size="sm" onClick={() => router.push("/login")}>
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
          <section className="text-center py-8 animate-fade-in-up animate-delay-100">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl shadow-xl mb-6 hover:scale-110 transition-transform duration-300">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-green-900 mb-3 tracking-tight">PT Bukit Agrochemical</h2>
            <p className="text-lg text-green-700 mb-2 font-medium">Sistem Administrasi Distributor Pupuk</p>
            <p className="text-sm text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Platform digital untuk monitoring stock gudang secara real-time.
            </p>
          </section>

          <section className="animate-fade-in-up animate-delay-200">
            <Card className="bg-white/85 backdrop-blur-md shadow-xl border-0 rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 tracking-tight">Laporan Stock Gudang</h3>
                  <p className="text-sm text-gray-500 mt-1">Data persediaan barang per lokasi FOT</p>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-50/80 text-blue-700 rounded-full text-sm font-semibold border border-blue-100">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Mode Lihat Saja
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <Select
                  label="Filter FOT"
                  value={selectedFot}
                  onChange={(e) => setSelectedFot(e.target.value)}
                  options={fotOptions}
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Filter Tanggal</label>
                  <input
                    type="date"
                    value={selectedTanggal}
                    onChange={(e) => setSelectedTanggal(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 focus:bg-white transition-all duration-300 text-sm text-gray-700"
                  />
                </div>
                <Select
                  label="Filter Bulan"
                  value={selectedBulan}
                  onChange={(e) => setSelectedBulan(e.target.value)}
                  options={bulanOptions}
                />
                <Select
                  label="Filter Tahun"
                  value={selectedTahun}
                  onChange={(e) => setSelectedTahun(e.target.value)}
                  options={tahunOptions}
                />
              </div>

              <div className="relative w-full sm:w-96 mb-8">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari kode, nama barang, atau unit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50/80 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 focus:bg-white transition-all duration-300 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl border border-green-100/80 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 animate-count-up animate-delay-100">
                  <p className="text-xs text-green-600 uppercase tracking-wider font-bold">Total Jenis</p>
                  <p className="text-3xl font-bold text-green-700 mt-2 tracking-tight">{filteredStockData.length}</p>
                </div>
                <div className="p-5 bg-gradient-to-br from-blue-50 to-sky-50 rounded-2xl border border-blue-100/80 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 animate-count-up animate-delay-200">
                  <p className="text-xs text-blue-600 uppercase tracking-wider font-bold">Total ZAK</p>
                  <p className="text-3xl font-bold text-blue-700 mt-2 tracking-tight">{getTotalUnit("ZAK").toLocaleString()}</p>
                </div>
                <div className="p-5 bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl border border-purple-100/80 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 animate-count-up animate-delay-300">
                  <p className="text-xs text-purple-600 uppercase tracking-wider font-bold">Total DUS</p>
                  <p className="text-3xl font-bold text-purple-700 mt-2 tracking-tight">{getTotalUnit("DUS").toLocaleString()}</p>
                </div>
                <div className="p-5 bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl border border-pink-100/80 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 animate-count-up animate-delay-400">
                  <p className="text-xs text-pink-600 uppercase tracking-wider font-bold">Total BOTOL</p>
                  <p className="text-3xl font-bold text-pink-700 mt-2 tracking-tight">{getTotalUnit("BOTOL").toLocaleString()}</p>
                </div>
                <div className="p-5 bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl border border-red-100/80 hover:shadow-lg hover:scale-[1.02] transition-all duration-300 animate-count-up animate-delay-500">
                  <p className="text-xs text-red-600 uppercase tracking-wider font-bold">Stock Menipis</p>
                  <p className="text-3xl font-bold text-red-700 mt-2 tracking-tight">{filteredStockData.filter((d: StockGudang) => (d.unit === "ZAK" ? (d.stokAkhirUnit || 0) * (d.bobotPerUnit || 50) : d.stokAkhirKG) < 1000).length}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="text-sm text-gray-500 font-medium flex flex-wrap items-center gap-2">
                  <span>Menampilkan {filteredStockData.length} dari {stockData.length} data</span>
                  {selectedFot && <span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs">FOT: {selectedFot}</span>}
                  {selectedTanggal && <span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs">Tanggal: {formatTanggalDisplay(selectedTanggal)}</span>}
                  {selectedBulan && <span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs">{bulanOptions.find((b) => b.value === selectedBulan)?.label}</span>}
                  {selectedTahun && <span className="px-2 py-0.5 bg-gray-100 rounded-md text-xs">{selectedTahun}</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 font-medium">Tampilkan:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500/30 focus:border-green-400 transition-all cursor-pointer font-medium"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-gray-500">per halaman</span>
                </div>
              </div>

              <div className="overflow-x-auto">
                {isLoadingStock ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-[3px] border-green-200 border-t-green-600"></div>
                    <p className="text-sm text-gray-400 font-medium">Memuat data stock...</p>
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-gray-400">
                    <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                      <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="font-semibold text-lg text-gray-500">Belum ada data stock gudang</p>
                    <p className="text-sm mt-1 text-gray-400">Data akan muncul setelah admin menginput stock</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      <div className="col-span-1">FOT</div>
                      <div className="col-span-2">Kode / Nama</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-1 text-right">Bobot</div>
                      <div className="col-span-2 text-right">Stok Awal</div>
                      <div className="col-span-1 text-right">Masuk</div>
                      <div className="col-span-1 text-right">Keluar</div>
                      <div className="col-span-2 text-right">Stok Akhir</div>
                      <div className="col-span-1 text-center">Status</div>
                    </div>

                    <div className="space-y-2">
                      {paginatedData.map((row: StockGudang, index: number) => {
                        const status = getStockStatus(row);
                        return (
                          <div
                            key={row.id}
                            className="group bg-white rounded-2xl border border-gray-100 hover:border-green-200 hover:shadow-lg hover:shadow-green-50 transition-all duration-300 animate-fade-in-up overflow-hidden"
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <div className="lg:hidden p-5 space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg text-sm">
                                      {row.fot || "-"}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getUnitBadgeClass(row.unit)}`}>
                                      {row.unit}
                                    </span>
                                  </div>
                                  <p className="font-mono text-sm font-semibold text-green-700">{row.kodeBarang}</p>
                                  <p className="text-sm font-medium text-gray-800">{row.namaBarang}</p>
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${status.color}`}>
                                  <span className={`w-2 h-2 rounded-full ${status.dot}`}></span>
                                  {status.label}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-50 rounded-xl p-3">
                                  <p className="text-xs text-gray-500 mb-1">Stok Awal</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono font-semibold text-gray-700">{row.stokAwalUnit?.toLocaleString()} {row.unit}</p>
                                  )}
                                  <p className="text-gray-400 text-xs">{hitungStokAwalKG(row).toLocaleString()} KG</p>
                                </div>
                                <div className="bg-gray-50 rounded-xl p-3">
                                  <p className="text-xs text-gray-500 mb-1">Stok Akhir</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono font-bold text-green-700">{row.stokAkhirUnit?.toLocaleString()} {row.unit}</p>
                                  )}
                                  {row.unit === "KG" && (
                                    <p className="font-mono font-bold text-green-700">{row.stokAkhirKG.toLocaleString()} KG</p>
                                  )}
                                  <p className="text-gray-400 text-xs">{hitungStokAkhirKG(row).toLocaleString()} KG</p>
                                </div>
                                <div className="bg-green-50 rounded-xl p-3">
                                  <p className="text-xs text-green-600 mb-1">Masuk</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono text-green-700 font-semibold">+{row.barangMasukUnit?.toLocaleString()} {row.unit}</p>
                                  )}
                                  <p className="text-green-500 text-xs">+{row.barangMasukKG.toLocaleString()} KG</p>
                                </div>
                                <div className="bg-red-50 rounded-xl p-3">
                                  <p className="text-xs text-red-600 mb-1">Keluar</p>
                                  {row.unit !== "KG" && (
                                    <p className="font-mono text-red-700 font-semibold">-{row.barangKeluarUnit?.toLocaleString()} {row.unit}</p>
                                  )}
                                  <p className="text-red-500 text-xs">-{row.barangKeluarKG.toLocaleString()} KG</p>
                                </div>
                              </div>

                              {row.unit !== "KG" && (
                                <div className="text-xs text-gray-400">
                                  Bobot: {row.bobotPerUnit?.toLocaleString()} KG / {row.unit}
                                </div>
                              )}
                            </div>

                            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 items-center group-hover:bg-green-50/30 transition-colors duration-300">
                              <div className="col-span-1">
                                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded-lg text-sm inline-block">
                                  {row.fot || "-"}
                                </span>
                              </div>
                              <div className="col-span-2">
                                <p className="font-mono text-sm font-semibold text-green-700">{row.kodeBarang}</p>
                                <p className="text-sm text-gray-600 mt-0.5 line-clamp-1">{row.namaBarang}</p>
                              </div>
                              <div className="col-span-1 text-center">
                                <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${getUnitBadgeClass(row.unit)}`}>
                                  {row.unit}
                                </span>
                              </div>
                              <div className="col-span-1 text-right">
                                <span className="font-mono text-sm text-gray-500">
                                  {row.unit === "KG" ? "-" : `${row.bobotPerUnit?.toLocaleString()} KG`}
                                </span>
                              </div>
                              <div className="col-span-2 text-right">
                                {row.unit !== "KG" && (
                                  <p className="font-mono text-sm font-medium text-gray-700">{row.stokAwalUnit?.toLocaleString()} {row.unit}</p>
                                )}
                                <p className="text-gray-400 text-xs">{hitungStokAwalKG(row).toLocaleString()} KG</p>
                              </div>
                              <div className="col-span-1 text-right">
                                {row.unit !== "KG" && (
                                  <p className="text-green-600 font-mono text-sm font-medium">+{row.barangMasukUnit?.toLocaleString()}</p>
                                )}
                                <p className="text-green-500 text-xs">+{row.barangMasukKG.toLocaleString()} KG</p>
                              </div>
                              <div className="col-span-1 text-right">
                                {row.unit !== "KG" && (
                                  <p className="text-red-600 font-mono text-sm font-medium">-{row.barangKeluarUnit?.toLocaleString()}</p>
                                )}
                                <p className="text-red-500 text-xs">-{row.barangKeluarKG.toLocaleString()} KG</p>
                              </div>
                              <div className="col-span-2 text-right">
                                {row.unit !== "KG" && (
                                  <p className="font-mono font-bold text-green-700 text-sm">{row.stokAkhirUnit?.toLocaleString()} {row.unit}</p>
                                )}
                                {row.unit === "KG" && (
                                  <p className="font-mono font-bold text-green-700 text-sm">{row.stokAkhirKG.toLocaleString()} KG</p>
                                )}
                                <p className="text-gray-400 text-xs">{hitungStokAkhirKG(row).toLocaleString()} KG</p>
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
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6 animate-fade-in-up">
                  <div className="text-sm text-gray-500 font-medium">
                    Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredStockData.length)} dari {filteredStockData.length} item
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Awal
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <div className="flex items-center gap-1">
                      {pageNumbers.map((page: number) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-xl text-sm font-bold transition-all duration-200 ${
                            currentPage === page
                              ? "bg-green-600 text-white shadow-lg shadow-green-200 scale-110"
                              : "border border-gray-200 hover:bg-green-50 hover:border-green-200 text-gray-600"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3.5 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-green-50 hover:border-green-200 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                    >
                      Akhir
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          <footer className="text-center py-8 border-t border-green-200/40 animate-fade-in-up animate-delay-300">
            <p className="text-sm text-gray-500 font-medium">
              PT Bukit Agrochemical Baru | Sistem Administrasi Distributor Pupuk
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Untuk mengelola data, silakan login sebagai admin
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}