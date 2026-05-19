"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Button from "@/app/components/ui/Button";
import Table from "@/app/components/ui/Table";
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
  const [data, setData] = useState<StockGudang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFot, setSelectedFot] = useState("");
  const [selectedBulan, setSelectedBulan] = useState("");
  const [selectedTahun, setSelectedTahun] = useState("");
  const [fotList, setFotList] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFot, selectedBulan, selectedTahun, searchTerm, itemsPerPage]);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("kodeBarang", "asc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as StockGudang));
      setData(items);

      const fotSet = new Set<string>();
      items.forEach((item) => {
        if (item.fot && typeof item.fot === "string" && item.fot.trim()) {
          fotSet.add(item.fot.trim().toUpperCase());
        }
      });
      setFotList(Array.from(fotSet).sort());
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredData = data.filter((item) => {
    const matchSearch =
      item.kodeBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchTerm.toLowerCase());

    const matchFot = selectedFot ? item.fot === selectedFot : true;

    const matchBulanTahun = (() => {
      if (!selectedBulan && !selectedTahun) return true;
      const date = item.createdAt instanceof Date ? item.createdAt : new Date();
      const matchBulan = selectedBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === selectedBulan : true;
      const matchTahun = selectedTahun ? date.getFullYear().toString() === selectedTahun : true;
      return matchBulan && matchTahun;
    })();

    return matchSearch && matchFot && matchBulanTahun;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  const pageNumbers = useMemo(() => {
    const pages = [];
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
    ...fotList.map((f) => ({ value: f, label: f })),
  ];

  const getUnitBadgeClass = (unit: string) => {
    if (unit === "ZAK") return "bg-blue-100 text-blue-700";
    if (unit === "DUS") return "bg-purple-100 text-purple-700";
    if (unit === "BOTOL") return "bg-pink-100 text-pink-700";
    return "bg-gray-100 text-gray-700";
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
    if (kg <= 0) return { label: "Habis", color: "bg-red-100 text-red-700 border-red-200" };
    if (kg < 1000) return { label: "Menipis", color: "bg-orange-100 text-orange-700 border-orange-200" };
    if (kg < 5000) return { label: "Sedang", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    return { label: "Aman", color: "bg-green-100 text-green-700 border-green-200" };
  };

  const columns = [
    {
      key: "fot",
      header: "FOT",
      width: "100px",
      render: (row: StockGudang) => (
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
          {row.fot || "-"}
        </span>
      ),
    },
    {
      key: "kodeBarang",
      header: "Kode",
      width: "120px",
      render: (row: StockGudang) => (
        <span className="font-mono font-semibold text-green-700 bg-green-50 px-2 py-1 rounded">
          {row.kodeBarang}
        </span>
      ),
    },
    {
      key: "namaBarang",
      header: "Nama Barang",
      render: (row: StockGudang) => (
        <span className="font-medium text-gray-800">{row.namaBarang}</span>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: "80px",
      render: (row: StockGudang) => (
        <span className={`px-2 py-1 rounded-md text-xs font-bold ${getUnitBadgeClass(row.unit)}`}>
          {row.unit}
        </span>
      ),
    },
    {
      key: "bobot",
      header: "Bobot",
      width: "100px",
      render: (row: StockGudang) => (
        <span className="font-mono text-gray-600">
          {row.unit === "KG" ? "-" : `${row.bobotPerUnit?.toLocaleString()} KG`}
        </span>
      ),
    },
    {
      key: "stokAwal",
      header: "Stok Awal",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {row.unit !== "KG" && (
            <p className="font-mono">{row.stokAwalUnit?.toLocaleString()} {row.unit}</p>
          )}
          <p className="text-gray-500 text-xs">{hitungStokAwalKG(row).toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "masuk",
      header: "Masuk",
      width: "130px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {row.unit !== "KG" && (
            <p className="text-green-600 font-mono">+{row.barangMasukUnit?.toLocaleString()} {row.unit}</p>
          )}
          <p className="text-green-500 text-xs">+{row.barangMasukKG.toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "keluar",
      header: "Keluar",
      width: "130px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {row.unit !== "KG" && (
            <p className="text-red-600 font-mono">-{row.barangKeluarUnit?.toLocaleString()} {row.unit}</p>
          )}
          <p className="text-red-500 text-xs">-{row.barangKeluarKG.toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "stokAkhir",
      header: "Stok Akhir",
      width: "150px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {row.unit !== "KG" && (
            <p className="font-mono font-bold text-green-700">{row.stokAkhirUnit?.toLocaleString()} {row.unit}</p>
          )}
          {row.unit === "KG" && (
            <p className="font-mono font-bold text-green-700">{row.stokAkhirKG.toLocaleString()} KG</p>
          )}
          <p className="text-gray-500 text-xs">{hitungStokAkhirKG(row).toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (row: StockGudang) => {
        const status = getStockStatus(row);
        return (
          <span className={`px-2 py-1 rounded-md text-xs font-bold border ${status.color}`}>
            {status.label}
          </span>
        );
      },
    },
  ];

  const getTotalUnit = (unitType: string) => {
    return filteredData
      .filter((d) => d.unit === unitType)
      .reduce((sum, d) => sum + (d.stokAkhirUnit || 0), 0);
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
        <nav className="bg-white/80 backdrop-blur-xl border-b border-green-200 sticky top-0 z-50 animate-fade-in-up">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-green-900">REKAP DATA</h1>
                  <p className="text-xs text-green-700">PT Bukit Agrochemical</p>
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={() => router.push("/login")}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
                Login Admin
              </Button>
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
            <h2 className="text-3xl sm:text-4xl font-bold text-green-900 mb-3">PT Bukit Agrochemical</h2>
            <p className="text-lg text-green-700 mb-2">Sistem Administrasi Distributor Pupuk</p>
            <p className="text-sm text-gray-500 max-w-2xl mx-auto">
              Platform digital untuk monitoring stock gudang pupuk secara real-time.
              Lihat laporan persediaan barang per FOT dengan filter dinamis.
            </p>
          </section>

          <section className="animate-fade-in-up animate-delay-200">
            <Card className="bg-white/85 backdrop-blur-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Laporan Stock Gudang</h3>
                  <p className="text-sm text-gray-500">Data persediaan barang per lokasi FOT</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm font-medium">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Mode Lihat Saja
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Select
                  label="Filter FOT"
                  value={selectedFot}
                  onChange={(e) => setSelectedFot(e.target.value)}
                  options={fotOptions}
                />
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

              <div className="relative w-full sm:w-96 mb-6">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Cari kode, nama barang, atau unit..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white/90"
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="p-4 bg-green-50 rounded-xl border border-green-100 hover:scale-105 transition-transform animate-count-up animate-delay-100">
                  <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Total Jenis</p>
                  <p className="text-2xl font-bold text-green-700 mt-1">{filteredData.length}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 hover:scale-105 transition-transform animate-count-up animate-delay-200">
                  <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total ZAK</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">{getTotalUnit("ZAK").toLocaleString()}</p>
                </div>
                <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 hover:scale-105 transition-transform animate-count-up animate-delay-300">
                  <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Total DUS</p>
                  <p className="text-2xl font-bold text-purple-700 mt-1">{getTotalUnit("DUS").toLocaleString()}</p>
                </div>
                <div className="p-4 bg-pink-50 rounded-xl border border-pink-100 hover:scale-105 transition-transform animate-count-up animate-delay-400">
                  <p className="text-xs text-pink-600 uppercase tracking-wide font-semibold">Total BOTOL</p>
                  <p className="text-2xl font-bold text-pink-700 mt-1">{getTotalUnit("BOTOL").toLocaleString()}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-xl border border-red-100 hover:scale-105 transition-transform animate-count-up animate-delay-500">
                  <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Stock Menipis</p>
                  <p className="text-2xl font-bold text-red-700 mt-1">{filteredData.filter((d) => (d.unit === "ZAK" ? (d.stokAkhirUnit || 0) * (d.bobotPerUnit || 50) : d.stokAkhirKG) < 1000).length}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div className="text-sm text-gray-500">
                  Menampilkan {filteredData.length} dari {data.length} data
                  {selectedFot && ` | FOT: ${selectedFot}`}
                  {selectedBulan && ` | Bulan: ${bulanOptions.find((b) => b.value === selectedBulan)?.label}`}
                  {selectedTahun && ` | Tahun: ${selectedTahun}`}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Tampilkan:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => setItemsPerPage(Number(e.target.value))}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90"
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
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700"></div>
                  </div>
                ) : paginatedData.length === 0 ? (
                  <div className="flex flex-col items-center py-12 text-gray-400">
                    <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="font-medium text-lg">Belum ada data stock gudang</p>
                    <p className="text-sm mt-1">Data akan muncul setelah admin menginput stock</p>
                  </div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            className="text-left py-3 px-2 font-bold text-gray-700 uppercase text-xs tracking-wider"
                            style={col.width ? { width: col.width } : {}}
                          >
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedData.map((row, index) => (
                        <tr
                          key={row.id}
                          className="hover:bg-green-50/50 transition-colors animate-fade-in-up"
                          style={{ animationDelay: `${index * 0.05}s` }}
                        >
                          {columns.map((col) => (
                            <td key={col.key} className="py-3 px-2">
                              {col.render ? col.render(row) : (row as any)[col.key]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {totalPages > 1 && (
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 pt-5 animate-fade-in-up">
                  <div className="text-sm text-gray-500">
                    Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredData.length)} dari {filteredData.length} item
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-green-50 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Awal
                    </button>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-green-50 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    <div className="flex items-center gap-1">
                      {pageNumbers.map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                            currentPage === page
                              ? "bg-green-600 text-white shadow-md scale-110"
                              : "border border-gray-300 hover:bg-green-50 hover:border-green-300 text-gray-700"
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-green-50 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-green-50 hover:border-green-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      Akhir
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          <footer className="text-center py-8 border-t border-green-200/60 animate-fade-in-up animate-delay-300">
            <p className="text-sm text-gray-500">
              PT Bukit Agrochemical | Sistem Administrasi Distributor Pupuk
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