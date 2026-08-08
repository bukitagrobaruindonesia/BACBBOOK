"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  Timestamp,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import * as XLSX from "xlsx-js-style";

type TabKey = "peralatan" | "perlengkapan" | "input" | "riwayat";

type AsetItem = {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  kategori: "peralatan" | "perlengkapan";
  jenis: "masuk" | "keluar";
  tanggal: string;
  jumlah: number;
  hargaSatuan: number;
  totalHarga: number;
  createdAt: Timestamp;
  createdBy: string;
};

type AggregatedAset = {
  kodeBarang: string;
  namaBarang: string;
  kategori: "peralatan" | "perlengkapan";
  stokTersedia: number;
  totalNilaiMasuk: number;
  totalNilaiKeluar: number;
  riwayat: AsetItem[];
};

const tabs: { key: TabKey; label: string }[] = [
  { key: "peralatan", label: "Peralatan Kantor" },
  { key: "perlengkapan", label: "Perlengkapan Kantor" },
  { key: "input", label: "Input Data" },
  { key: "riwayat", label: "Riwayat Asset Masuk dan Keluar" },
];

const headerStyle = {
  font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
  fill: { fgColor: { rgb: "166534" }, patternType: "solid" as const },
  alignment: { horizontal: "center" as const, vertical: "center" as const },
  border: {
    top: { style: "thin" as const, color: { rgb: "000000" } },
    bottom: { style: "thin" as const, color: { rgb: "000000" } },
    left: { style: "thin" as const, color: { rgb: "000000" } },
    right: { style: "thin" as const, color: { rgb: "000000" } },
  },
};

const cellStyle = {
  border: {
    top: { style: "thin" as const, color: { rgb: "CCCCCC" } },
    bottom: { style: "thin" as const, color: { rgb: "CCCCCC" } },
    left: { style: "thin" as const, color: { rgb: "CCCCCC" } },
    right: { style: "thin" as const, color: { rgb: "CCCCCC" } },
  },
  alignment: { vertical: "center" as const },
};

const rightAlignStyle = {
  ...cellStyle,
  alignment: { horizontal: "right" as const, vertical: "center" as const },
  numFmt: '"Rp" #,##0',
};

const centerStyle = {
  ...cellStyle,
  alignment: { horizontal: "center" as const, vertical: "center" as const },
};

export default function AsetPerusahaanPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("peralatan");
  const [data, setData] = useState<AsetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [barangList, setBarangList] = useState<{ kodeBarang: string; namaBarang: string; kategori: "peralatan" | "perlengkapan" }[]>([]);
  const [isBarangBaru, setIsBarangBaru] = useState(false);

  const [form, setForm] = useState({
    kodeBarang: "",
    namaBarang: "",
    kategori: "peralatan" as "peralatan" | "perlengkapan",
    jenis: "masuk" as "masuk" | "keluar",
    tanggal: new Date().toISOString().split("T")[0],
    jumlah: "",
    hargaSatuan: "",
  });

  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const [editingItem, setEditingItem] = useState<AsetItem | null>(null);
  const [editForm, setEditForm] = useState({
    kodeBarang: "",
    namaBarang: "",
    kategori: "peralatan" as "peralatan" | "perlengkapan",
    jenis: "masuk" as "masuk" | "keluar",
    tanggal: "",
    jumlah: "",
    hargaSatuan: "",
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "asetPerusahaan"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const items: AsetItem[] = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          kodeBarang: d.kodeBarang || "",
          namaBarang: d.namaBarang || "",
          kategori: d.kategori || "peralatan",
          jenis: d.jenis || "masuk",
          tanggal: d.tanggal || "",
          jumlah: Number(d.jumlah) || 0,
          hargaSatuan: Number(d.hargaSatuan) || 0,
          totalHarga: Number(d.totalHarga) || 0,
          createdAt: d.createdAt,
          createdBy: d.createdBy || "",
        };
      });
      setData(items);

      const map = new Map<string, { kodeBarang: string; namaBarang: string; kategori: "peralatan" | "perlengkapan" }>();
      items.forEach((item) => {
        const key = item.kodeBarang + "_" + item.namaBarang;
        if (!map.has(key)) {
          map.set(key, {
            kodeBarang: item.kodeBarang,
            namaBarang: item.namaBarang,
            kategori: item.kategori,
          });
        }
      });
      setBarangList(Array.from(map.values()));
    } catch (e) {
      console.error(e);
      alert("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  const aggregated = useMemo(() => {
    const map = new Map<string, AggregatedAset>();
    data.forEach((item) => {
      const key = item.kodeBarang + "_" + item.namaBarang;
      if (!map.has(key)) {
        map.set(key, {
          kodeBarang: item.kodeBarang,
          namaBarang: item.namaBarang,
          kategori: item.kategori,
          stokTersedia: 0,
          totalNilaiMasuk: 0,
          totalNilaiKeluar: 0,
          riwayat: [],
        });
      }
      const agg = map.get(key)!;
      agg.riwayat.push(item);
      if (item.jenis === "masuk") {
        agg.stokTersedia += item.jumlah;
        agg.totalNilaiMasuk += item.totalHarga;
      } else {
        agg.stokTersedia -= item.jumlah;
        agg.totalNilaiKeluar += item.totalHarga;
      }
    });
    return Array.from(map.values());
  }, [data]);

  const peralatanData = aggregated.filter((a) => a.kategori === "peralatan");
  const perlengkapanData = aggregated.filter((a) => a.kategori === "perlengkapan");

  const filteredRiwayat = useMemo(() => {
    let filtered = [...data];
    if (filterStart) {
      filtered = filtered.filter((d) => d.tanggal >= filterStart);
    }
    if (filterEnd) {
      filtered = filtered.filter((d) => d.tanggal <= filterEnd);
    }
    return filtered;
  }, [data, filterStart, filterEnd]);

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleBarangSelect = (value: string) => {
    if (value === "__BARU__") {
      setIsBarangBaru(true);
      setForm((p) => ({ ...p, kodeBarang: "", namaBarang: "" }));
      return;
    }
    const selected = barangList.find((b) => b.kodeBarang === value);
    if (selected) {
      setIsBarangBaru(false);
      setForm((p) => ({
        ...p,
        kodeBarang: selected.kodeBarang,
        namaBarang: selected.namaBarang,
        kategori: selected.kategori,
      }));
    }
  };

  const handleChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      return next;
    });
  };

  const totalHarga = (Number(form.jumlah) || 0) * (Number(form.hargaSatuan) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kodeBarang.trim()) {
      alert("Kode barang wajib diisi");
      return;
    }
    if (!form.namaBarang.trim()) {
      alert("Nama barang wajib diisi");
      return;
    }
    if (!form.jumlah || Number(form.jumlah) <= 0) {
      alert("Jumlah barang harus lebih dari 0");
      return;
    }
    if (!form.hargaSatuan || Number(form.hargaSatuan) < 0) {
      alert("Harga satuan tidak valid");
      return;
    }

    setSubmitting(true);
    try {
      await addDoc(collection(db, "asetPerusahaan"), {
        kodeBarang: form.kodeBarang.trim(),
        namaBarang: form.namaBarang.trim(),
        kategori: form.kategori,
        jenis: form.jenis,
        tanggal: form.tanggal,
        jumlah: Number(form.jumlah),
        hargaSatuan: Number(form.hargaSatuan),
        totalHarga: totalHarga,
        createdAt: Timestamp.now(),
        createdBy: user?.nama || user?.email || "",
      });
      alert("Data berhasil disimpan");
      setForm({
        kodeBarang: "",
        namaBarang: "",
        kategori: "peralatan",
        jenis: "masuk",
        tanggal: new Date().toISOString().split("T")[0],
        jumlah: "",
        hargaSatuan: "",
      });
      setIsBarangBaru(false);
      fetchData();
      setActiveTab(form.kategori);
    } catch (e) {
      console.error(e);
      alert("Gagal menyimpan data");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, namaBarang: string) => {
    if (!window.confirm(`Hapus data ${namaBarang}?`)) return;
    try {
      await deleteDoc(doc(db, "asetPerusahaan", id));
      alert("Data berhasil dihapus");
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus data");
    }
  };

  const openEdit = (item: AsetItem) => {
    setEditingItem(item);
    setEditForm({
      kodeBarang: item.kodeBarang,
      namaBarang: item.namaBarang,
      kategori: item.kategori,
      jenis: item.jenis,
      tanggal: item.tanggal,
      jumlah: String(item.jumlah),
      hargaSatuan: String(item.hargaSatuan),
    });
    setShowEditModal(true);
  };

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const editTotalHarga = (Number(editForm.jumlah) || 0) * (Number(editForm.hargaSatuan) || 0);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    if (!editForm.kodeBarang.trim()) {
      alert("Kode barang wajib diisi");
      return;
    }
    if (!editForm.namaBarang.trim()) {
      alert("Nama barang wajib diisi");
      return;
    }
    if (!editForm.jumlah || Number(editForm.jumlah) <= 0) {
      alert("Jumlah barang harus lebih dari 0");
      return;
    }
    if (!editForm.hargaSatuan || Number(editForm.hargaSatuan) < 0) {
      alert("Harga satuan tidak valid");
      return;
    }

    setUpdating(true);
    try {
      await updateDoc(doc(db, "asetPerusahaan", editingItem.id), {
        kodeBarang: editForm.kodeBarang.trim(),
        namaBarang: editForm.namaBarang.trim(),
        kategori: editForm.kategori,
        jenis: editForm.jenis,
        tanggal: editForm.tanggal,
        jumlah: Number(editForm.jumlah),
        hargaSatuan: Number(editForm.hargaSatuan),
        totalHarga: editTotalHarga,
      });
      alert("Data berhasil diperbarui");
      setShowEditModal(false);
      setEditingItem(null);
      fetchData();
    } catch (e) {
      console.error(e);
      alert("Gagal memperbarui data");
    } finally {
      setUpdating(false);
    }
  };

  const fetchLogoBase64 = async (): Promise<string> => {
    try {
      const res = await fetch("/logo.png");
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.replace(/^data:image\/png;base64,/, ""));
        };
        reader.readAsDataURL(blob);
      });
    } catch {
      return "";
    }
  };

  const exportExcel = async (
    rows: { kodeBarang: string; namaBarang: string; stokTersedia: number; totalNilaiMasuk: number; totalNilaiKeluar: number; totalNilaiTersedia: number }[],
    sheetName: string,
    title: string
  ) => {
    const logoBase64 = await fetchLogoBase64();
    const wb = XLSX.utils.book_new();

    const wsData: (string | number)[][] = [];
    wsData.push([title, "", "", "", "", "", ""]);

    let filterText = "";
    if (filterStart && filterEnd) {
      filterText = `Periode: ${filterStart} s/d ${filterEnd}`;
    } else if (filterStart) {
      filterText = `Dari tanggal: ${filterStart}`;
    } else if (filterEnd) {
      filterText = `Sampai tanggal: ${filterEnd}`;
    }
    if (filterText) {
      wsData.push([filterText, "", "", "", "", "", ""]);
    }
    wsData.push(["No", "Kode Barang", "Nama Barang", "Stok Tersedia", "Total Nilai Masuk", "Total Nilai Keluar", "Total Nilai Tersedia"]);

    rows.forEach((row, i) => {
      wsData.push([
        i + 1,
        row.kodeBarang,
        row.namaBarang,
        row.stokTersedia,
        row.totalNilaiMasuk,
        row.totalNilaiKeluar,
        row.totalNilaiTersedia,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const titleRow = 0;
    const filterRow = filterText ? 1 : -1;
    const headerRow = filterText ? 2 : 1;

    ws["!merges"] = [
      { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 6 } },
    ];
    if (filterText) {
      ws["!merges"].push({ s: { r: filterRow, c: 0 }, e: { r: filterRow, c: 6 } });
    }

    ws["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 35 },
      { wch: 16 },
      { wch: 22 },
      { wch: 22 },
      { wch: 22 },
    ];

    const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

    ws[cellRef(titleRow, 0)] = {
      v: title,
      s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } },
    };

    if (filterText) {
      ws[cellRef(filterRow, 0)] = {
        v: filterText,
        s: { font: { italic: true, sz: 10 }, alignment: { horizontal: "center" } },
      };
    }

    for (let c = 0; c < 7; c++) {
      ws[cellRef(headerRow, c)] = {
        v: wsData[headerRow][c],
        s: headerStyle,
      };
    }

    rows.forEach((_, i) => {
      const r = headerRow + 1 + i;
      ws[cellRef(r, 0)] = { v: i + 1, s: centerStyle };
      ws[cellRef(r, 1)] = { v: rows[i].kodeBarang, s: cellStyle };
      ws[cellRef(r, 2)] = { v: rows[i].namaBarang, s: cellStyle };
      ws[cellRef(r, 3)] = { v: rows[i].stokTersedia, s: centerStyle };
      ws[cellRef(r, 4)] = { v: rows[i].totalNilaiMasuk, s: rightAlignStyle };
      ws[cellRef(r, 5)] = { v: rows[i].totalNilaiKeluar, s: rightAlignStyle };
      ws[cellRef(r, 6)] = { v: rows[i].totalNilaiTersedia, s: rightAlignStyle };
    });

    if (logoBase64) {
      ws["!images"] = [
        {
          name: "logo.png",
          data: logoBase64,
          opts: { base64: true },
          position: {
            type: "twoCellAnchor",
            from: { col: 0, row: 0 },
            to: { col: 2, row: 3 },
          },
        },
      ];
    }

    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const exportRiwayatExcel = async () => {
    const logoBase64 = await fetchLogoBase64();
    const wb = XLSX.utils.book_new();

    const wsData: (string | number)[][] = [];
    wsData.push(["RIWAYAT ASSET MASUK DAN KELUAR", "", "", "", "", "", "", "", ""]);

    let filterText = "";
    if (filterStart && filterEnd) {
      filterText = `Periode: ${filterStart} s/d ${filterEnd}`;
    } else if (filterStart) {
      filterText = `Dari tanggal: ${filterStart}`;
    } else if (filterEnd) {
      filterText = `Sampai tanggal: ${filterEnd}`;
    }
    if (filterText) {
      wsData.push([filterText, "", "", "", "", "", "", "", ""]);
    }
    wsData.push(["No", "Tanggal", "Kode Barang", "Nama Barang", "Kategori", "Jenis", "Jumlah", "Harga Satuan", "Total Harga"]);

    filteredRiwayat.forEach((item, i) => {
      wsData.push([
        i + 1,
        item.tanggal,
        item.kodeBarang,
        item.namaBarang,
        item.kategori === "peralatan" ? "Peralatan Kantor" : "Perlengkapan Kantor",
        item.jenis === "masuk" ? "Masuk" : "Keluar",
        item.jumlah,
        item.hargaSatuan,
        item.totalHarga,
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const titleRow = 0;
    const filterRow = filterText ? 1 : -1;
    const headerRow = filterText ? 2 : 1;

    ws["!merges"] = [
      { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 8 } },
    ];
    if (filterText) {
      ws["!merges"].push({ s: { r: filterRow, c: 0 }, e: { r: filterRow, c: 8 } });
    }

    ws["!cols"] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 16 },
      { wch: 30 },
      { wch: 20 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 18 },
    ];

    const cellRef = (r: number, c: number) => XLSX.utils.encode_cell({ r, c });

    ws[cellRef(titleRow, 0)] = {
      v: "RIWAYAT ASSET MASUK DAN KELUAR",
      s: { font: { bold: true, sz: 14 }, alignment: { horizontal: "center", vertical: "center" } },
    };

    if (filterText) {
      ws[cellRef(filterRow, 0)] = {
        v: filterText,
        s: { font: { italic: true, sz: 10 }, alignment: { horizontal: "center" } },
      };
    }

    for (let c = 0; c < 9; c++) {
      ws[cellRef(headerRow, c)] = {
        v: wsData[headerRow][c],
        s: headerStyle,
      };
    }

    filteredRiwayat.forEach((item, i) => {
      const r = headerRow + 1 + i;
      ws[cellRef(r, 0)] = { v: i + 1, s: centerStyle };
      ws[cellRef(r, 1)] = { v: item.tanggal, s: cellStyle };
      ws[cellRef(r, 2)] = { v: item.kodeBarang, s: cellStyle };
      ws[cellRef(r, 3)] = { v: item.namaBarang, s: cellStyle };
      ws[cellRef(r, 4)] = { v: item.kategori === "peralatan" ? "Peralatan Kantor" : "Perlengkapan Kantor", s: cellStyle };
      ws[cellRef(r, 5)] = { v: item.jenis === "masuk" ? "Masuk" : "Keluar", s: centerStyle };
      ws[cellRef(r, 6)] = { v: item.jumlah, s: centerStyle };
      ws[cellRef(r, 7)] = { v: item.hargaSatuan, s: rightAlignStyle };
      ws[cellRef(r, 8)] = { v: item.totalHarga, s: rightAlignStyle };
    });

    if (logoBase64) {
      ws["!images"] = [
        {
          name: "logo.png",
          data: logoBase64,
          opts: { base64: true },
          position: {
            type: "twoCellAnchor",
            from: { col: 0, row: 0 },
            to: { col: 2, row: 3 },
          },
        },
      ];
    }

    XLSX.utils.book_append_sheet(wb, ws, "Riwayat Aset");
    XLSX.writeFile(wb, `Riwayat_Aset_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportPeralatan = () => {
    const rows = peralatanData.map((a) => ({
      kodeBarang: a.kodeBarang,
      namaBarang: a.namaBarang,
      stokTersedia: a.stokTersedia,
      totalNilaiMasuk: a.totalNilaiMasuk,
      totalNilaiKeluar: a.totalNilaiKeluar,
      totalNilaiTersedia: a.totalNilaiMasuk - a.totalNilaiKeluar,
    }));
    exportExcel(rows, "Peralatan_Kantor", "DATA PERALATAN KANTOR");
  };

  const handleExportPerlengkapan = () => {
    const rows = perlengkapanData.map((a) => ({
      kodeBarang: a.kodeBarang,
      namaBarang: a.namaBarang,
      stokTersedia: a.stokTersedia,
      totalNilaiMasuk: a.totalNilaiMasuk,
      totalNilaiKeluar: a.totalNilaiKeluar,
      totalNilaiTersedia: a.totalNilaiMasuk - a.totalNilaiKeluar,
    }));
    exportExcel(rows, "Perlengkapan_Kantor", "DATA PERLENGKAPAN KANTOR");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-green-800 to-green-700 px-6 py-5">
            <h1 className="text-2xl font-bold text-white">Aset Perusahaan</h1>
            <p className="text-green-100 text-sm mt-1">Manajemen asset peralatan dan perlengkapan kantor</p>
          </div>

          <div className="flex overflow-x-auto border-b border-gray-200 bg-gray-50/50">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  px-5 py-3.5 text-sm font-semibold whitespace-nowrap transition-all border-b-2
                  ${activeTab === tab.key
                    ? "border-green-600 text-green-700 bg-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "input" && (
              <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-2">
                  <h3 className="font-semibold text-green-800">Form Input Asset</h3>
                  <p className="text-sm text-green-600">Pilih barang yang sudah tersimpan atau input barang baru</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Pilih Barang</label>
                  <select
                    value={isBarangBaru ? "__BARU__" : form.kodeBarang}
                    onChange={(e) => handleBarangSelect(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition bg-white"
                  >
                    <option value="">-- Pilih Barang --</option>
                    {barangList.map((b) => (
                      <option key={b.kodeBarang} value={b.kodeBarang}>
                        {b.kodeBarang} - {b.namaBarang}
                      </option>
                    ))}
                    <option value="__BARU__">+ Barang Baru</option>
                  </select>
                </div>

                {isBarangBaru && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode Barang</label>
                      <input
                        type="text"
                        value={form.kodeBarang}
                        onChange={(e) => handleChange("kodeBarang", e.target.value)}
                        placeholder="Contoh: AST-001"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Barang</label>
                      <input
                        type="text"
                        value={form.namaBarang}
                        onChange={(e) => handleChange("namaBarang", e.target.value)}
                        placeholder="Contoh: Laptop, Kursi, Kertas A4, dll"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                        required
                      />
                    </div>
                  </>
                )}

                {!isBarangBaru && form.kodeBarang && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode Barang</label>
                      <div className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 font-medium">
                        {form.kodeBarang}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Barang</label>
                      <div className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 font-medium">
                        {form.namaBarang}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori</label>
                    <div className="flex rounded-xl overflow-hidden border border-gray-300">
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, kategori: "peralatan" }))}
                        className={`flex-1 py-2.5 text-sm font-medium transition ${
                          form.kategori === "peralatan"
                            ? "bg-green-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Peralatan
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, kategori: "perlengkapan" }))}
                        className={`flex-1 py-2.5 text-sm font-medium transition ${
                          form.kategori === "perlengkapan"
                            ? "bg-green-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Perlengkapan
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Transaksi</label>
                    <div className="flex rounded-xl overflow-hidden border border-gray-300">
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, jenis: "masuk" }))}
                        className={`flex-1 py-2.5 text-sm font-medium transition ${
                          form.jenis === "masuk"
                            ? "bg-blue-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Masuk
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, jenis: "keluar" }))}
                        className={`flex-1 py-2.5 text-sm font-medium transition ${
                          form.jenis === "keluar"
                            ? "bg-red-600 text-white"
                            : "bg-white text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        Keluar
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
                  <input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => handleChange("tanggal", e.target.value)}
                    className="w-full md:w-64 px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Jumlah Barang</label>
                    <input
                      type="number"
                      min="1"
                      value={form.jumlah}
                      onChange={(e) => handleChange("jumlah", e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga Satuan</label>
                    <input
                      type="number"
                      min="0"
                      value={form.hargaSatuan}
                      onChange={(e) => handleChange("hargaSatuan", e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Harga</label>
                    <div className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 font-semibold">
                      {formatRupiah(totalHarga)}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full md:w-auto px-8 py-3 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? "Menyimpan..." : "Simpan Data"}
                  </button>
                </div>
              </form>
            )}

            {(activeTab === "peralatan" || activeTab === "perlengkapan") && (
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
                      <input
                        type="date"
                        value={filterStart}
                        onChange={(e) => setFilterStart(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
                      <input
                        type="date"
                        value={filterEnd}
                        onChange={(e) => setFilterEnd(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={activeTab === "peralatan" ? handleExportPeralatan : handleExportPerlengkapan}
                    className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    Export Excel
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-green-800 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">No</th>
                          <th className="px-4 py-3 text-left font-semibold">Kode Barang</th>
                          <th className="px-4 py-3 text-left font-semibold">Nama Barang</th>
                          <th className="px-4 py-3 text-center font-semibold">Stok Tersedia</th>
                          <th className="px-4 py-3 text-right font-semibold">Total Nilai Masuk</th>
                          <th className="px-4 py-3 text-right font-semibold">Total Nilai Keluar</th>
                          <th className="px-4 py-3 text-right font-semibold">Total Nilai Tersedia</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {(activeTab === "peralatan" ? peralatanData : perlengkapanData).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                              Belum ada data {activeTab === "peralatan" ? "peralatan" : "perlengkapan"}
                            </td>
                          </tr>
                        ) : (
                          (activeTab === "peralatan" ? peralatanData : perlengkapanData).map((item, i) => (
                            <tr key={item.kodeBarang} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 text-gray-600">{i + 1}</td>
                              <td className="px-4 py-3 font-mono text-gray-700">{item.kodeBarang}</td>
                              <td className="px-4 py-3 font-medium text-gray-800">{item.namaBarang}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  item.stokTersedia > 0
                                    ? "bg-green-100 text-green-800"
                                    : item.stokTersedia === 0
                                    ? "bg-gray-100 text-gray-600"
                                    : "bg-red-100 text-red-800"
                                }`}>
                                  {item.stokTersedia}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatRupiah(item.totalNilaiMasuk)}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatRupiah(item.totalNilaiKeluar)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatRupiah(item.totalNilaiMasuk - item.totalNilaiKeluar)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {activeTab === "riwayat" && (
              <div>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Dari Tanggal</label>
                      <input
                        type="date"
                        value={filterStart}
                        onChange={(e) => setFilterStart(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Sampai Tanggal</label>
                      <input
                        type="date"
                        value={filterEnd}
                        onChange={(e) => setFilterEnd(e.target.value)}
                        className="px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={exportRiwayatExcel}
                    className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-xl transition flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    Export Excel
                  </button>
                </div>

                {loading ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-green-800 text-white">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">No</th>
                          <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                          <th className="px-4 py-3 text-left font-semibold">Kode Barang</th>
                          <th className="px-4 py-3 text-left font-semibold">Nama Barang</th>
                          <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                          <th className="px-4 py-3 text-center font-semibold">Jenis</th>
                          <th className="px-4 py-3 text-center font-semibold">Jumlah</th>
                          <th className="px-4 py-3 text-right font-semibold">Harga Satuan</th>
                          <th className="px-4 py-3 text-right font-semibold">Total Harga</th>
                          <th className="px-4 py-3 text-center font-semibold">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredRiwayat.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                              Belum ada riwayat transaksi
                            </td>
                          </tr>
                        ) : (
                          filteredRiwayat.map((item, i) => (
                            <tr key={item.id} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 text-gray-600">{i + 1}</td>
                              <td className="px-4 py-3 text-gray-700">{item.tanggal}</td>
                              <td className="px-4 py-3 font-mono text-gray-700">{item.kodeBarang}</td>
                              <td className="px-4 py-3 font-medium text-gray-800">{item.namaBarang}</td>
                              <td className="px-4 py-3 text-gray-600">
                                {item.kategori === "peralatan" ? "Peralatan Kantor" : "Perlengkapan Kantor"}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  item.jenis === "masuk"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-red-100 text-red-800"
                                }`}>
                                  {item.jenis === "masuk" ? "Masuk" : "Keluar"}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-700">{item.jumlah}</td>
                              <td className="px-4 py-3 text-right text-gray-700">{formatRupiah(item.hargaSatuan)}</td>
                              <td className="px-4 py-3 text-right font-semibold text-gray-800">{formatRupiah(item.totalHarga)}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => openEdit(item)}
                                    className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg transition"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.id, item.namaBarang)}
                                    className="p-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                                    title="Hapus"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-green-800 to-green-700 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Edit Data Asset</h2>
              <button
                onClick={() => { setShowEditModal(false); setEditingItem(null); }}
                className="p-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-6 space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kode Barang</label>
                  <input
                    type="text"
                    value={editForm.kodeBarang}
                    onChange={(e) => handleEditChange("kodeBarang", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Barang</label>
                  <input
                    type="text"
                    value={editForm.namaBarang}
                    onChange={(e) => handleEditChange("namaBarang", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori</label>
                  <div className="flex rounded-xl overflow-hidden border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, kategori: "peralatan" }))}
                      className={`flex-1 py-2.5 text-sm font-medium transition ${
                        editForm.kategori === "peralatan"
                          ? "bg-green-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Peralatan
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, kategori: "perlengkapan" }))}
                      className={`flex-1 py-2.5 text-sm font-medium transition ${
                        editForm.kategori === "perlengkapan"
                          ? "bg-green-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Perlengkapan
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Jenis Transaksi</label>
                  <div className="flex rounded-xl overflow-hidden border border-gray-300">
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, jenis: "masuk" }))}
                      className={`flex-1 py-2.5 text-sm font-medium transition ${
                        editForm.jenis === "masuk"
                          ? "bg-blue-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Masuk
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((p) => ({ ...p, jenis: "keluar" }))}
                      className={`flex-1 py-2.5 text-sm font-medium transition ${
                        editForm.jenis === "keluar"
                          ? "bg-red-600 text-white"
                          : "bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      Keluar
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tanggal</label>
                <input
                  type="date"
                  value={editForm.tanggal}
                  onChange={(e) => handleEditChange("tanggal", e.target.value)}
                  className="w-full md:w-64 px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Jumlah Barang</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.jumlah}
                    onChange={(e) => handleEditChange("jumlah", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Harga Satuan</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.hargaSatuan}
                    onChange={(e) => handleEditChange("hargaSatuan", e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Total Harga</label>
                  <div className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-800 font-semibold">
                    {formatRupiah(editTotalHarga)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updating}
                  className="px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-xl transition disabled:opacity-50"
                >
                  {updating ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowEditModal(false); setEditingItem(null); }}
                  className="px-6 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}