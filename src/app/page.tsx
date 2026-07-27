"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { StockGudang } from "@/app/types";

interface PeriodCalc {
  stokAwalUnit: number; stokAwalKG: number;
  masukUnit: number; masukKG: number;
  penggantianUnit: number; penggantianKG: number;
  keluarUnit: number; keluarKG: number;
  rusakUnit: number; rusakKG: number;
  stokAkhirUnit: number; stokAkhirKG: number;
}

const ParticleBackground = () => {
  const particles = useMemo(() => Array.from({ length: 30 }, (_, i) => ({
    id: i, left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
    size: Math.random() * 3 + 1, duration: Math.random() * 20 + 15,
    delay: Math.random() * 10, opacity: Math.random() * 0.4 + 0.1,
  })), []);
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(16,185,129,0.08)_0%,_transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(5,150,105,0.06)_0%,_transparent_50%)]" />
      {particles.map((p) => (
        <div key={p.id} className="absolute rounded-full bg-emerald-400/20"
          style={{ left: p.left, top: p.top, width: `${p.size}px`, height: `${p.size}px`,
            opacity: p.opacity, animation: `particleFloat ${p.duration}s ease-in-out infinite`,
            animationDelay: `${p.delay}s` }} />
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
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [periodCalcMap, setPeriodCalcMap] = useState<Record<string, PeriodCalc>>({});
  const [isFilterLoading, setIsFilterLoading] = useState(false);

  useEffect(() => { fetchStockData(); }, []);
  useEffect(() => { setCurrentPage(1); }, [selectedFot, selectedBulan, selectedTahun, selectedTanggal, searchTerm, itemsPerPage]);
  useEffect(() => { if (stockData.length > 0) fetchTransaksiFiltered(); }, [selectedTanggal, selectedBulan, selectedTahun, stockData]);

  const fetchStockData = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("kodeBarang", "asc"));
      const snapshot = await getDocs(q);
      const items: StockGudang[] = snapshot.docs.map((doc) => ({
        id: doc.id, ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as StockGudang)).sort((a, b) => {
        const numA = parseInt(a.kodeBarang.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.kodeBarang.replace(/\D/g, "")) || 0;
        return numA - numB;
      });
      setStockData(items);
      const fotSet = new Set<string>();
      items.forEach((item: StockGudang) => {
        if (item.fot && typeof item.fot === "string" && item.fot.trim()) fotSet.add(item.fot.trim().toUpperCase());
      });
      setFotList(Array.from(fotSet).sort());
    } catch (error) { console.error(error); }
    finally { setIsLoadingStock(false); }
  };

  const fetchTransaksiFiltered = async () => {
    setIsFilterLoading(true);
    if (!selectedTanggal && !selectedBulan && !selectedTahun) {
      setPeriodCalcMap({});
      setIsFilterLoading(false);
      return;
    }
    const getPeriodEnd = () => {
      const year = selectedTahun || new Date().getFullYear().toString();
      if (selectedBulan) {
        if (selectedTanggal) return `${year}-${selectedBulan}-${selectedTanggal}`;
        const lastDay = new Date(parseInt(year), parseInt(selectedBulan), 0).getDate();
        return `${year}-${selectedBulan}-${lastDay.toString().padStart(2, "0")}`;
      }
      if (selectedTahun) return `${year}-12-31`;
      return "9999-12-31";
    };
    const periodEnd = getPeriodEnd();

    const masukIn: Record<string, { unit: number; kg: number }> = {};
    const masukAfter: Record<string, { unit: number; kg: number }> = {};
    const penggantianIn: Record<string, { unit: number; kg: number }> = {};
    const penggantianAfter: Record<string, { unit: number; kg: number }> = {};
    const keluarIn: Record<string, { unit: number; kg: number }> = {};
    const keluarAfter: Record<string, { unit: number; kg: number }> = {};
    const rusakIn: Record<string, { unit: number; kg: number }> = {};
    const rusakAfter: Record<string, { unit: number; kg: number }> = {};

    const addToMap = (map: Record<string, { unit: number; kg: number }>, key: string, unit: number, kg: number, itemUnit: string) => {
      if (!key.includes("|") || key.endsWith("|")) return;
      if (!map[key]) map[key] = { unit: 0, kg: 0 };
      if (itemUnit === "DUS" || itemUnit === "BOTOL") map[key].unit += unit;
      else if (itemUnit === "KG") map[key].kg += kg;
      else { map[key].unit += unit; map[key].kg += kg; }
    };

    const isInPeriod = (tanggal: string) => {
      if (!tanggal || tanggal.length !== 10) return false;
      if (selectedTanggal) return tanggal === periodEnd;
      if (selectedBulan) return tanggal.substring(0, 7) === periodEnd.substring(0, 7);
      if (selectedTahun) return tanggal.substring(0, 4) === periodEnd.substring(0, 4);
      return false;
    };

    const isAfterPeriod = (tanggal: string) => {
      if (!tanggal || tanggal.length !== 10) return false;
      if (selectedTanggal) return tanggal > periodEnd;
      if (selectedBulan) return tanggal.substring(0, 7) > periodEnd.substring(0, 7);
      if (selectedTahun) return tanggal.substring(0, 4) > periodEnd.substring(0, 4);
      return false;
    };

    const getKodeFromStockId = (stockId: string): { kode: string; fot: string } => {
      const found = stockData.find((s) => s.id === stockId);
      return found ? { kode: found.kodeBarang, fot: found.fot } : { kode: "", fot: "" };
    };

    const getFotFromKode = (kode: string): string => {
      const found = stockData.find((s) => s.kodeBarang === kode);
      return found ? found.fot : "";
    };

    const getKodeFromNama = (nama: string): string => {
      const namaUpper = nama.trim().toUpperCase();
      const found = stockData.find((s) => s.namaBarang.trim().toUpperCase() === namaUpper);
      return found ? found.kodeBarang : "";
    };

    try {
      const masukSnap = await getDocs(query(collection(db, "transaksiBarangMasuk"), orderBy("tanggal", "desc")));
      masukSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const tanggal = d.tanggal || "";
        const kode = (d.kodeBarang || "").trim().toUpperCase();
        const fot = (d.fot || "").trim().toUpperCase();
        const unit = d.unit || "ZAK";
        const jumlahZAK = d.jumlahZAK || 0;
        const totalKG = d.totalKG || 0;
        const key = `${kode}|${fot}`;
        if (d.isPenggantianRusak) {
          if (isInPeriod(tanggal)) addToMap(penggantianIn, key, jumlahZAK, totalKG, unit);
          else if (isAfterPeriod(tanggal)) addToMap(penggantianAfter, key, jumlahZAK, totalKG, unit);
        } else {
          if (isInPeriod(tanggal)) addToMap(masukIn, key, jumlahZAK, totalKG, unit);
          else if (isAfterPeriod(tanggal)) addToMap(masukAfter, key, jumlahZAK, totalKG, unit);
        }
        if (d.adaBarangRusak && Array.isArray(d.barangRusak)) {
          d.barangRusak.forEach((r: any) => {
            const rusakUnit = r.unit || unit;
            const rusakJumlah = r.jumlah || 0;
            if (isInPeriod(tanggal)) addToMap(rusakIn, key, rusakJumlah, rusakUnit === "KG" ? rusakJumlah : 0, rusakUnit);
            else if (isAfterPeriod(tanggal)) addToMap(rusakAfter, key, rusakJumlah, rusakUnit === "KG" ? rusakJumlah : 0, rusakUnit);
          });
        }
      });

      const keluarSnap = await getDocs(query(collection(db, "transaksiBarangKeluar"), orderBy("tanggal", "desc")));
      keluarSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const tanggal = d.tanggal || "";
        const jenis = d.jenis || "barangKeluar";
        const items = d.items || [];
        if (items.length > 0) {
          items.forEach((item: any) => {
            let kode = "";
            let fot = "";
            if (item.stockId) {
              const stockInfo = getKodeFromStockId(item.stockId);
              kode = stockInfo.kode;
              fot = stockInfo.fot;
            }
            if (!kode) kode = (item.kodeBarang || "").trim().toUpperCase();
            const namaBarang = (item.namaBarang || "").trim().toUpperCase();
            if (!kode && namaBarang) kode = getKodeFromNama(namaBarang);
            if (!fot) fot = (item.fot || d.fot || "").trim().toUpperCase();
            if (!fot && kode) fot = getFotFromKode(kode);
            const unit = item.unit || "ZAK";
            const pengambilan = item.pengambilanUnit || item.jumlahZAK || item.jumlah || 0;
            const bobot = item.bobotPerUnit || d.bobotPerUnit || 50;
            const totalKG = item.totalKG || (pengambilan * bobot);
            const key = `${kode}|${fot}`;
            if (isInPeriod(tanggal)) addToMap(keluarIn, key, pengambilan, totalKG, unit);
            else if (isAfterPeriod(tanggal)) addToMap(keluarAfter, key, pengambilan, totalKG, unit);
          });
        } else if (d.kodeBarang || d.namaBarang || d.stockId) {
          let kode = "";
          let fot = "";
          if (d.stockId) {
            const stockInfo = getKodeFromStockId(d.stockId);
            kode = stockInfo.kode;
            fot = stockInfo.fot;
          }
          if (!kode) kode = (d.kodeBarang || "").trim().toUpperCase();
          const namaBarang = (d.namaBarang || "").trim().toUpperCase();
          if (!kode && namaBarang) kode = getKodeFromNama(namaBarang);
          if (!fot) fot = (d.fot || "").trim().toUpperCase();
          if (!fot && kode) fot = getFotFromKode(kode);
          const unit = d.unit || "ZAK";
          const pengambilan = d.jumlahZAK || d.pengambilanUnit || d.jumlah || 0;
          const bobot = d.bobotPerUnit || 50;
          const totalKG = d.totalKG || (pengambilan * bobot);
          const key = `${kode}|${fot}`;
          if (isInPeriod(tanggal)) addToMap(keluarIn, key, pengambilan, totalKG, unit);
          else if (isAfterPeriod(tanggal)) addToMap(keluarAfter, key, pengambilan, totalKG, unit);
        }
      });

      const periodCalc: Record<string, PeriodCalc> = {};
      stockData.forEach((stock) => {
        const key = `${stock.kodeBarang}|${stock.fot}`;
        const mIn = masukIn[key] || { unit: 0, kg: 0 };
        const mAfter = masukAfter[key] || { unit: 0, kg: 0 };
        const pIn = penggantianIn[key] || { unit: 0, kg: 0 };
        const pAfter = penggantianAfter[key] || { unit: 0, kg: 0 };
        const kIn = keluarIn[key] || { unit: 0, kg: 0 };
        const kAfter = keluarAfter[key] || { unit: 0, kg: 0 };
        const rIn = rusakIn[key] || { unit: 0, kg: 0 };
        const rAfter = rusakAfter[key] || { unit: 0, kg: 0 };
        const realStokAkhirUnit = stock.stokAkhirUnit || 0;
        const realStokAkhirKG = stock.stokAkhirKG || 0;
        const stokAkhirUnit = Math.max(0, realStokAkhirUnit - mAfter.unit - pAfter.unit + kAfter.unit + rAfter.unit);
        const stokAwalUnit = Math.max(0, stokAkhirUnit + mIn.unit + pIn.unit - kIn.unit - rIn.unit);
        let stokAkhirKG = 0;
        let stokAwalKG = 0;
        if (stock.unit === "ZAK") {
          stokAkhirKG = stokAkhirUnit * (stock.bobotPerUnit || 50);
          stokAwalKG = stokAwalUnit * (stock.bobotPerUnit || 50);
        } else if (stock.unit === "KG") {
          stokAkhirKG = Math.max(0, realStokAkhirKG - mAfter.kg - pAfter.kg + kAfter.kg + rAfter.kg);
          stokAwalKG = Math.max(0, stokAkhirKG + mIn.kg + pIn.kg - kIn.kg - rIn.kg);
        }
        periodCalc[key] = {
          stokAwalUnit, stokAwalKG,
          masukUnit: mIn.unit, masukKG: mIn.kg,
          penggantianUnit: pIn.unit, penggantianKG: pIn.kg,
          keluarUnit: kIn.unit, keluarKG: kIn.kg,
          rusakUnit: rIn.unit, rusakKG: rIn.kg,
          stokAkhirUnit, stokAkhirKG,
        };
      });
      setPeriodCalcMap(periodCalc);
    } catch (error) { console.error(error); }
    finally { setIsFilterLoading(false); }
  };

  const filteredStockData = stockData.filter((item: StockGudang) => {
    const matchSearch = item.kodeBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.unit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.namaProdusen || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchFot = selectedFot ? item.fot === selectedFot : true;
    return matchSearch && matchFot;
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
    if (endPage - startPage < maxVisible - 1) startPage = Math.max(1, endPage - maxVisible + 1);
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    return pages;
  }, [currentPage, totalPages]);

  const bulanOptions = [
    { value: "", label: "Semua Bulan" },
    { value: "01", label: "Januari" }, { value: "02", label: "Februari" },
    { value: "03", label: "Maret" }, { value: "04", label: "April" },
    { value: "05", label: "Mei" }, { value: "06", label: "Juni" },
    { value: "07", label: "Juli" }, { value: "08", label: "Agustus" },
    { value: "09", label: "September" }, { value: "10", label: "Oktober" },
    { value: "11", label: "November" }, { value: "12", label: "Desember" },
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
    if (row.unit === "BOTOL") return `${(unitField || 0).toLocaleString("id-ID", { maximumFractionDigits: 10 })} botol`;
    return `${(unitField || 0).toLocaleString("id-ID", { maximumFractionDigits: 10 })} ${row.unit}`;
  };

  const hitungStokAwalKG = (row: StockGudang) => {
    if (row.unit === "ZAK") return (row.stokAwalUnit || 0) * (row.bobotPerUnit || 50);
    if (row.unit === "DUS" || row.unit === "BOTOL") return 0;
    return row.stokAwalKG || 0;
  };

  const hitungStokAkhirKG = (row: StockGudang) => {
    if (row.unit === "ZAK") return (row.stokAkhirUnit || 0) * (row.bobotPerUnit || 50);
    if (row.unit === "DUS" || row.unit === "BOTOL") return 0;
    return row.stokAkhirKG || 0;
  };

  const getRowValues = (row: StockGudang) => {
    const hasFilter = !!(selectedTanggal || selectedBulan || selectedTahun);
    const key = `${row.kodeBarang}|${row.fot}`;
    const periodData = hasFilter ? periodCalcMap[key] : null;
    if (hasFilter && periodData) {
      return {
        stokAwalUnit: periodData.stokAwalUnit, stokAwalKG: periodData.stokAwalKG,
        masukUnit: periodData.masukUnit, masukKG: periodData.masukKG,
        penggantianUnit: periodData.penggantianUnit, penggantianKG: periodData.penggantianKG,
        keluarUnit: periodData.keluarUnit, keluarKG: periodData.keluarKG,
        rusakUnit: periodData.rusakUnit, rusakKG: periodData.rusakKG,
        stokAkhirUnit: periodData.stokAkhirUnit, stokAkhirKG: periodData.stokAkhirKG,
      };
    }
    return {
      stokAwalUnit: row.stokAwalUnit || 0, stokAwalKG: hitungStokAwalKG(row),
      masukUnit: row.barangMasukUnit || 0, masukKG: row.barangMasukKG || 0,
      penggantianUnit: 0, penggantianKG: 0,
      keluarUnit: row.barangKeluarUnit || 0, keluarKG: row.barangKeluarKG || 0,
      rusakUnit: row.barangRusakUnit || 0, rusakKG: row.barangRusakKG || 0,
      stokAkhirUnit: row.stokAkhirUnit || 0, stokAkhirKG: hitungStokAkhirKG(row),
    };
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
    return filteredStockData.filter((d: StockGudang) => {
      if (unitType === "BOTOL") return d.unit === "BOTOL" || d.unit === "DUS";
      return d.unit === unitType;
    }).reduce((sum: number, d: StockGudang) => {
      if (unitType === "BOTOL") {
        if (d.unit === "DUS") return sum + ((d.stokAkhirUnit || 0) * (d.botolPerDus || 20));
        return sum + (d.stokAkhirUnit || 0);
      }
      return sum + (d.stokAkhirUnit || 0);
    }, 0);
  };

  const goToPage = (page: number) => { if (page >= 1 && page <= totalPages) setCurrentPage(page); };

  const statCards = [
    { label: "Total Jenis", value: filteredStockData.length, color: "emerald", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Total ZAK", value: getTotalUnit("ZAK"), color: "blue", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Total DUS", value: getTotalUnit("DUS"), color: "purple", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Total BOTOL", value: getTotalUnit("BOTOL"), color: "pink", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
    { label: "Stock Menipis", value: filteredStockData.filter((d: StockGudang) => {
      if (d.unit === "DUS" || d.unit === "BOTOL") {
        const botolCount = d.unit === "DUS" ? (d.stokAkhirUnit || 0) * (d.botolPerDus || 20) : (d.stokAkhirUnit || 0);
        return botolCount < 50;
      }
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
                <div className="w-16 h-16">
                  <img src="/LogoAGRO.png" alt="Logo" className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 0 16px rgba(16,185,129,0.5))" }} />
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
            <div className="relative mb-8">
              <div className="relative w-52 h-52 mx-auto">
                <img src="/LogoAGRO.png" alt="Logo PT Bukit Agrochemical Baru" className="w-full h-full object-contain" style={{ filter: "drop-shadow(0 0 40px rgba(16,185,129,0.35))" }} />
              </div>
            </div>
            <h2 className="text-3xl sm:text-5xl font-bold text-white mb-3 tracking-tight">PT Bukit Agrochemical Baru</h2>
            <p className="text-lg text-emerald-400 mb-2 font-medium">Sistem Administrasi Distributor Pupuk</p>
            <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">Platform digital untuk monitoring stock gudang secara real-time.</p>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Filter FOT</label>
                  <select id="filter-fot" name="filterFot" aria-label="Filter FOT" value={selectedFot} onChange={(e) => setSelectedFot(e.target.value)} className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm">
                    {fotOptions.map((opt) => <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Tanggal</label>
                  <select id="filter-tanggal" name="filterTanggal" aria-label="Filter Tanggal" value={selectedTanggal} onChange={(e) => setSelectedTanggal(e.target.value)} className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm">
                    <option value="" className="bg-slate-800">Tanggal</option>
                    {Array.from({ length: 31 }, (_, i) => { const d = (i + 1).toString().padStart(2, "0"); return <option key={d} value={d} className="bg-slate-800">{d}</option>; })}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Bulan</label>
                  <select id="filter-bulan" name="filterBulan" aria-label="Filter Bulan" value={selectedBulan} onChange={(e) => setSelectedBulan(e.target.value)} className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm">
                    {bulanOptions.map((opt) => <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-300">Tahun</label>
                  <select id="filter-tahun" name="filterTahun" aria-label="Filter Tahun" value={selectedTahun} onChange={(e) => setSelectedTahun(e.target.value)} className="w-full px-4 py-3 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm">
                    {tahunOptions.map((opt) => <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 flex items-end">
                  <button onClick={() => { setSelectedTanggal(""); setSelectedBulan(""); setSelectedTahun(""); }} className="w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 rounded-xl transition-colors font-medium border border-red-500/20">Reset Tanggal</button>
                </div>
              </div>

              <div className="relative w-full sm:w-96 mb-8">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input type="text" placeholder="Cari kode, nama barang, atau unit..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-12 pr-4 py-3.5 glass-input rounded-xl focus:outline-none transition-all duration-300 text-sm" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {statCards.map((card, idx) => {
                  const c = colorMap[card.color];
                  const isActive = activeGlowCard === idx;
                  return (
                    <div key={card.label} className={`p-5 rounded-2xl border ${c.border} bg-slate-800/50 hover:bg-slate-800/80 transition-all duration-500 animate-count-up animate-delay-${(idx + 1) * 100} stat-card-glow ${isActive ? "active" : ""} cursor-pointer`} onClick={() => setActiveGlowCard(isActive ? null : idx)} onMouseEnter={() => setActiveGlowCard(idx)} onMouseLeave={() => setActiveGlowCard(null)}>
                      <div className="flex items-center justify-between mb-3">
                        <p className={`text-xs uppercase tracking-wider font-bold ${c.text}`}>{card.label}</p>
                        <svg className={`w-4 h-4 ${c.text} opacity-50`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
                        </svg>
                      </div>
                      <p className={`text-3xl font-bold ${c.text} tracking-tight transition-all duration-300 ${isActive ? "scale-110" : ""}`}>{typeof card.value === "number" ? card.value.toLocaleString() : card.value}</p>
                      {isActive && <div className="mt-3 h-0.5 w-full rounded-full shimmer-bg" />}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="text-sm text-slate-400 font-medium flex flex-wrap items-center gap-2">
                  <span>Menampilkan {filteredStockData.length} dari {stockData.length} data</span>
                  {selectedFot && <span className="px-2 py-0.5 bg-slate-700/50 rounded-md text-xs text-slate-300">FOT: {selectedFot}</span>}
                  {(selectedTanggal || selectedBulan || selectedTahun) && (
                    <span className="px-2 py-0.5 bg-emerald-500/10 rounded-md text-xs text-emerald-400 border border-emerald-500/20">
                      {selectedTanggal && `${selectedTanggal} `}{selectedBulan && `${bulanOptions.find((b) => b.value === selectedBulan)?.label} `}{selectedTahun && selectedTahun}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-400 font-medium">Tampilkan:</span>
                  <select value={itemsPerPage.toString()} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="w-36 text-sm glass-input rounded-lg px-3 py-2 focus:outline-none">
                    {itemsPerPageOptions.map((opt) => <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>)}
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
                      <div className="col-span-2 text-center">Foto</div>
                      <div className="col-span-2">Kode / Nama</div>
                      <div className="col-span-1 text-center">Unit</div>
                      <div className="col-span-1 text-right">Konversi</div>
                      <div className="col-span-1 text-right">Stok Awal</div>
                      <div className="col-span-1 text-right">Masuk</div>
                      <div className="col-span-1 text-right">Keluar</div>
                      <div className="col-span-1 text-right">Stok Akhir</div>
                      <div className="col-span-1 text-center">Status</div>
                    </div>

                    <div className="space-y-2">
                      {paginatedData.map((row: StockGudang, index: number) => {
                        const status = getStockStatus(row);
                        const isRowActive = hoveredRow === row.id;
                        return (
                          <div key={row.id} className={`group bg-slate-800/40 rounded-2xl border border-slate-700/50 hover:border-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500 animate-fade-in-up overflow-hidden row-interactive ${isRowActive ? "active" : ""} cursor-pointer`} style={{ animationDelay: `${index * 0.05}s` }} onClick={() => setHoveredRow(isRowActive ? null : row.id)} onMouseEnter={() => setHoveredRow(row.id)} onMouseLeave={() => setHoveredRow(null)}>
                            <div className="lg:hidden p-5 space-y-4">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg text-sm border border-emerald-500/20">{row.fot || "-"}</span>
                                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getUnitBadgeClass(row.unit)}`}>{row.unit}</span>
                                  </div>
                                  {(row.fotoUrls as string[])?.length > 0 && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedPhoto((row.fotoUrls as string[])[0]); }}
                                      className="relative w-32 h-32 rounded-2xl overflow-hidden border-2 border-slate-500 hover:border-emerald-400 transition-all duration-300 mt-3 shadow-xl hover:shadow-emerald-500/20 hover:scale-105"
                                    >
                                      <img
                                        src={(row.fotoUrls as string[])[0]}
                                        alt={row.namaBarang}
                                        className="w-full h-full object-cover"
                                      />
                                      {(row.fotoUrls as string[]).length > 1 && (
                                        <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                          {(row.fotoUrls as string[]).length}
                                        </span>
                                      )}
                                    </button>
                                  )}
                                  <p className="font-mono text-sm font-semibold text-emerald-300">{row.kodeBarang}</p>
                                  <p className="text-sm font-medium text-slate-200">{row.namaBarang}</p>
                                  {row.namaProdusen && <p className="text-xs text-slate-500">{row.namaProdusen}</p>}
                                </div>
                                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${status.color}`}><span className={`w-2 h-2 rounded-full ${status.dot}`}></span>{status.label}</div>
                              </div>

                              {(() => {
                                const vals = getRowValues(row);
                                return (
                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                                      <p className="text-xs text-slate-500 mb-1">Stok Awal</p>
                                      {row.unit !== "KG" && <p className="font-mono font-semibold text-slate-200">{formatDusDisplay(row, vals.stokAwalUnit)}</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && <p className="text-slate-500 text-xs">{vals.stokAwalKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                    </div>
                                    <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700/50">
                                      <p className="text-xs text-slate-500 mb-1">Stok Akhir</p>
                                      {row.unit !== "KG" && <p className="font-mono font-bold text-emerald-400">{formatDusDisplay(row, vals.stokAkhirUnit)}</p>}
                                      {row.unit === "KG" && <p className="font-mono font-bold text-emerald-400">{vals.stokAkhirKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && <p className="text-slate-500 text-xs">{vals.stokAkhirKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                    </div>
                                    <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                                      <p className="text-xs text-emerald-400 mb-1">Masuk</p>
                                      {row.unit !== "KG" && vals.masukUnit > 0 && <p className="font-mono text-emerald-300 font-semibold">+{formatDusDisplay(row, vals.masukUnit)}</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && vals.masukKG > 0 && <p className="text-emerald-500 text-xs">+{vals.masukKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                      {vals.masukUnit === 0 && vals.masukKG === 0 && <p className="text-slate-600 text-xs">-</p>}
                                    </div>
                                    <div className="bg-red-500/5 rounded-xl p-3 border border-red-500/10">
                                      <p className="text-xs text-red-400 mb-1">Keluar</p>
                                      {row.unit !== "KG" && vals.keluarUnit > 0 && <p className="font-mono text-red-300 font-semibold">-{formatDusDisplay(row, vals.keluarUnit)}</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && vals.keluarKG > 0 && <p className="text-red-500 text-xs">-{vals.keluarKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                      {vals.keluarUnit === 0 && vals.keluarKG === 0 && <p className="text-slate-600 text-xs">-</p>}
                                    </div>
                                  </div>
                                );
                              })()}

                              {row.unit !== "KG" && (
                                <div className="text-xs text-slate-500">
                                  {row.unit === "BOTOL" || row.unit === "DUS" ? <span>{row.botolPerDus || 20} botol/DUS | {row.volumeMl || 500}ml/botol</span> : <span>Bobot: {row.bobotPerUnit?.toLocaleString()} KG / {row.unit}</span>}
                                </div>
                              )}
                            </div>

                            <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-4 items-center group-hover:bg-emerald-500/5 transition-colors duration-500">
                              <div className="col-span-1"><span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-lg text-sm inline-block border border-emerald-500/20">{row.fot || "-"}</span></div>
                              <div className="col-span-2 text-center">
                                {(row.fotoUrls as string[])?.length > 0 ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setSelectedPhoto((row.fotoUrls as string[])[0]); }}
                                    className="relative w-20 h-20 rounded-xl overflow-hidden border-2 border-slate-500 hover:border-emerald-400 transition-all duration-300 inline-block shadow-xl hover:shadow-emerald-500/20 hover:scale-105"
                                  >
                                    <img
                                      src={(row.fotoUrls as string[])[0]}
                                      alt={row.namaBarang}
                                      className="w-full h-full object-cover"
                                    />
                                    {(row.fotoUrls as string[]).length > 1 && (
                                      <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                                        {(row.fotoUrls as string[]).length}
                                      </span>
                                    )}
                                  </button>
                                ) : (
                                  <span className="text-xs text-slate-600">-</span>
                                )}
                              </div>
                              <div className="col-span-2">
                                <p className="font-mono text-sm font-semibold text-emerald-300">{row.kodeBarang}</p>
                                <p className="text-sm text-slate-300 mt-0.5 line-clamp-1">{row.namaBarang}</p>
                                {row.namaProdusen && <p className="text-xs text-slate-500 mt-0.5">{row.namaProdusen}</p>}
                              </div>
                              <div className="col-span-1 text-center"><span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${getUnitBadgeClass(row.unit)}`}>{row.unit}</span></div>
                              <div className="col-span-1 text-right">
                                <span className="font-mono text-sm text-slate-400">
                                  {row.unit === "KG" ? "-" : row.unit === "BOTOL" || row.unit === "DUS" ? <div className="text-xs"><p className="text-pink-400">{row.botolPerDus || 20} botol/DUS</p><p className="text-pink-300">{row.volumeMl || 500}ml/botol</p></div> : `${row.bobotPerUnit?.toLocaleString()} KG`}
                                </span>
                              </div>
                              {(() => {
                                const vals = getRowValues(row);
                                return (
                                  <>
                                    <div className="col-span-1 text-right">
                                      {row.unit !== "KG" && <p className="font-mono text-sm font-medium text-slate-200">{formatDusDisplay(row, vals.stokAwalUnit)}</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && <p className="text-slate-500 text-xs">{vals.stokAwalKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                    </div>
                                    <div className="col-span-1 text-right">
                                      {row.unit !== "KG" && vals.masukUnit > 0 && <p className="text-emerald-400 font-mono text-sm font-medium">+{formatDusDisplay(row, vals.masukUnit)}</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && vals.masukKG > 0 && <p className="text-emerald-500 text-xs">+{vals.masukKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                      {vals.masukUnit === 0 && vals.masukKG === 0 && <p className="text-slate-600 text-xs">-</p>}
                                    </div>
                                    <div className="col-span-1 text-right">
                                      {row.unit !== "KG" && vals.keluarUnit > 0 && <p className="text-red-400 font-mono text-sm font-medium">-{formatDusDisplay(row, vals.keluarUnit)}</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && vals.keluarKG > 0 && <p className="text-red-500 text-xs">-{vals.keluarKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                      {vals.keluarUnit === 0 && vals.keluarKG === 0 && <p className="text-slate-600 text-xs">-</p>}
                                    </div>
                                    <div className="col-span-1 text-right">
                                      {row.unit !== "KG" && <p className="font-mono font-bold text-emerald-400 text-sm">{formatDusDisplay(row, vals.stokAkhirUnit)}</p>}
                                      {row.unit === "KG" && <p className="font-mono font-bold text-emerald-400 text-sm">{vals.stokAkhirKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                      {row.unit !== "DUS" && row.unit !== "BOTOL" && <p className="text-slate-500 text-xs">{vals.stokAkhirKG.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>}
                                    </div>
                                  </>
                                );
                              })()}
                              <div className="col-span-1 text-center">
                                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${status.color}`}><span className={`w-2 h-2 rounded-full ${status.dot}`}></span>{status.label}</div>
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
                  <div className="text-sm text-slate-400 font-medium">Menampilkan {startIndex + 1} - {Math.min(endIndex, filteredStockData.length)} dari {filteredStockData.length} item</div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow">Awal</button>
                    <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <div className="flex items-center gap-1">
                      {pageNumbers.map((page: number) => (
                        <button key={page} onClick={() => goToPage(page)} className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300 btn-glow ${currentPage === page ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-110" : "text-slate-300 hover:bg-slate-700/50"}`}>{page}</button>
                      ))}
                    </div>
                    <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="px-3.5 py-2 rounded-xl border border-slate-700/50 text-sm font-semibold text-slate-400 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 btn-glow">Akhir</button>
                  </div>
                </div>
              )}
            </Card>
          </section>

          {selectedPhoto && (
            <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-6" onClick={() => setSelectedPhoto(null)}>
              <div className="relative max-w-5xl max-h-[95vh] w-full flex flex-col items-center">
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <img
                  src={selectedPhoto}
                  alt="Foto Produk"
                  className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          <footer className="text-center py-8 border-t border-slate-700/30 animate-fade-in-up animate-delay-300">
            <p className="text-sm text-slate-400 font-medium">PT Bukit Agrochemical Baru | Sistem Administrasi Distributor Pupuk</p>
            <p className="text-xs text-slate-500 mt-1">Untuk mengelola data, silakan login sebagai admin</p>
          </footer>
        </main>
      </div>
    </>
  );
}