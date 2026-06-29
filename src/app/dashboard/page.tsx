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
    totalBarangKeluarKG: 0,
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
  const [hiddenMenus, setHiddenMenus] = useState<string[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [filterTanggal]);

  useEffect(() => {
    const fetchHiddenMenus = async () => {
      if (!user?.email) {
        setMenuLoading(false);
        return;
      }
      try {
        const q = query(collection(db, "karyawan"), where("email", "==", user.email));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setHiddenMenus(data.hiddenMenus || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setMenuLoading(false);
      }
    };
    fetchHiddenMenus();
  }, [user]);

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
        namaProdusen: doc.data().namaProdusen || "",
        unit: doc.data().unit || "ZAK",
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        botolPerDus: doc.data().botolPerDus,
        volumeMl: doc.data().volumeMl,
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
      const keluarData = keluarSnapshot.docs.map((doc) => {
        const d = doc.data();
        const isBackup = d.jenis === "barangKeluarBackup";
        let jumlahZAK = 0;
        let totalKG = 0;
        let unit = "ZAK";
        let kodeBarang = "";
        let namaBarang = "";
        let fot = "";
        if (isBackup && Array.isArray(d.items)) {
          jumlahZAK = d.items.reduce((sum: number, it: any) => sum + (it.pengambilanUnit || 0), 0);
          totalKG = d.totalPengambilanKG || 0;
          unit = d.items[0]?.unit || "ZAK";
          kodeBarang = d.items.map((it: any) => it.kodeBarang).filter(Boolean).join(", ") || "-";
          namaBarang = d.items.map((it: any) => it.namaBarang).filter(Boolean).join(", ") || "-";
        } else {
          jumlahZAK = d.jumlahZAK || 0;
          totalKG = d.totalKG || 0;
          unit = d.unit || "ZAK";
          kodeBarang = d.kodeBarang || "";
          namaBarang = d.namaBarang || "";
          fot = d.fot || "";
        }
        return {
          id: doc.id,
          tanggal: d.tanggal || "",
          kodeBarang,
          namaBarang,
          unit,
          jumlahZAK,
          totalKG,
          fot,
          namaCustomer: d.namaCustomer || (isBackup ? d.driverUnit : "") || "",
          createdBy: d.createdBy || "",
          createdAt: d.createdAt?.toDate(),
        };
      });

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
        totalBarangKeluarKG: totalKeluarKG,
        totalStokAkhirUnit: totalStokUnit,
        totalStokAkhirKG: totalStokKG,
        recentPI: piData,
        lowStock: stockData.filter((s) => {
          if (s.unit === "DUS" || s.unit === "BOTOL") return (s.stokAkhirUnit || 0) < 50;
          return (s.stokAkhirKG || 0) < 1000;
        }).slice(0, 5),
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

  const getUnitBadgeClass = (unit: string) => {
    if (unit === "ZAK") return "bg-blue-100 text-blue-700 border-blue-200";
    if (unit === "DUS") return "bg-purple-100 text-purple-700 border-purple-200";
    if (unit === "BOTOL") return "bg-pink-100 text-pink-700 border-pink-200";
    return "bg-gray-100 text-gray-700 border-gray-200";
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

  const getStockStatus = (stock: StockGudang) => {
    if (stock.unit === "DUS" || stock.unit === "BOTOL") {
      const unitCount = stock.stokAkhirUnit || 0;
      if (unitCount <= 0) return { label: "Habis", color: "bg-red-100 text-red-700 border-red-200" };
      if (unitCount < 50) return { label: "Menipis", color: "bg-orange-100 text-orange-700 border-orange-200" };
      if (unitCount < 200) return { label: "Sedang", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
      return { label: "Aman", color: "bg-green-100 text-green-700 border-green-200" };
    }
    const kg = stock.stokAkhirKG || 0;
    if (kg <= 0) return { label: "Habis", color: "bg-red-100 text-red-700 border-red-200" };
    if (kg < 1000) return { label: "Menipis", color: "bg-orange-100 text-orange-700 border-orange-200" };
    if (kg < 5000) return { label: "Sedang", color: "bg-yellow-100 text-yellow-700 border-yellow-200" };
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

  const isSuperAdmin = user?.role?.trim().toUpperCase() === "SUPER ADMIN";

  const allQuickActions = [
    {
      title: "Input Proforma Invoice",
      desc: "Buat proforma invoice baru",
      href: "/dashboard/input-proforma-invoice",
      color: "from-green-600 to-green-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Rekap PI",
      desc: "Lihat riwayat proforma invoice",
      href: "/dashboard/rekap-proforma-invoice",
      color: "from-emerald-600 to-emerald-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Pembatalan Pemesanan",
      desc: "Batalkan pemesanan yang aktif",
      href: "/dashboard/pembatalan-pemesanan",
      color: "from-red-600 to-red-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Arsip Invoice",
      desc: "Lihat arsip invoice final",
      href: "/dashboard/arsip-invoice",
      color: "from-blue-600 to-blue-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Arsip Invoice Sementara",
      desc: "Lihat arsip invoice sementara",
      href: "/dashboard/arsip-invoice-sementara",
      color: "from-cyan-600 to-cyan-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Input Stock Gudang",
      desc: "Kelola data stock barang",
      href: "/dashboard/laporan-stock-gudang-induk",
      color: "from-amber-600 to-amber-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: "Transaksi Masuk",
      desc: "Input barang masuk ke gudang",
      href: "/dashboard/transaksi-barang-masuk",
      color: "from-blue-600 to-blue-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
        </svg>
      ),
    },
    {
      title: "Transaksi Keluar",
      desc: "Input barang keluar dari gudang",
      href: "/dashboard/transaksi-barang-keluar",
      color: "from-orange-600 to-orange-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7" />
        </svg>
      ),
    },
    {
      title: "Barang Keluar Backup",
      desc: "Backup barang keluar untuk stok gudang induk",
      href: "/dashboard/barang-keluar-backup",
      color: "from-stone-600 to-stone-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
    },
    {
      title: "Input DO",
      desc: "Buat delivery order baru",
      href: "/dashboard/input-do",
      color: "from-indigo-600 to-indigo-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Surat Pengangkutan",
      desc: "Buat surat pengangkutan barang",
      href: "/dashboard/surat-pengangkutan",
      color: "from-teal-600 to-teal-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Riwayat Transaksi",
      desc: "Lihat riwayat barang masuk dan keluar",
      href: "/dashboard/riwayat-transaksi",
      color: "from-purple-600 to-purple-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Add Customer",
      desc: "Tambah data customer baru",
      href: "/dashboard/add-customer",
      color: "from-pink-600 to-pink-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
      ),
    },
    {
      title: "Riwayat Customer",
      desc: "Lihat data customer terdaftar",
      href: "/dashboard/riwayat-customer",
      color: "from-rose-600 to-rose-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      title: "Pengaturan FOT",
      desc: "Atur lokasi gudang FOT",
      href: "/dashboard/fot",
      color: "from-sky-600 to-sky-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      title: "BAPISP Final",
      desc: "Berita Acara Pemeriksaan dan Serah Terima",
      href: "/dashboard/bapisp-final",
      color: "from-lime-600 to-lime-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: "Berita Acara",
      desc: "Kelola berita acara",
      href: "/dashboard/berita-acara",
      color: "from-violet-600 to-violet-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "TTD",
      desc: "Pengaturan tanda tangan digital",
      href: "/dashboard/ttd",
      color: "from-fuchsia-600 to-fuchsia-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    },
    {
      title: "Data Karyawan",
      desc: "Kelola data karyawan dan hak akses",
      href: "/dashboard/data-karyawan",
      color: "from-indigo-600 to-indigo-700",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
    },
  ];

  const visibleQuickActions = allQuickActions.filter((item) => {
    if (isSuperAdmin) return true;
    return !hiddenMenus.includes(item.href);
  });

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
              <p className="text-orange-200 text-xs mt-1">{stats.totalBarangKeluarKG.toLocaleString()} KG total keluar</p>
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
        {menuLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {visibleQuickActions.map((action) => (
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
        )}
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
                      <th className="text-left py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Produsen</th>
                      <th className="text-center py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Unit</th>
                      <th className="text-right py-3 px-2 font-semibold text-gray-600 uppercase text-xs tracking-wider">Konversi</th>
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
                          <td className="py-3 px-2">
                            <span className="text-xs text-gray-600">{stock.namaProdusen || "-"}</span>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <span className={`px-2 py-1 rounded-md text-xs font-bold border ${getUnitBadgeClass(stock.unit)}`}>
                              {stock.unit}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <span className="font-mono text-xs text-gray-500">
                              {stock.unit === "KG" ? "-" : stock.unit === "BOTOL" || stock.unit === "DUS" ? (
                                <div>
                                  <p className="text-pink-600">{stock.botolPerDus || 20} botol/DUS</p>
                                  <p className="text-pink-500">{stock.volumeMl || 500}ml/botol</p>
                                </div>
                              ) : `${stock.bobotPerUnit?.toLocaleString()} KG`}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="font-mono text-xs text-gray-600">
                              {stock.unit !== "KG" && (
                                <span>{formatDusDisplay(stock, stock.stokAwalUnit)}</span>
                              )}
                              {stock.unit !== "DUS" && stock.unit !== "BOTOL" && (
                                <span className="block text-gray-400">{hitungStokAwalKG(stock).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="font-mono text-xs text-green-600">
                              {stock.unit !== "KG" && (
                                <span>+{formatDusDisplay(stock, stock.barangMasukUnit)}</span>
                              )}
                              {stock.unit !== "DUS" && stock.unit !== "BOTOL" && (
                                <span className="block text-green-500">+{stock.barangMasukKG?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="font-mono text-xs text-red-600">
                              {stock.unit !== "KG" && (
                                <span>-{formatDusDisplay(stock, stock.barangKeluarUnit)}</span>
                              )}
                              {stock.unit !== "DUS" && stock.unit !== "BOTOL" && (
                                <span className="block text-red-500">-{stock.barangKeluarKG?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="font-mono font-bold text-gray-800">
                              {stock.unit !== "KG" && (
                                <span className="text-green-700">{formatDusDisplay(stock, stock.stokAkhirUnit)}</span>
                              )}
                              {stock.unit === "KG" && (
                                <span className="text-green-700">{stock.stokAkhirKG?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</span>
                              )}
                              {stock.unit !== "DUS" && stock.unit !== "BOTOL" && (
                                <span className="block text-xs text-green-600">{hitungStokAkhirKG(stock).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</span>
                              )}
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
                {stats.lowStock.map((stock) => {
                  const status = getStockStatus(stock);
                  return (
                    <div
                      key={stock.id}
                      className="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-100"
                    >
                      <div>
                        <p className="font-semibold text-gray-800">{stock.namaBarang}</p>
                        <p className="text-sm text-gray-500">{stock.kodeBarang} | {stock.fot}</p>
                        {stock.namaProdusen && <p className="text-xs text-gray-400">{stock.namaProdusen}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-red-600">
                          {stock.unit === "DUS" || stock.unit === "BOTOL"
                            ? `${stock.stokAkhirUnit?.toLocaleString()} ${stock.unit}`
                            : `${stock.stokAkhirKG?.toLocaleString()} KG`}
                        </p>
                        <p className="text-xs text-red-400">Sisa stock sangat rendah</p>
                      </div>
                    </div>
                  );
                })}
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
                          <span className="text-xs font-mono text-orange-700">
                            {item.unit === "DUS" && item.jumlahZAK
                              ? `-${(item.jumlahZAK / 20).toLocaleString("id-ID", { maximumFractionDigits: 2 })} DUS`
                              : item.unit === "BOTOL"
                              ? `-${item.jumlahZAK.toLocaleString("id-ID")} BOTOL`
                              : `-${item.jumlahZAK} ${item.unit}`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{item.tanggal} {item.fot ? `| ${item.fot}` : ""}</p>
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
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
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