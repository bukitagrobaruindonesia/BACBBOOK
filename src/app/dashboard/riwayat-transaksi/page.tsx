"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp } from "firebase/firestore";
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
import { TransaksiBarangMasuk, TransaksiBarangKeluar, JenisTransaksi } from "@/app/types";

interface UnifiedTransaksi {
  id: string;
  jenis: JenisTransaksi;
  tanggal: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  jumlahZAK: number;
  fot: string;
  createdBy: string;
  createdAt?: Date;
  namaCustomer?: string;
  nomorPI?: string;
  nomorInvoice?: string;
  sopirNopol?: string;
  sopirNopolList?: string[];
  nomorSuratPengangkutan?: string;
  botolPerDus?: number;
  bobotPerBotol?: number;
}

interface SopirNopolItem {
  id: number;
  value: string;
}

export default function RiwayatTransaksiPage() {
  const { user } = useAuth();
  const [data, setData] = useState<UnifiedTransaksi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterJenis, setFilterJenis] = useState<"semua" | JenisTransaksi>("semua");
  const [filterFot, setFilterFot] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [selectedItem, setSelectedItem] = useState<UnifiedTransaksi | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fotList, setFotList] = useState<string[]>([]);

  const [editForm, setEditForm] = useState({
    tanggal: "",
    kodeBarang: "",
    namaBarang: "",
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    jumlahZAK: "",
    botolPerDus: "",
    bobotPerBotol: "",
    namaCustomer: "",
    nomorPI: "",
    nomorInvoice: "",
    nomorSuratPengangkutan: "",
    fot: "",
    sopirNopol: "",
  });

  const [editSopirNopolList, setEditSopirNopolList] = useState<SopirNopolItem[]>([{ id: 1, value: "" }]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const masukQuery = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const masukSnapshot = await getDocs(masukQuery);
      const masukData = masukSnapshot.docs.map((doc) => ({
        id: doc.id,
        jenis: "barangMasuk" as JenisTransaksi,
        tanggal: doc.data().tanggal,
        kodeBarang: doc.data().kodeBarang,
        namaBarang: doc.data().namaBarang,
        unit: doc.data().unit,
        jumlahZAK: doc.data().jumlahZAK,
        fot: doc.data().fot,
        createdBy: doc.data().createdBy,
        createdAt: doc.data().createdAt?.toDate(),
        sopirNopol: doc.data().sopirNopol,
        botolPerDus: doc.data().botolPerDus,
        bobotPerBotol: doc.data().bobotPerBotol,
      } as UnifiedTransaksi));

      const keluarQuery = query(collection(db, "transaksiBarangKeluar"), orderBy("createdAt", "desc"));
      const keluarSnapshot = await getDocs(keluarQuery);
      const keluarData = keluarSnapshot.docs.map((doc) => ({
        id: doc.id,
        jenis: "barangKeluar" as JenisTransaksi,
        tanggal: doc.data().tanggal,
        kodeBarang: doc.data().kodeBarang,
        namaBarang: doc.data().namaBarang,
        unit: doc.data().unit,
        jumlahZAK: doc.data().jumlahZAK,
        fot: doc.data().fot,
        createdBy: doc.data().createdBy,
        createdAt: doc.data().createdAt?.toDate(),
        namaCustomer: doc.data().namaCustomer,
        nomorPI: doc.data().nomorPI,
        nomorInvoice: doc.data().nomorInvoice,
        sopirNopolList: doc.data().sopirNopolList,
        nomorSuratPengangkutan: doc.data().nomorSuratPengangkutan,
        botolPerDus: doc.data().botolPerDus,
        bobotPerBotol: doc.data().bobotPerBotol,
      } as UnifiedTransaksi));

      const allData = [...masukData, ...keluarData].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setData(allData);

      const fotSet = new Set<string>();
      allData.forEach((item) => {
        if (item.fot && item.fot.trim()) {
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
      item.fot.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.namaCustomer && item.namaCustomer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.nomorPI && item.nomorPI.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchJenis = filterJenis === "semua" ? true : item.jenis === filterJenis;
    const matchFot = filterFot ? item.fot === filterFot : true;

    const matchBulanTahun = (() => {
      if (!filterBulan && !filterTahun) return true;
      const date = item.tanggal ? new Date(item.tanggal) : new Date();
      const matchBulan = filterBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === filterBulan : true;
      const matchTahun = filterTahun ? date.getFullYear().toString() === filterTahun : true;
      return matchBulan && matchTahun;
    })();

    return matchSearch && matchJenis && matchFot && matchBulanTahun;
  });

  const handleDetail = (item: UnifiedTransaksi) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (item: UnifiedTransaksi) => {
    setSelectedItem(item);
    setEditForm({
      tanggal: item.tanggal,
      kodeBarang: item.kodeBarang,
      namaBarang: item.namaBarang,
      unit: item.unit as "ZAK" | "DUS" | "KG" | "BOTOL",
      jumlahZAK: item.jumlahZAK.toString(),
      botolPerDus: item.botolPerDus ? item.botolPerDus.toString() : "",
      bobotPerBotol: item.bobotPerBotol ? item.bobotPerBotol.toString() : "",
      namaCustomer: item.namaCustomer || "",
      nomorPI: item.nomorPI || "",
      nomorInvoice: item.nomorInvoice || "",
      nomorSuratPengangkutan: item.nomorSuratPengangkutan || "",
      fot: item.fot,
      sopirNopol: item.sopirNopol || "",
    });

    if (item.sopirNopolList && item.sopirNopolList.length > 0) {
      setEditSopirNopolList(item.sopirNopolList.map((v, i) => ({ id: i + 1, value: v })));
    } else {
      setEditSopirNopolList([{ id: 1, value: item.sopirNopol || "" }]);
    }

    setIsEditModalOpen(true);
  };

  const handleEditSopirNopolChange = (id: number, value: string) => {
    setEditSopirNopolList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item))
    );
  };

  const addEditSopirNopol = () => {
    const newId = editSopirNopolList.length > 0 ? Math.max(...editSopirNopolList.map((s) => s.id)) + 1 : 1;
    setEditSopirNopolList((prev) => [...prev, { id: newId, value: "" }]);
  };

  const removeEditSopirNopol = (id: number) => {
    if (editSopirNopolList.length <= 1) return;
    setEditSopirNopolList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const collectionName = selectedItem.jenis === "barangMasuk" ? "transaksiBarangMasuk" : "transaksiBarangKeluar";
      const jumlahZAK = parseFloat(editForm.jumlahZAK) || 0;
      const botolPerDus = editForm.unit === "BOTOL" ? parseFloat(editForm.botolPerDus) || 0 : null;
      const bobotPerBotol = editForm.unit === "BOTOL" ? parseFloat(editForm.bobotPerBotol) || 0 : null;

      const updateData: any = {
        tanggal: editForm.tanggal,
        kodeBarang: editForm.kodeBarang,
        namaBarang: editForm.namaBarang,
        unit: editForm.unit,
        jumlahZAK: jumlahZAK,
        fot: editForm.fot.trim().toUpperCase(),
        updatedAt: serverTimestamp(),
      };

      if (editForm.unit === "BOTOL") {
        updateData.botolPerDus = botolPerDus;
        updateData.bobotPerBotol = bobotPerBotol;
      }

      if (selectedItem.jenis === "barangMasuk") {
        updateData.sopirNopol = editForm.sopirNopol.trim();
      } else {
        updateData.namaCustomer = editForm.namaCustomer.trim();
        updateData.nomorPI = editForm.nomorPI.trim();
        updateData.nomorInvoice = editForm.nomorInvoice.trim();
        updateData.nomorSuratPengangkutan = editForm.nomorSuratPengangkutan.trim();
        const sopirNopolValues = editSopirNopolList
          .filter((s) => s.value.trim())
          .map((s) => s.value.trim());
        updateData.sopirNopolList = sopirNopolValues;
      }

      await updateDoc(doc(db, collectionName, selectedItem.id), updateData);

      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: UnifiedTransaksi) => {
    const collectionName = item.jenis === "barangMasuk" ? "transaksiBarangMasuk" : "transaksiBarangKeluar";
    const jenisLabel = item.jenis === "barangMasuk" ? "Barang Masuk" : "Barang Keluar";
    if (!confirm(`Apakah Anda yakin ingin menghapus data ${jenisLabel} ini?`)) return;

    try {
      await deleteDoc(doc(db, collectionName, item.id));
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((item) => ({
      "Jenis Transaksi": item.jenis === "barangMasuk" ? "Barang Masuk" : "Barang Keluar",
      "Tanggal": item.tanggal,
      "Kode Barang": item.kodeBarang,
      "Nama Barang": item.namaBarang,
      "Unit": item.unit,
      "Jumlah": item.jumlahZAK,
      "FOT": item.fot,
      "Customer": item.namaCustomer || "-",
      "No PI": item.nomorPI || "-",
      "No Invoice": item.nomorInvoice || "-",
      "Sopir/Nopol": item.sopirNopol || (item.sopirNopolList ? item.sopirNopolList.join("; ") : "-"),
      "No Surat Pengangkutan": item.nomorSuratPengangkutan || "-",
      "Dibuat Oleh": item.createdBy,
      "Tanggal Dibuat": item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "-",
    }));

    exportToExcel(exportData, `Riwayat_Transaksi_${new Date().toISOString().split("T")[0]}`, "Riwayat Transaksi");
  };

  const jenisOptions = [
    { value: "semua", label: "Semua Transaksi" },
    { value: "barangMasuk", label: "Barang Masuk" },
    { value: "barangKeluar", label: "Barang Keluar" },
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

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "KG", label: "KG" },
    { value: "BOTOL", label: "BOTOL" },
  ];

  const getJenisBadgeClass = (jenis: JenisTransaksi) => {
    if (jenis === "barangMasuk") return "bg-blue-100 text-blue-700";
    return "bg-orange-100 text-orange-700";
  };

  const getJenisLabel = (jenis: JenisTransaksi) => {
    if (jenis === "barangMasuk") return "MASUK";
    return "KELUAR";
  };

  const columns = [
    {
      key: "jenis",
      header: "Jenis",
      width: "100px",
      render: (row: UnifiedTransaksi) => (
        <span className={`px-2 py-1 rounded-md text-xs font-bold ${getJenisBadgeClass(row.jenis)}`}>
          {getJenisLabel(row.jenis)}
        </span>
      ),
    },
    {
      key: "tanggal",
      header: "Tanggal",
      width: "120px",
      render: (row: UnifiedTransaksi) => (
        <span className="font-medium text-gray-800">{row.tanggal}</span>
      ),
    },
    {
      key: "kodeBarang",
      header: "Kode",
      width: "120px",
      render: (row: UnifiedTransaksi) => (
        <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded">
          {row.kodeBarang}
        </span>
      ),
    },
    {
      key: "namaBarang",
      header: "Nama Barang",
      render: (row: UnifiedTransaksi) => (
        <span className="font-semibold text-gray-800">{row.namaBarang}</span>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: "80px",
      render: (row: UnifiedTransaksi) => (
        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
          row.unit === "ZAK" ? "bg-blue-100 text-blue-700" :
          row.unit === "DUS" ? "bg-purple-100 text-purple-700" :
          row.unit === "BOTOL" ? "bg-pink-100 text-pink-700" :
          "bg-gray-100 text-gray-700"
        }`}>
          {row.unit}
        </span>
      ),
    },
    {
      key: "jumlah",
      header: "Jumlah",
      width: "120px",
      render: (row: UnifiedTransaksi) => (
        <span className="font-mono font-bold text-gray-700">
          {row.jumlahZAK.toLocaleString()} {row.unit === "KG" ? "KG" : "ZAK"}
        </span>
      ),
    },
    {
      key: "fot",
      header: "FOT",
      width: "100px",
      render: (row: UnifiedTransaksi) => (
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
          {row.fot}
        </span>
      ),
    },
    {
      key: "info",
      header: "Info Tambahan",
      render: (row: UnifiedTransaksi) => (
        <div className="text-sm">
          {row.jenis === "barangKeluar" && row.namaCustomer && (
            <p className="text-gray-600">{row.namaCustomer}</p>
          )}
          {row.jenis === "barangKeluar" && row.nomorPI && (
            <p className="text-xs text-gray-400">{row.nomorPI}</p>
          )}
          {row.jenis === "barangMasuk" && row.sopirNopol && (
            <p className="text-gray-600">{row.sopirNopol}</p>
          )}
        </div>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "150px",
      render: (row: UnifiedTransaksi) => (
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
              handleDelete(row);
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

  const getTotalMasuk = () => {
    return filteredData.filter((d) => d.jenis === "barangMasuk").length;
  };

  const getTotalKeluar = () => {
    return filteredData.filter((d) => d.jenis === "barangKeluar").length;
  };

  const isBotol = editForm.unit === "BOTOL";

  return (
    <div className="space-y-6">
      <Header
        title="Riwayat Transaksi"
        subtitle="Lihat dan kelola riwayat transaksi barang masuk dan keluar"
      />

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari kode, nama barang, FOT, customer..."
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Select
            label="Filter Jenis Transaksi"
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value as "semua" | JenisTransaksi)}
            options={jenisOptions}
          />
          <Select
            label="Filter FOT"
            value={filterFot}
            onChange={(e) => setFilterFot(e.target.value)}
            options={fotOptions}
          />
          <Select
            label="Filter Bulan"
            value={filterBulan}
            onChange={(e) => setFilterBulan(e.target.value)}
            options={bulanOptions}
          />
          <Select
            label="Filter Tahun"
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            options={tahunOptions}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total Transaksi</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{filteredData.length}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Barang Masuk</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{getTotalMasuk()}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-xs text-orange-600 uppercase tracking-wide font-semibold">Barang Keluar</p>
            <p className="text-2xl font-bold text-orange-700 mt-1">{getTotalKeluar()}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Total Jumlah</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">
              {filteredData.reduce((sum, d) => sum + d.jumlahZAK, 0).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredData.length} dari {data.length} data
          {filterJenis !== "semua" && ` | Jenis: ${filterJenis === "barangMasuk" ? "Barang Masuk" : "Barang Keluar"}`}
          {filterFot && ` | FOT: ${filterFot}`}
          {filterBulan && ` | Bulan: ${bulanOptions.find((b) => b.value === filterBulan)?.label}`}
          {filterTahun && ` | Tahun: ${filterTahun}`}
        </div>

        <Table
          columns={columns}
          data={filteredData}
          isLoading={isLoading}
          emptyMessage="Belum ada data transaksi"
          keyExtractor={(row) => `${row.jenis}_${row.id}`}
          onRowClick={handleDetail}
        />
      </Card>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detail Transaksi"
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
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getJenisBadgeClass(selectedItem.jenis)}`}>
                {selectedItem.jenis === "barangMasuk" ? "TRANSAKSI BARANG MASUK" : "TRANSAKSI BARANG KELUAR"}
              </span>
              <span className="text-sm text-gray-500">{selectedItem.tanggal}</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Kode Barang</p>
                <p className="text-lg font-bold text-green-700 font-mono">{selectedItem.kodeBarang}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nama Barang</p>
                <p className="text-lg font-semibold text-gray-800">{selectedItem.namaBarang}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Unit</p>
                <p className="text-lg font-bold text-gray-800">{selectedItem.unit}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">FOT</p>
                <p className="text-lg font-bold text-indigo-700 font-mono">{selectedItem.fot}</p>
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">Jumlah</p>
              <p className="text-3xl font-bold text-amber-700 font-mono">
                {selectedItem.jumlahZAK.toLocaleString()} {selectedItem.unit === "KG" ? "KG" : "ZAK"}
              </p>
            </div>

            {selectedItem.unit === "BOTOL" && (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-pink-50 rounded-xl border border-pink-200">
                  <p className="text-xs text-pink-600 uppercase tracking-wide font-semibold">Botol per DUS</p>
                  <p className="text-xl font-bold text-pink-700 font-mono">{selectedItem.botolPerDus?.toLocaleString() || "-"}</p>
                </div>
                <div className="p-4 bg-pink-50 rounded-xl border border-pink-200">
                  <p className="text-xs text-pink-600 uppercase tracking-wide font-semibold">Bobot per Botol</p>
                  <p className="text-xl font-bold text-pink-700 font-mono">{selectedItem.bobotPerBotol?.toLocaleString() || "-"} ml</p>
                </div>
              </div>
            )}

            {selectedItem.jenis === "barangMasuk" && selectedItem.sopirNopol && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-1">Sopir / Nopol</p>
                <p className="text-lg font-semibold text-blue-700">{selectedItem.sopirNopol}</p>
              </div>
            )}

            {selectedItem.jenis === "barangKeluar" && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nama Customer</p>
                    <p className="text-lg font-semibold text-blue-700">{selectedItem.namaCustomer}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">No PI</p>
                    <p className="text-lg font-semibold text-blue-700 font-mono">{selectedItem.nomorPI}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">No Invoice</p>
                    <p className="text-lg font-semibold text-blue-700 font-mono">{selectedItem.nomorInvoice}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">No Surat Pengangkutan</p>
                    <p className="text-lg font-semibold text-blue-700 font-mono">{selectedItem.nomorSuratPengangkutan}</p>
                  </div>
                </div>

                {selectedItem.sopirNopolList && selectedItem.sopirNopolList.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-2">Sopir / Nopol</p>
                    <div className="space-y-2">
                      {selectedItem.sopirNopolList.map((sn, idx) => (
                        <p key={idx} className="text-sm font-medium text-blue-700">
                          {idx + 1}. {sn}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Informasi Tambahan</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-gray-500">Dibuat Oleh:</span> <span className="font-medium">{selectedItem.createdBy}</span></p>
                <p><span className="text-gray-500">Tanggal Dibuat:</span> <span className="font-medium">{selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleDateString("id-ID") : "-"}</span></p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit ${selectedItem?.jenis === "barangMasuk" ? "Transaksi Barang Masuk" : "Transaksi Barang Keluar"}`}
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
        <form onSubmit={handleUpdate} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Tanggal"
              type="date"
              value={editForm.tanggal}
              onChange={(e) => setEditForm((prev) => ({ ...prev, tanggal: e.target.value }))}
              required
            />

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

            <Select
              label="Unit"
              value={editForm.unit}
              onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value as "ZAK" | "DUS" | "KG" | "BOTOL" }))}
              options={unitOptions}
              required
            />

            <Input
              label={`Jumlah (${editForm.unit === "KG" ? "KG" : "ZAK"})`}
              type="number"
              value={editForm.jumlahZAK}
              onChange={(e) => setEditForm((prev) => ({ ...prev, jumlahZAK: e.target.value }))}
              required
            />

            <Input
              label="FOT"
              type="text"
              value={editForm.fot}
              onChange={(e) => setEditForm((prev) => ({ ...prev, fot: e.target.value }))}
              required
            />
          </div>

          {isBotol && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Botol per DUS"
                type="number"
                value={editForm.botolPerDus}
                onChange={(e) => setEditForm((prev) => ({ ...prev, botolPerDus: e.target.value }))}
              />
              <Input
                label="Bobot Per Botol (ml)"
                type="number"
                value={editForm.bobotPerBotol}
                onChange={(e) => setEditForm((prev) => ({ ...prev, bobotPerBotol: e.target.value }))}
              />
            </div>
          )}

          {selectedItem?.jenis === "barangMasuk" && (
            <Input
              label="Sopir / Nopol"
              type="text"
              value={editForm.sopirNopol}
              onChange={(e) => setEditForm((prev) => ({ ...prev, sopirNopol: e.target.value }))}
              required
            />
          )}

          {selectedItem?.jenis === "barangKeluar" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input
                  label="Nama Customer"
                  type="text"
                  value={editForm.namaCustomer}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, namaCustomer: e.target.value }))}
                  required
                />

                <Input
                  label="No PI / Proforma Invoice"
                  type="text"
                  value={editForm.nomorPI}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, nomorPI: e.target.value }))}
                  required
                />

                <Input
                  label="No Invoice"
                  type="text"
                  value={editForm.nomorInvoice}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, nomorInvoice: e.target.value }))}
                  required
                />

                <Input
                  label="Nomor Surat Pengangkutan"
                  type="text"
                  value={editForm.nomorSuratPengangkutan}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, nomorSuratPengangkutan: e.target.value }))}
                  required
                />
              </div>

              <Card title="Sopir & Nopol">
                <div className="space-y-4">
                  {editSopirNopolList.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="flex-1">
                        <Input
                          label={index === 0 ? "Sopir / Nopol" : `Sopir / Nopol ${index + 1}`}
                          type="text"
                          value={item.value}
                          onChange={(e) => handleEditSopirNopolChange(item.id, e.target.value)}
                          placeholder="Contoh: Budi / B 1234 ABC"
                          required={index === 0}
                        />
                      </div>
                      {editSopirNopolList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEditSopirNopol(item.id)}
                          className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addEditSopirNopol}
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Sopir/Nopol
                  </Button>
                </div>
              </Card>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}