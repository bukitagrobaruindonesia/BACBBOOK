"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { ProformaInvoice, StockGudang } from "@/app/types";

const PalmTree = ({ delay, height, left, scale }: { delay: number; height: number; left: string; scale: number }) => (
  <div
    className="absolute bottom-0"
    style={{
      left,
      height: `${height}px`,
      transform: `scale(${scale})`,
      transformOrigin: "bottom center",
      animation: `sway 4s ease-in-out infinite`,
      animationDelay: `${delay}s`,
    }}
  >
    <svg viewBox="0 0 100 200" className="h-full w-auto" fill="none">
      <path
        d="M50 200 Q50 150 50 100 Q50 50 50 20"
        stroke="#8B4513"
        strokeWidth="8"
        fill="none"
        style={{ transformOrigin: "50% 100%", animation: `trunkSway 4s ease-in-out infinite`, animationDelay: `${delay}s` }}
      />
      <g style={{ transformOrigin: "50px 20px", animation: `frondSway 3s ease-in-out infinite`, animationDelay: `${delay + 0.5}s` }}>
        <path d="M50 20 Q20 10 10 30 Q30 25 50 20" fill="#228B22" opacity="0.9" />
        <path d="M50 20 Q80 10 90 30 Q70 25 50 20" fill="#32CD32" opacity="0.9" />
        <path d="M50 20 Q30 0 20 15 Q35 10 50 20" fill="#006400" opacity="0.8" />
        <path d="M50 20 Q70 0 80 15 Q65 10 50 20" fill="#228B22" opacity="0.8" />
        <path d="M50 20 Q40 -10 50 5 Q55 -5 50 20" fill="#32CD32" opacity="0.9" />
      </g>
    </svg>
  </div>
);

const Cloud = ({ top, left, duration, delay }: { top: string; left: string; duration: number; delay: number }) => (
  <div
    className="absolute opacity-60"
    style={{
      top,
      left,
      animation: `float ${duration}s linear infinite`,
      animationDelay: `${delay}s`,
    }}
  >
    <svg width="100" height="40" viewBox="0 0 100 40" fill="white">
      <ellipse cx="30" cy="25" rx="25" ry="15" />
      <ellipse cx="55" cy="20" rx="30" ry="18" />
      <ellipse cx="75" cy="25" rx="20" ry="12" />
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
    <svg width="30" height="20" viewBox="0 0 30 20" fill="none" stroke="#333" strokeWidth="2">
      <path d="M5 10 Q10 5 15 10 Q20 5 25 10" style={{ animation: `wingFlap 0.5s ease-in-out infinite`, transformOrigin: "15px 10px" }} />
    </svg>
  </div>
);

const Sun = () => (
  <div className="absolute top-8 right-8 w-24 h-24">
    <div
      className="w-full h-full rounded-full bg-gradient-to-br from-yellow-300 to-orange-400 shadow-lg"
      style={{ animation: "pulse 4s ease-in-out infinite" }}
    />
    <div
      className="absolute inset-0 rounded-full bg-yellow-200 opacity-30"
      style={{ animation: "sunGlow 3s ease-in-out infinite" }}
    />
  </div>
);

const PalmPlantationBackground = () => {
  const trees = useMemo(() => {
    const treeArray = [];
    for (let i = 0; i < 15; i++) {
      treeArray.push({
        id: i,
        delay: Math.random() * 3,
        height: 150 + Math.random() * 100,
        left: `${(i / 15) * 100 + Math.random() * 5}%`,
        scale: 0.6 + Math.random() * 0.4,
      });
    }
    return treeArray;
  }, []);

  const clouds = useMemo(() => {
    return [
      { top: "5%", left: "10%", duration: 25, delay: 0 },
      { top: "15%", left: "60%", duration: 30, delay: 5 },
      { top: "8%", left: "80%", duration: 20, delay: 10 },
    ];
  }, []);

  const birds = useMemo(() => {
    return [
      { top: "20%", left: "-5%", duration: 15, delay: 0 },
      { top: "30%", left: "-10%", duration: 20, delay: 8 },
      { top: "25%", left: "-3%", duration: 18, delay: 15 },
    ];
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-sky-100 to-green-50" />
      <Sun />
      {clouds.map((cloud, idx) => (
        <Cloud key={`cloud-${idx}`} {...cloud} />
      ))}
      {birds.map((bird, idx) => (
        <Bird key={`bird-${idx}`} {...bird} />
      ))}
      <div className="absolute bottom-0 w-full h-32 bg-gradient-to-t from-green-800 to-green-600 opacity-20" />
      {trees.map((tree) => (
        <PalmTree key={tree.id} {...tree} />
      ))}
      <div className="absolute bottom-0 w-full h-4 bg-green-900 opacity-30" />
    </div>
  );
};

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalPI: 0,
    totalStock: 0,
    totalBarangMasuk: 0,
    totalBarangKeluar: 0,
    totalStokAkhirUnit: 0,
    totalStokAkhirKG: 0,
    recentPI: [] as ProformaInvoice[],
    lowStock: [] as StockGudang[],
    stockList: [] as StockGudang[],
    recentMasuk: [] as any[],
    recentKeluar: [] as any[],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFot, setSelectedFot] = useState<string>("");
  const [filterTanggal, setFilterTanggal] = useState<string>(new Date().toISOString().split("T")[0]);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    fetchDashboardData();
  }, [filterTanggal]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFot, itemsPerPage]);

  const getDateRange = (dateString: string) => {
    const startDate = new Date(dateString);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(dateString);
    endDate.setHours(23, 59, 59, 999);
    return {
      start: Timestamp.fromDate(startDate),
      end: Timestamp.fromDate(endDate),
    };
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const dateRange = getDateRange(filterTanggal);

      const piQuery = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"), limit(5));
      const piSnapshot = await getDocs(piQuery);
      const piData = piSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as ProformaInvoice));

      const stockQuery = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const stockSnapshot = await getDocs(stockQuery);
      const stockData = stockSnapshot.docs.map((doc) => ({
        id: doc.id,
        fot: doc.data().fot || "",
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        botolPerDus: doc.data().botolPerDus,
        stokAwalUnit: doc.data().stokAwalUnit || 0,
        stokAwalKG: doc.data().stokAwalKG || 0,
        barangMasukUnit: doc.data().barangMasukUnit || 0,
        barangMasukKG: doc.data().barangMasukKG || 0,
        barangKeluarUnit: doc.data().barangKeluarUnit || 0,
        barangKeluarKG: doc.data().barangKeluarKG || 0,
        stokAkhirUnit: doc.data().stokAkhirUnit || 0,
        stokAkhirKG: doc.data().stokAkhirKG || 0,
        createdBy: doc.data().createdBy || "",
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as StockGudang));

      const masukQuery = query(
        collection(db, "transaksiBarangMasuk"),
        where("createdAt", ">=", dateRange.start),
        where("createdAt", "<=", dateRange.end),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const masukSnapshot = await getDocs(masukQuery);
      const masukData = masukSnapshot.docs.map((doc) => ({
        id: doc.id,
        tanggal: doc.data().tanggal || "",
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
        jumlahZAK: doc.data().jumlahZAK || 0,
        totalKG: doc.data().totalKG || 0,
        fot: doc.data().fot || "",
        createdBy: doc.data().createdBy || "",
        createdAt: doc.data().createdAt?.toDate(),
      }));

      const keluarQuery = query(
        collection(db, "transaksiBarangKeluar"),
        where("createdAt", ">=", dateRange.start),
        where("createdAt", "<=", dateRange.end),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const keluarSnapshot = await getDocs(keluarQuery);
      const keluarData = keluarSnapshot.docs.map((doc) => ({
        id: doc.id,
        tanggal: doc.data().tanggal || "",
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
        jumlahZAK: doc.data().jumlahZAK || 0,
        totalKG: doc.data().totalKG || 0,
        fot: doc.data().fot || "",
        namaCustomer: doc.data().namaCustomer || "",
        createdBy: doc.data().createdBy || "",
        createdAt: doc.data().createdAt?.toDate(),
      }));

      const piTotal = (await getDocs(collection(db, "proformaInvoice"))).size;
      const stockTotal = stockSnapshot.size;

      const totalMasukUnit = masukData.reduce((sum, item) => sum + (item.jumlahZAK || 0), 0);
      const totalMasukKG = masukData.reduce((sum, item) => sum + (item.totalKG || 0), 0);
      const totalKeluarUnit = keluarData.reduce((sum, item) => sum + (item.jumlahZAK || 0), 0);
      const totalKeluarKG = keluarData.reduce((sum, item) => sum + (item.totalKG || 0), 0);
      const totalStokUnit = stockData.reduce((sum, s) => sum + (s.stokAkhirUnit || 0), 0);
      const totalStokKG = stockData.reduce((sum, s) => sum + (s.stokAkhirKG || 0), 0);

      setStats({
        totalPI: piTotal,
        totalStock: stockTotal,
        totalBarangMasuk: totalMasukUnit,
        totalBarangKeluar: totalKeluarUnit,
        totalStokAkhirUnit: totalStokUnit,
        totalStokAkhirKG: totalStokKG,
        recentPI: piData,
        lowStock: stockData.filter((s) => s.stokAkhirKG < 1000).slice(0, 5),
        stockList: stockData,
        recentMasuk: masukData.slice(0, 5),
        recentKeluar: keluarData.slice(0, 5),
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getUnitLabel = (unit: string) => {
    if (unit === "BOTOL") return "ZAK";
    if (unit === "KG") return "KG";
    return unit;
  };

  const getStockStatus = (stock: StockGudang) => {
    if (stock.stokAkhirKG <= 0) return { label: "Habis", color: "bg-red-100 text-red-700 border-red-200" };
    if (stock.stokAkhirKG < 1000) return { label: "Menipis", color: "bg-orange-100 text-orange-700 border-orange-200" };
    if (stock.stokAkhirKG < 5000) return { label: "Sedang", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
    return { label: "Aman", color: "bg-green-100 text-green-700 border-green-200" };
  };

  const fotList = Array.from(new Set(stats.stockList.map((s) => s.fot))).sort();

  const filteredStock = selectedFot
    ? stats.stockList.filter((s) => s.fot === selectedFot)
    : stats.stockList;

  const totalPages = Math.ceil(filteredStock.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStock = filteredStock.slice(startIndex, endIndex);

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

  const isToday = filterTanggal === new Date().toISOString().split("T")[0];

  const quickActions = [
    {
      title: "Input Proforma Invoice",
      desc: "Buat proforma invoice baru",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      href: "/dashboard/input-proforma-invoice",
      color: "from-green-600 to-green-700",
    },
    {
      title: "Input Stock Gudang",
      desc: "Kelola data stock barang",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      href: "/dashboard/input-stock-gudang",
      color: "from-amber-600 to-amber-700",
    },
    {
      title: "Rekap PI",
      desc: "Lihat riwayat proforma invoice",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      href: "/dashboard/rekap-proforma-invoice",
      color: "from-emerald-600 to-emerald-700",
    },
    {
      title: "Laporan Stock",
      desc: "Laporan keseluruhan stock",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      href: "/dashboard/laporan-stock-gudang",
      color: "from-teal-600 to-teal-700",
    },
    {
      title: "Transaksi Masuk",
      desc: "Input barang masuk ke gudang",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
      ),
      href: "/dashboard/transaksi-barang-masuk",
      color: "from-blue-600 to-blue-700",
    },
    {
      title: "Transaksi Keluar",
      desc: "Input barang keluar dari gudang",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
        </svg>
      ),
      href: "/dashboard/transaksi-barang-keluar",
      color: "from-orange-600 to-orange-700",
    },
    {
      title: "Riwayat Transaksi",
      desc: "Lihat riwayat barang masuk dan keluar",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      href: "/dashboard/riwayat-transaksi",
      color: "from-purple-600 to-purple-700",
    },
  ];

  return (
    <>
      <style jsx global>{`
        @keyframes sway {
          0%, 100% { transform: rotate(-2deg); }
          50% { transform: rotate(2deg); }
        }
        @keyframes trunkSway {
          0%, 100% { transform: rotate(-1deg); }
          50% { transform: rotate(1deg); }
        }
        @keyframes frondSway {
          0%, 100% { transform: rotate(-3deg) scale(1); }
          50% { transform: rotate(3deg) scale(1.02); }
        }
        @keyframes float {
          0% { transform: translateX(-100px); }
          100% { transform: translateX(calc(100vw + 100px)); }
        }
        @keyframes fly {
          0% { transform: translateX(-50px) translateY(0px); }
          25% { transform: translateX(25vw) translateY(-10px); }
          50% { transform: translateX(50vw) translateY(5px); }
          75% { transform: translateX(75vw) translateY(-5px); }
          100% { transform: translateX(calc(100vw + 50px)) translateY(0px); }
        }
        @keyframes wingFlap {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(-0.5); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }
        @keyframes sunGlow {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.3); opacity: 0.1; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.6s ease-out forwards;
        }
        .animate-delay-100 { animation-delay: 0.1s; }
        .animate-delay-200 { animation-delay: 0.2s; }
        .animate-delay-300 { animation-delay: 0.3s; }
        .animate-delay-400 { animation-delay: 0.4s; }
      `}</style>

      <PalmPlantationBackground />

      <div className="space-y-8 relative z-10">
        <div className="animate-fade-in-up">
          <Header
            title={`Selamat Datang, ${user?.nama}`}
            subtitle="Dashboard Administrasi PT Bukit Agrochemical Baru"
          />
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200 animate-fade-in-up animate-delay-100">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm font-semibold text-gray-700">Filter Tanggal Transaksi:</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={filterTanggal}
                onChange={(e) => setFilterTanggal(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white/90"
              />
              <button
                onClick={() => setFilterTanggal(new Date().toISOString().split("T")[0])}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isToday
                    ? "bg-green-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Hari Ini
              </button>
            </div>
            <div className="text-xs text-gray-500">
              {isToday ? "Menampilkan data transaksi hari ini" : `Menampilkan data transaksi tanggal ${new Date(filterTanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white border-none animate-fade-in-up animate-delay-100 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Total Proforma Invoice</p>
                <p className="text-4xl font-bold mt-2">{stats.totalPI}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-amber-600 to-amber-700 text-white border-none animate-fade-in-up animate-delay-200 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Total Jenis Stock</p>
                <p className="text-4xl font-bold mt-2">{stats.totalStock}</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none animate-fade-in-up animate-delay-300 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Barang Masuk</p>
                <p className="text-4xl font-bold mt-2">{stats.totalBarangMasuk.toLocaleString()}</p>
                <p className="text-blue-200 text-xs mt-1">{stats.totalStokAkhirKG.toLocaleString()} KG total stok</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-orange-600 to-orange-700 text-white border-none animate-fade-in-up animate-delay-400 hover:scale-105 transition-transform duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium">Total Barang Keluar</p>
                <p className="text-4xl font-bold mt-2">{stats.totalBarangKeluar.toLocaleString()}</p>
                <p className="text-orange-200 text-xs mt-1">{stats.totalStokAkhirKG.toLocaleString()} KG total stok</p>
              </div>
              <div className="p-3 bg-white/20 rounded-xl">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
                </svg>
              </div>
            </div>
          </Card>
        </div>

        <div className="animate-fade-in-up animate-delay-200">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Aksi Cepat
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {quickActions.map((action, index) => (
              <div
                key={action.title}
                onClick={() => router.push(action.href)}
                className="group cursor-pointer animate-fade-in-up"
                style={{ animationDelay: `${0.3 + index * 0.1}s` }}
              >
                <Card className="h-full hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-1 bg-white/90 backdrop-blur-sm">
                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${action.color} text-white shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                    {action.icon}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-1 group-hover:text-green-700 transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-sm text-gray-500">{action.desc}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 animate-fade-in-up animate-delay-300">
            <Card title="Data Stock Gudang" className="h-full bg-white/90 backdrop-blur-sm">
              <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-gray-600">Filter FOT:</span>
                  <select
                    value={selectedFot}
                    onChange={(e) => setSelectedFot(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white/90"
                  >
                    <option value="">Semua FOT</option>
                    {fotList.map((fot) => (
                      <option key={fot} value={fot}>{fot}</option>
                    ))}
                  </select>
                  {selectedFot && (
                    <button
                      onClick={() => setSelectedFot("")}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Reset
                    </button>
                  )}
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-sm font-medium text-gray-600">Tampilkan:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => setItemsPerPage(Number(e.target.value))}
                      className="px-2 py-1 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white/90"
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
                <div className="text-sm text-gray-500">
                  Menampilkan {filteredStock.length} dari {stats.stockList.length} item
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-gray-400">
                  <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="font-medium">Belum ada data stock gudang</p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">FOT</th>
                          <th className="text-left py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Kode</th>
                          <th className="text-left py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Nama Barang</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Unit</th>
                          <th className="text-right py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Stok Awal</th>
                          <th className="text-right py-3 px-2 font-semibold text-green-600 uppercase text-xs tracking-wider">Masuk</th>
                          <th className="text-right py-3 px-2 font-semibold text-red-600 uppercase text-xs tracking-wider">Keluar</th>
                          <th className="text-right py-3 px-2 font-semibold text-gray-800 uppercase text-xs tracking-wider">Stok Akhir</th>
                          <th className="text-center py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {paginatedStock.map((stock, index) => {
                          const status = getStockStatus(stock);
                          const displayUnit = getUnitLabel(stock.unit);
                          return (
                            <tr 
                              key={stock.id} 
                              className="hover:bg-gray-50 transition-colors animate-fade-in-up"
                              style={{ animationDelay: `${index * 0.05}s` }}
                            >
                              <td className="py-3 px-2">
                                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">
                                  {stock.fot}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <span className="font-mono font-semibold text-green-700 bg-green-50 px-2 py-1 rounded text-xs">
                                  {stock.kodeBarang}
                                </span>
                              </td>
                              <td className="py-3 px-2">
                                <span className="font-medium text-gray-800">{stock.namaBarang}</span>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                                  stock.unit === "ZAK" ? "bg-blue-100 text-blue-700" :
                                  stock.unit === "DUS" ? "bg-purple-100 text-purple-700" :
                                  stock.unit === "BOTOL" ? "bg-pink-100 text-pink-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {stock.unit}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="font-mono text-gray-600">
                                  {stock.unit !== "KG" && (
                                    <span>{stock.stokAwalUnit?.toLocaleString()} {displayUnit}</span>
                                  )}
                                  <span className="block text-xs text-gray-400">{stock.stokAwalKG?.toLocaleString()} KG</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="font-mono text-green-600">
                                  {stock.unit !== "KG" && (
                                    <span>+{stock.barangMasukUnit?.toLocaleString()} {displayUnit}</span>
                                  )}
                                  <span className="block text-xs text-green-500">+{stock.barangMasukKG?.toLocaleString()} KG</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="font-mono text-red-600">
                                  {stock.unit !== "KG" && (
                                    <span>-{stock.barangKeluarUnit?.toLocaleString()} {displayUnit}</span>
                                  )}
                                  <span className="block text-xs text-red-500">-{stock.barangKeluarKG?.toLocaleString()} KG</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="font-mono font-bold text-gray-800">
                                  {stock.unit !== "KG" && (
                                    <span className="text-green-700">{stock.stokAkhirUnit?.toLocaleString()} {displayUnit}</span>
                                  )}
                                  <span className="block text-xs text-green-600">{stock.stokAkhirKG?.toLocaleString()} KG</span>
                                </div>
                              </td>
                              <td className="py-3 px-2 text-center">
                                <span className={`px-2 py-1 rounded-md text-xs font-bold border ${status.color}`}>
                                  {status.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 pt-4">
                      <div className="text-sm text-gray-500">
                        Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredStock.length)} dari {filteredStock.length} item
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Awal
                        </button>
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Sebelumnya
                        </button>
                        
                        <div className="flex items-center gap-1">
                          {pageNumbers.map((page) => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                currentPage === page
                                  ? "bg-green-600 text-white"
                                  : "border border-gray-300 hover:bg-gray-100 text-gray-700"
                              }`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                        
                        <button
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Selanjutnya
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="px-3 py-1 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          Akhir
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="space-y-6 animate-fade-in-up animate-delay-400">
            <Card title="Stock Menipis (Perhatian)" className="bg-white/90 backdrop-blur-sm">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
                </div>
              ) : stats.lowStock.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-green-600">
                  <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium">Semua stock dalam kondisi aman</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.lowStock.map((stock, index) => (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100 animate-fade-in-up hover:scale-105 transition-transform"
                      style={{ animationDelay: `${index * 0.1}s` }}
                    >
                      <div>
                        <p className="font-semibold text-gray-800">{stock.namaBarang}</p>
                        <p className="text-sm text-gray-500">{stock.kodeBarang} | {stock.fot}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">{stock.stokAkhirKG.toLocaleString()} KG</p>
                        <p className="text-xs text-red-400">Sisa stock sangat rendah</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Transaksi Terbaru" className="bg-white/90 backdrop-blur-sm">
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">Barang Masuk Terakhir</h4>
                  {stats.recentMasuk.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Belum ada transaksi masuk</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.recentMasuk.slice(0, 3).map((item, index) => (
                        <div 
                          key={item.id} 
                          className="p-3 bg-green-50 rounded-lg border border-green-100 animate-fade-in-up hover:bg-green-100 transition-colors"
                          style={{ animationDelay: `${index * 0.1}s` }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-gray-800">{item.namaBarang}</span>
                            <span className="text-xs font-mono text-green-700">+{item.jumlahZAK} {item.unit}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{item.tanggal} | {item.fot}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">Barang Keluar Terakhir</h4>
                  {stats.recentKeluar.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2">Belum ada transaksi keluar</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.recentKeluar.slice(0, 3).map((item, index) => (
                        <div 
                          key={item.id} 
                          className="p-3 bg-orange-50 rounded-lg border border-orange-100 animate-fade-in-up hover:bg-orange-100 transition-colors"
                          style={{ animationDelay: `${index * 0.1}s` }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-sm text-gray-800">{item.namaBarang}</span>
                            <span className="text-xs font-mono text-orange-700">-{item.jumlahZAK} {item.unit}</span>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{item.tanggal} | {item.fot}</p>
                          <p className="text-xs text-gray-400">{item.namaCustomer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up animate-delay-400">
          <Card title="Proforma Invoice Terbaru" className="bg-white/90 backdrop-blur-sm">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
              </div>
            ) : stats.recentPI.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Belum ada data proforma invoice</p>
            ) : (
              <div className="space-y-3">
                {stats.recentPI.map((pi, index) => (
                  <div
                    key={pi.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors cursor-pointer animate-fade-in-up"
                    style={{ animationDelay: `${index * 0.1}s` }}
                    onClick={() => router.push("/dashboard/rekap-proforma-invoice")}
                  >
                    <div>
                      <p className="font-semibold text-gray-800">{pi.nomorPI}</p>
                      <p className="text-sm text-gray-500">{pi.namaCustomer}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-700">{pi.namaProduk}</p>
                      <p className="text-xs text-gray-400">{pi.tanggal}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Ringkasan Stock per FOT" className="bg-white/90 backdrop-blur-sm">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
              </div>
            ) : fotList.length === 0 ? (
              <p className="text-center text-gray-400 py-8">Belum ada data FOT</p>
            ) : (
              <div className="space-y-3">
                {fotList.map((fot, index) => {
                  const fotStocks = stats.stockList.filter((s) => s.fot === fot);
                  const totalUnit = fotStocks.reduce((sum, s) => sum + (s.stokAkhirUnit || 0), 0);
                  const totalKG = fotStocks.reduce((sum, s) => sum + (s.stokAkhirKG || 0), 0);
                  return (
                    <div
                      key={fot}
                      className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-all hover:scale-105 animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.1}s` }}
                      onClick={() => setSelectedFot(fot)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-lg">
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-bold text-gray-800">{fot}</p>
                          <p className="text-xs text-gray-500">{fotStocks.length} jenis barang</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-blue-700 font-mono">{totalUnit.toLocaleString()} Unit</p>
                        <p className="text-xs text-blue-600">{totalKG.toLocaleString()} KG</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}