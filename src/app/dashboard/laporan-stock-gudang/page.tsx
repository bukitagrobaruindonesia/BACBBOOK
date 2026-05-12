"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Table from "@/app/components/ui/Table";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Card from "@/app/components/ui/Card";
import { exportToExcel } from "@/app/utils/exportExcel";
import { StockGudang } from "@/app/types";

export default function LaporanStockGudangPage() {
  const { user } = useAuth();
  const [data, setData] = useState<StockGudang[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<StockGudang | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fotList, setFotList] = useState<string[]>([]);
  const [selectedFot, setSelectedFot] = useState("");
  const [selectedBulan, setSelectedBulan] = useState("");
  const [selectedTahun, setSelectedTahun] = useState("");

  const [editForm, setEditForm] = useState({
    fot: "",
    kodeBarang: "",
    namaBarang: "",
    unit: "ZAK" as "ZAK" | "DUS",
    stokAwalZAK: "",
    stokAwalKG: "",
    barangMasukKG: "",
    barangKeluarKG: "",
  });

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
      const date = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt);
      const matchBulan = selectedBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === selectedBulan : true;
      const matchTahun = selectedTahun ? date.getFullYear().toString() === selectedTahun : true;
      return matchBulan && matchTahun;
    })();

    return matchSearch && matchFot && matchBulanTahun;
  });

  const calculateStock = (
    stokAwalKG: number,
    barangMasukKG: number,
    barangKeluarKG: number,
    unit: string
  ) => {
    const stokAkhirKG = stokAwalKG + barangMasukKG - barangKeluarKG;
    const stokBarangZAK = unit === "ZAK" ? Math.floor(stokAkhirKG / 50) : Math.floor(stokAkhirKG / 25);
    return { stokAkhirKG, stokBarangZAK };
  };

  const handleEdit = (item: StockGudang) => {
    setSelectedItem(item);
    setEditForm({
      fot: item.fot || "",
      kodeBarang: item.kodeBarang,
      namaBarang: item.namaBarang,
      unit: item.unit,
      stokAwalZAK: item.stokAwalZAK.toString(),
      stokAwalKG: item.stokAwalKG.toString(),
      barangMasukKG: item.barangMasukKG.toString(),
      barangKeluarKG: item.barangKeluarKG.toString(),
    });
    setIsEditModalOpen(true);
  };

  const handleDetail = (item: StockGudang) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const stokAwalKG = parseFloat(editForm.stokAwalKG);
      const barangMasuk = parseFloat(editForm.barangMasukKG);
      const barangKeluar = parseFloat(editForm.barangKeluarKG);
      const { stokAkhirKG, stokBarangZAK } = calculateStock(stokAwalKG, barangMasuk, barangKeluar, editForm.unit);

      await updateDoc(doc(db, "stockGudang", selectedItem.id), {
        fot: editForm.fot.trim().toUpperCase(),
        kodeBarang: editForm.kodeBarang.trim().toUpperCase(),
        namaBarang: editForm.namaBarang.trim(),
        unit: editForm.unit,
        stokAwalZAK: parseFloat(editForm.stokAwalZAK),
        stokAwalKG: stokAwalKG,
        barangMasukKG: barangMasuk,
        barangKeluarKG: barangKeluar,
        stokAkhirKG: stokAkhirKG,
        stokBarangZAK: stokBarangZAK,
        updatedAt: serverTimestamp(),
      });

      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data stock ini?")) return;
    try {
      await deleteDoc(doc(db, "stockGudang", id));
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((item) => ({
      "FOT": item.fot || "-",
      "Kode Barang": item.kodeBarang,
      "Nama Barang": item.namaBarang,
      "Unit": item.unit,
      "Stok Awal (ZAK/DUS)": item.stokAwalZAK,
      "Stok Awal (KG)": item.stokAwalKG,
      "Barang Masuk (KG)": item.barangMasukKG,
      "Barang Keluar (KG)": item.barangKeluarKG,
      "Stok Akhir (KG)": item.stokAkhirKG,
      "Stok Barang (ZAK/DUS)": item.stokBarangZAK,
      "Dibuat Oleh": item.createdBy,
      "Tanggal Update": item.updatedAt ? new Date(item.updatedAt).toLocaleDateString("id-ID") : "-",
    }));

    exportToExcel(exportData, `Laporan_Stock_Gudang_${new Date().toISOString().split("T")[0]}`, "Stock Gudang");
  };

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
  ];

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

  const editPreview = calculateStock(
    parseFloat(editForm.stokAwalKG) || 0,
    parseFloat(editForm.barangMasukKG) || 0,
    parseFloat(editForm.barangKeluarKG) || 0,
    editForm.unit
  );

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
      header: "Kode Barang",
      width: "130px",
      render: (row: StockGudang) => (
        <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
          {row.kodeBarang}
        </span>
      ),
    },
    {
      key: "namaBarang",
      header: "Nama Barang",
      render: (row: StockGudang) => (
        <span className="font-semibold text-gray-800">{row.namaBarang}</span>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: "80px",
      render: (row: StockGudang) => (
        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
          row.unit === "ZAK" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
        }`}>
          {row.unit}
        </span>
      ),
    },
    {
      key: "stokAwal",
      header: "Stok Awal",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          <p className="font-mono font-medium">{row.stokAwalZAK.toLocaleString()} {row.unit}</p>
          <p className="text-gray-500 text-xs">{row.stokAwalKG.toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "barangMasuk",
      header: "Masuk (KG)",
      width: "120px",
      render: (row: StockGudang) => (
        <span className="text-green-600 font-mono font-medium">+{row.barangMasukKG.toLocaleString()}</span>
      ),
    },
    {
      key: "barangKeluar",
      header: "Keluar (KG)",
      width: "120px",
      render: (row: StockGudang) => (
        <span className="text-red-600 font-mono font-medium">-{row.barangKeluarKG.toLocaleString()}</span>
      ),
    },
    {
      key: "stokAkhir",
      header: "Stok Akhir (KG)",
      width: "140px",
      render: (row: StockGudang) => (
        <span className={`font-mono font-bold ${row.stokAkhirKG < 1000 ? "text-red-600" : "text-green-700"}`}>
          {row.stokAkhirKG.toLocaleString()}
        </span>
      ),
    },
    {
      key: "stokBarang",
      header: "Stok Barang",
      width: "130px",
      render: (row: StockGudang) => (
        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded">
          {row.stokBarangZAK.toLocaleString()} {row.unit}
        </span>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "150px",
      render: (row: StockGudang) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDetail(row);
            }}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Detail"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(row);
            }}
            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(row.id);
            }}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Header
        title="Laporan Stock Gudang"
        subtitle="Lihat seluruh data stock barang dan kelola persediaan per FOT"
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
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
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportExcel}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </Button>
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Total Jenis Barang</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{filteredData.length}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total Stok ZAK</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">
              {filteredData.filter((d) => d.unit === "ZAK").reduce((sum, d) => sum + d.stokBarangZAK, 0).toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Total Stok DUS</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">
              {filteredData.filter((d) => d.unit === "DUS").reduce((sum, d) => sum + d.stokBarangZAK, 0).toLocaleString()}
            </p>
          </div>
          <div className="p-4 bg-red-50 rounded-xl border border-red-100">
            <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Stock Menipis</p>
            <p className="text-2xl font-bold text-red-700 mt-1">
              {filteredData.filter((d) => d.stokAkhirKG < 1000).length}
            </p>
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
          onRowClick={handleDetail}
        />
      </Card>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detail Stock Barang"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>
              Tutup
            </Button>
          </div>
        }
      >
        {selectedItem && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">FOT</p>
                <p className="text-lg font-bold text-indigo-700 font-mono">{selectedItem.fot || "-"}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Kode Barang</p>
                <p className="text-lg font-bold text-green-700 font-mono">{selectedItem.kodeBarang}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Unit</p>
                <p className="text-lg font-bold text-gray-800">{selectedItem.unit}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nama Barang</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItem.namaBarang}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Stok Awal</p>
                <p className="text-xl font-bold text-green-700">{selectedItem.stokAwalZAK.toLocaleString()} {selectedItem.unit}</p>
                <p className="text-sm text-green-600">{selectedItem.stokAwalKG.toLocaleString()} KG</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
                <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Stok Barang Saat Ini</p>
                <p className="text-xl font-bold text-amber-700">{selectedItem.stokBarangZAK.toLocaleString()} {selectedItem.unit}</p>
                <p className="text-sm text-amber-600">{selectedItem.stokAkhirKG.toLocaleString()} KG</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Barang Masuk</p>
                <p className="text-xl font-bold text-blue-700">+{selectedItem.barangMasukKG.toLocaleString()} KG</p>
              </div>
              <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                <p className="text-xs text-red-600 uppercase tracking-wide font-semibold">Barang Keluar</p>
                <p className="text-xl font-bold text-red-700">-{selectedItem.barangKeluarKG.toLocaleString()} KG</p>
              </div>
              <div className={`p-4 rounded-xl border ${
                selectedItem.stokAkhirKG < 1000
                  ? "bg-red-50 border-red-200"
                  : "bg-green-50 border-green-200"
              }`}>
                <p className={`text-xs uppercase tracking-wide font-semibold ${
                  selectedItem.stokAkhirKG < 1000 ? "text-red-600" : "text-green-600"
                }`}>Stok Akhir</p>
                <p className={`text-xl font-bold ${
                  selectedItem.stokAkhirKG < 1000 ? "text-red-700" : "text-green-700"
                }`}>{selectedItem.stokAkhirKG.toLocaleString()} KG</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Informasi Tambahan</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-gray-500">Dibuat Oleh:</span> <span className="font-medium">{selectedItem.createdBy}</span></p>
                <p><span className="text-gray-500">Terakhir Update:</span> <span className="font-medium">{selectedItem.updatedAt ? new Date(selectedItem.updatedAt).toLocaleDateString("id-ID") : "-"}</span></p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Stock Gudang"
        size="lg"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleUpdate} isLoading={isSubmitting}>
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="FOT"
              type="text"
              value={editForm.fot}
              onChange={(e) => setEditForm((prev) => ({ ...prev, fot: e.target.value }))}
              required
            />
            <Select
              label="Unit"
              value={editForm.unit}
              onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value as "ZAK" | "DUS" }))}
              options={unitOptions}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Kode Barang"
              type="text"
              value={editForm.kodeBarang}
              onChange={(e) => setEditForm((prev) => ({ ...prev, kodeBarang: e.target.value }))}
              required
            />
            <Input
              label="Nama Barang"
              type="text"
              value={editForm.namaBarang}
              onChange={(e) => setEditForm((prev) => ({ ...prev, namaBarang: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label={`Stok Awal (${editForm.unit})`}
              type="number"
              value={editForm.stokAwalZAK}
              onChange={(e) => setEditForm((prev) => ({ ...prev, stokAwalZAK: e.target.value }))}
              required
            />
            <Input
              label="Stok Awal (KG)"
              type="number"
              value={editForm.stokAwalKG}
              onChange={(e) => setEditForm((prev) => ({ ...prev, stokAwalKG: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Barang Masuk (KG)"
              type="number"
              value={editForm.barangMasukKG}
              onChange={(e) => setEditForm((prev) => ({ ...prev, barangMasukKG: e.target.value }))}
              required
            />
            <Input
              label="Barang Keluar (KG)"
              type="number"
              value={editForm.barangKeluarKG}
              onChange={(e) => setEditForm((prev) => ({ ...prev, barangKeluarKG: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 rounded-xl border border-green-200">
              <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Stok Akhir (KG)</p>
              <p className="text-2xl font-bold text-green-700 font-mono">{editPreview.stokAkhirKG.toLocaleString()}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Stok Barang ({editForm.unit})</p>
              <p className="text-2xl font-bold text-amber-700 font-mono">{editPreview.stokBarangZAK.toLocaleString()}</p>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}