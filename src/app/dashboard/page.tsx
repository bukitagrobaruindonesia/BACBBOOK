"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { ProformaInvoice, StockGudang } from "@/app/types";

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

  useEffect(() => {
    fetchDashboardData();
  }, [filterTanggal]);

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

  const isToday = filterTanggal === new Date().toISOString().split("T")[0];

  const formatRupiah = (num: number) => {
    if (!num && num !== 0) return "Rp -";
    return "Rp " + num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

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
    <div className="space-y-8">
      <Header
        title={`Selamat Datang, ${user?.nama}`}
        subtitle="Dashboard Administrasi PT Bukit Agrochemical Baru"
      />

      <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200">
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
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
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
        <Card className="bg-gradient-to-br from-green-600 to-green-700 text-white border-none">
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

        <Card className="bg-gradient-to-br from-amber-600 to-amber-700 text-white border-none">
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

        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none">
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

        <Card className="bg-gradient-to-br from-orange-600 to-orange-700 text-white border-none">
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

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Aksi Cepat
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickActions.map((action) => (
            <div
              key={action.title}
              onClick={() => router.push(action.href)}
              className="group cursor-pointer"
            >
              <Card className="h-full hover:shadow-2xl transition-all duration-300 group-hover:-translate-y-1">
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
        <div className="lg:col-span-2">
          <Card title="Data Stock Gudang" className="h-full">
            <div className="mb-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Filter FOT:</span>
                <select
                  value={selectedFot}
                  onChange={(e) => setSelectedFot(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
                    {filteredStock.map((stock) => {
                      const status = getStockStatus(stock);
                      const displayUnit = getUnitLabel(stock.unit);
                      return (
                        <tr key={stock.id} className="hover:bg-gray-50 transition-colors">
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
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Stock Menipis (Perhatian)">
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
                {stats.lowStock.map((stock) => (
                  <div
                    key={stock.id}
                    className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100"
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

          <Card title="Transaksi Terbaru">
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold text-green-600 uppercase tracking-wider mb-2">Barang Masuk Terakhir</h4>
                {stats.recentMasuk.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">Belum ada transaksi masuk</p>
                ) : (
                  <div className="space-y-2">
                    {stats.recentMasuk.slice(0, 3).map((item) => (
                      <div key={item.id} className="p-3 bg-green-50 rounded-lg border border-green-100">
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
                    {stats.recentKeluar.slice(0, 3).map((item) => (
                      <div key={item.id} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Proforma Invoice Terbaru">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
            </div>
          ) : stats.recentPI.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Belum ada data proforma invoice</p>
          ) : (
            <div className="space-y-3">
              {stats.recentPI.map((pi) => (
                <div
                  key={pi.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-green-50 transition-colors cursor-pointer"
                  onClick={() => router.push("/dashboard/rekap-proforma-invoice")}
                >
                  <div>
                    <p className="font-semibold text-gray-800">{pi.nomorPI}</p>
                    <p className="text-sm text-gray-500">{pi.namaCustomer}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-green-700">
                      {pi.produkItems && pi.produkItems.length > 0
                        ? pi.produkItems.map((p) => p.namaProduk).join(", ")
                        : "-"}
                    </p>
                    <p className="text-xs text-gray-400">{pi.tanggal}</p>
                    <p className="text-xs font-mono text-green-600 font-semibold">
                      {formatRupiah(pi.jumlahTertagih || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Ringkasan Stock per FOT">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
            </div>
          ) : fotList.length === 0 ? (
            <p className="text-center text-gray-400 py-8">Belum ada data FOT</p>
          ) : (
            <div className="space-y-3">
              {fotList.map((fot) => {
                const fotStocks = stats.stockList.filter((s) => s.fot === fot);
                const totalUnit = fotStocks.reduce((sum, s) => sum + (s.stokAkhirUnit || 0), 0);
                const totalKG = fotStocks.reduce((sum, s) => sum + (s.stokAkhirKG || 0), 0);
                return (
                  <div
                    key={fot}
                    className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
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
  );
}