"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Button from "@/app/components/ui/Button";
import Table from "@/app/components/ui/Table";
import Card from "@/app/components/ui/Card";
import Select from "@/app/components/ui/Select";
import { StockGudang } from "@/app/types";

export default function PublicPage() {
  const router = useRouter();
  const [data, setData] = useState<StockGudang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFot, setSelectedFot] = useState("");
  const [selectedBulan, setSelectedBulan] = useState("");
  const [selectedTahun, setSelectedTahun] = useState("");
  const [fotList, setFotList] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
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
      width: "160px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {(row.unit === "ZAK" || row.unit === "DUS") && (
            <p className="font-mono">{row.stokAwalUnit?.toLocaleString()} {row.unit}</p>
          )}
          {row.unit === "BOTOL" && (
            <p className="font-mono">{row.stokAwalBotol?.toLocaleString()} BOTOL</p>
          )}
          <p className="text-gray-500 text-xs">{row.stokAwalKG.toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "masuk",
      header: "Masuk",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          <span className="text-green-600 font-mono">+{row.barangMasukKG.toLocaleString()} KG</span>
          {row.unit === "BOTOL" && (
            <p className="text-green-500 font-mono text-xs">+{row.barangMasukBotol?.toLocaleString()} BOTOL</p>
          )}
        </div>
      ),
    },
    {
      key: "keluar",
      header: "Keluar",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          <span className="text-red-600 font-mono">-{row.barangKeluarKG.toLocaleString()} KG</span>
          {row.unit === "BOTOL" && (
            <p className="text-red-500 font-mono text-xs">-{row.barangKeluarBotol?.toLocaleString()} BOTOL</p>
          )}
        </div>
      ),
    },
    {
      key: "stokAkhir",
      header: "Stok Akhir",
      width: "160px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {(row.unit === "ZAK" || row.unit === "DUS") && (
            <p className="font-mono font-bold text-green-700">{row.stokAkhirUnit?.toLocaleString()} {row.unit}</p>
          )}
          {row.unit === "BOTOL" && (
            <p className="font-mono font-bold text-pink-700">{row.stokAkhirBotol?.toLocaleString()} BOTOL</p>
          )}
          {row.unit === "KG" && (
            <p className="font-mono font-bold text-green-700">{row.stokAkhirKG.toLocaleString()} KG</p>
          )}
          <p className="text-gray-500 text-xs">{row.stokAkhirKG.toLocaleString()} KG</p>
        </div>
      ),
    },
  ];

  const getTotalUnit = (unitType: string) => {
    return filteredData
      .filter((d) => d.unit === unitType)
      .reduce((sum, d) => sum + (d.stokAkhirUnit || 0), 0);
  };

  const getTotalBotol = () => {
    return filteredData
      .filter((d) => d.unit === "BOTOL")
      .reduce((sum, d) => sum + (d.stokAkhirBotol || 0), 0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-green-100 to-amber-50">
      <nav className="bg-white/80 backdrop-blur-xl border-b border-green-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-600 to-green-800 rounded-lg flex items-center justify-center shadow-lg">
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
        <section className="text-center py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-600 to-green-800 rounded-2xl shadow-xl mb-6">
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

        <section>
          <Card>
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
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Total Jenis</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{filteredData.length}</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total ZAK</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{getTotalUnit("ZAK").toLocaleString()}</p>
              </div>
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
                <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Total DUS</p>
                <p className="text-2xl font-bold text-purple-700 mt-1">{getTotalUnit("DUS").toLocaleString()}</p>
              </div>
              <div className="p-4 bg-pink-50 rounded-xl border border-pink-100">
                <p className="text-xs text-pink-600 uppercase tracking-wide font-semibold">Total BOTOL</p>
                <p className="text-2xl font-bold text-pink-700 mt-1">{getTotalBotol().toLocaleString()}</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Stock Menipis</p>
                <p className="text-2xl font-bold text-red-700 mt-1">{filteredData.filter((d) => d.stokAkhirKG < 1000).length}</p>
              </div>
            </div>

            <div className="text-sm text-gray-500 mb-4">
              Menampilkan {filteredData.length} dari {data.length} data
              {selectedFot && ` | FOT: ${selectedFot}`}
              {selectedBulan && ` | Bulan: ${bulanOptions.find((b) => b.value === selectedBulan)?.label}`}
              {selectedTahun && ` | Tahun: ${selectedTahun}`}
            </div>

            <Table
              columns={columns}
              data={filteredData}
              isLoading={isLoading}
              emptyMessage="Belum ada data stock gudang"
              keyExtractor={(row) => row.id}
            />
          </Card>
        </section>

        <footer className="text-center py-8 border-t border-green-200">
          <p className="text-sm text-gray-500">
            PT Bukit Agrochemical | Sistem Administrasi Distributor Pupuk
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Untuk mengelola data, silakan login sebagai admin
          </p>
        </footer>
      </main>
    </div>
  );
}