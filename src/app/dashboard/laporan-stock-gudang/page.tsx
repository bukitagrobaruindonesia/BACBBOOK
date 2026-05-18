"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Table from "@/app/components/ui/Table";
import { StockGudang } from "@/app/types";

const KODE_BARANG_MIN_LENGTH = 3;
const KODE_BARANG_MAX_LENGTH = 50;
const NAMA_BARANG_MAX_LENGTH = 100;
const FOT_MAX_LENGTH = 50;
const MAX_STOK_VALUE = 999999;

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function normalizeKodeBarang(kode: string): string {
  return kode.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, "");
}

export default function LaporanInputStockGudangPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockGudang[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFot, setFilterFot] = useState("");

  const [formData, setFormData] = useState({
    fot: "",
    kodeBarang: "",
    namaBarang: "",
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    bobotPerUnit: "50",
    stokTersediaUnit: "",
    botolPerDus: "20",
    volumeMl: "500",
  });

  const [fotList, setFotList] = useState<string[]>([]);
  const [isNewFot, setIsNewFot] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateKodeBarang, setDuplicateKodeBarang] = useState("");

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "KG", label: "KG" },
    { value: "BOTOL", label: "BOTOL" },
  ];

  useEffect(() => {
    fetchStockGudang();
    fetchFotList();
  }, []);

  const fetchFotList = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("fot", "asc"));
      const snapshot = await getDocs(q);
      const fotSet = new Set<string>();
      snapshot.docs.forEach((doc) => {
        const fot = doc.data().fot;
        if (fot && typeof fot === "string" && fot.trim()) {
          fotSet.add(fot.trim().toUpperCase());
        }
      });
      setFotList(Array.from(fotSet));
    } catch (error) {
      console.error("Error fetching FOT list:", error);
    }
  };

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("kodeBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as StockGudang));
      setStockList(data);
    } catch (error) {
      console.error("Error fetching stock:", error);
    }
  };

  const checkDuplicateKodeBarang = async (kodeBarang: string): Promise<boolean> => {
    const normalized = normalizeKodeBarang(kodeBarang);
    if (normalized.length < KODE_BARANG_MIN_LENGTH) return false;

    try {
      const q = query(collection(db, "stockGudang"), where("kodeBarang", "==", normalized));
      const snapshot = await getDocs(q);

      if (isEditing && editId) {
        const duplicateDocs = snapshot.docs.filter((d) => d.id !== editId);
        return duplicateDocs.length > 0;
      }

      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking duplicate:", error);
      return false;
    }
  };

  const handleKodeBarangChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const sanitized = value.replace(/[^a-zA-Z0-9-_]/g, "").toUpperCase();

    setFormData((prev) => ({ ...prev, kodeBarang: sanitized }));

    if (errors.kodeBarang) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.kodeBarang;
        return newErrors;
      });
    }

    if (sanitized.length >= KODE_BARANG_MIN_LENGTH) {
      const isDuplicate = await checkDuplicateKodeBarang(sanitized);
      if (isDuplicate) {
        setDuplicateKodeBarang(sanitized);
        setShowDuplicateModal(true);
        setFormData((prev) => ({ ...prev, kodeBarang: "" }));
      }
    }
  };

  const getDisplayUnit = () => {
    if (formData.unit === "BOTOL") return "ZAK";
    return formData.unit;
  };

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    const fot = sanitizeInput(formData.fot);
    if (!fot || fot.length < 2) newErrors.fot = "FOT wajib diisi (min 2 karakter)";
    if (fot.length > FOT_MAX_LENGTH) newErrors.fot = `FOT maksimal ${FOT_MAX_LENGTH} karakter`;

    const kodeBarang = normalizeKodeBarang(formData.kodeBarang);
    if (!kodeBarang || kodeBarang.length < KODE_BARANG_MIN_LENGTH) {
      newErrors.kodeBarang = `Kode barang wajib diisi (min ${KODE_BARANG_MIN_LENGTH} karakter)`;
    }
    if (kodeBarang.length > KODE_BARANG_MAX_LENGTH) {
      newErrors.kodeBarang = `Kode barang maksimal ${KODE_BARANG_MAX_LENGTH} karakter`;
    }

    const namaBarang = sanitizeInput(formData.namaBarang);
    if (!namaBarang || namaBarang.length < 2) newErrors.namaBarang = "Nama barang wajib diisi (min 2 karakter)";
    if (namaBarang.length > NAMA_BARANG_MAX_LENGTH) newErrors.namaBarang = `Nama barang maksimal ${NAMA_BARANG_MAX_LENGTH} karakter`;

    const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";
    const isBotol = formData.unit === "BOTOL";

    if (isUnitBased && !isBotol) {
      const bobot = parseFloat(formData.bobotPerUnit);
      if (!formData.bobotPerUnit || isNaN(bobot) || bobot <= 0 || bobot > 1000) {
        newErrors.bobotPerUnit = "Bobot per unit tidak valid (1-1000 KG)";
      }
    }

    const stok = parseFloat(formData.stokTersediaUnit);
    if (!formData.stokTersediaUnit || isNaN(stok) || stok < -MAX_STOK_VALUE || stok > MAX_STOK_VALUE) {
      newErrors.stokTersediaUnit = `Stok tersedia tidak valid (-${MAX_STOK_VALUE} sampai ${MAX_STOK_VALUE})`;
    }

    if (isBotol) {
      const botolPerDus = parseFloat(formData.botolPerDus);
      if (!formData.botolPerDus || isNaN(botolPerDus) || botolPerDus <= 0 || botolPerDus > 1000) {
        newErrors.botolPerDus = "Jumlah botol per dus tidak valid (1-1000)";
      }
      const volume = parseFloat(formData.volumeMl);
      if (!formData.volumeMl || isNaN(volume) || volume <= 0 || volume > 10000) {
        newErrors.volumeMl = "Volume tidak valid (1-10000 ml)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const isDuplicate = await checkDuplicateKodeBarang(formData.kodeBarang);
    if (isDuplicate) {
      setDuplicateKodeBarang(normalizeKodeBarang(formData.kodeBarang));
      setShowDuplicateModal(true);
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const isBotol = formData.unit === "BOTOL";
      const isKG = formData.unit === "KG";
      const isZAK = formData.unit === "ZAK";
      const stokTersediaUnit = parseFloat(formData.stokTersediaUnit) || 0;
      const bobotPerUnit = isBotol ? 50 : (parseFloat(formData.bobotPerUnit) || 50);
      const botolPerDus = isBotol ? parseFloat(formData.botolPerDus) || 20 : null;

      const hitungStokAwalKG = () => {
        if (isKG) return 0;
        if (isZAK) return stokTersediaUnit * bobotPerUnit;
        return 0;
      };

      const stokAwalKG = hitungStokAwalKG();
      const stokAkhirUnit = isKG ? 0 : stokTersediaUnit;
      const stokAkhirKG = stokAwalKG;

      if (isEditing && editId) {
        const docData: any = {
          fot: sanitizeInput(formData.fot).toUpperCase(),
          kodeBarang: normalizeKodeBarang(formData.kodeBarang),
          namaBarang: sanitizeInput(formData.namaBarang),
          unit: formData.unit,
          bobotPerUnit: bobotPerUnit,
          updatedAt: serverTimestamp(),
        };

        if (isBotol) {
          docData.botolPerDus = botolPerDus;
          docData.volumeMl = parseFloat(formData.volumeMl) || 500;
          docData.displayUnit = "ZAK";
        }

        await updateDoc(doc(db, "stockGudang", editId), docData);
        setSuccessMessage("Data stock gudang berhasil diperbarui!");
      } else {
        const docData: any = {
          fot: sanitizeInput(formData.fot).toUpperCase(),
          kodeBarang: normalizeKodeBarang(formData.kodeBarang),
          namaBarang: sanitizeInput(formData.namaBarang),
          unit: formData.unit,
          bobotPerUnit: bobotPerUnit,
          stokAwalUnit: isKG ? 0 : stokTersediaUnit,
          stokAwalKG: stokAwalKG,
          barangMasukUnit: 0,
          barangMasukKG: 0,
          barangKeluarUnit: 0,
          barangKeluarKG: 0,
          stokAkhirUnit: stokAkhirUnit,
          stokAkhirKG: stokAkhirKG,
          createdBy: user?.nama || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        if (isBotol) {
          docData.botolPerDus = botolPerDus;
          docData.volumeMl = parseFloat(formData.volumeMl) || 500;
          docData.displayUnit = "ZAK";
        }

        await addDoc(collection(db, "stockGudang"), docData);
        setSuccessMessage("Stock gudang berhasil disimpan!");
      }

      resetForm();
      fetchStockGudang();
      fetchFotList();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (stock: StockGudang) => {
    setIsEditing(true);
    setEditId(stock.id);
    setFormData({
      fot: stock.fot,
      kodeBarang: stock.kodeBarang,
      namaBarang: stock.namaBarang,
      unit: stock.unit,
      bobotPerUnit: stock.bobotPerUnit?.toString() || "50",
      stokTersediaUnit: stock.stokAkhirUnit?.toString() || "",
      botolPerDus: stock.botolPerDus?.toString() || "20",
      volumeMl: stock.volumeMl?.toString() || "500",
    });
    setIsNewFot(!fotList.includes(stock.fot));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "stockGudang", id));
      setSuccessMessage("Data stock gudang berhasil dihapus!");
      setShowDeleteConfirm(null);
      fetchStockGudang();
      fetchFotList();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Delete error:", error);
      setErrors({ submit: "Gagal menghapus data. Silakan coba lagi." });
    }
  };

  const resetForm = () => {
    setFormData({
      fot: "",
      kodeBarang: "",
      namaBarang: "",
      unit: "ZAK",
      bobotPerUnit: "50",
      stokTersediaUnit: "",
      botolPerDus: "20",
      volumeMl: "500",
    });
    setIsNewFot(false);
    setIsEditing(false);
    setEditId(null);
    setErrors({});
    setShowDuplicateModal(false);
    setDuplicateKodeBarang("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const fotOptions = [
    { value: "", label: "Pilih atau tambah FOT..." },
    ...fotList.map((f) => ({ value: f, label: f })),
    { value: "__new__", label: "+ Tambah FOT Baru" },
  ];

  const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";
  const isBotol = formData.unit === "BOTOL";

  const filteredStockList = stockList.filter((stock) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      stock.namaBarang.toLowerCase().includes(searchLower) ||
      stock.kodeBarang.toLowerCase().includes(searchLower) ||
      stock.fot.toLowerCase().includes(searchLower);
    const matchesFot = filterFot ? stock.fot === filterFot : true;
    return matchesSearch && matchesFot;
  });

  const uniqueFotList = Array.from(new Set(stockList.map((s) => s.fot))).sort();

  const getDisplayUnitLabel = (unit: string) => {
    if (unit === "BOTOL") return "ZAK";
    return unit;
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

  const columns = [
    {
      key: "fot",
      header: "FOT",
      width: "100px",
      render: (row: StockGudang) => (
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">
          {row.fot}
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
        <span
          className={`px-2 py-1 rounded-md text-xs font-bold ${
            row.unit === "ZAK"
              ? "bg-blue-100 text-blue-700"
              : row.unit === "DUS"
              ? "bg-purple-100 text-purple-700"
              : row.unit === "BOTOL"
              ? "bg-pink-100 text-pink-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {row.unit}
        </span>
      ),
    },
    {
      key: "konversi",
      header: "Konversi",
      width: "140px",
      render: (row: StockGudang) => {
        if (row.unit === "BOTOL") {
          return (
            <div className="text-xs">
              <p className="font-mono text-pink-600">{row.botolPerDus || 20} botol/DUS</p>
              <p className="font-mono text-pink-500">{row.volumeMl || 500} ml/botol</p>
            </div>
          );
        }
        return (
          <span className="font-mono text-gray-600">
            {row.unit === "KG" ? "-" : `${row.bobotPerUnit?.toLocaleString()} KG`}
          </span>
        );
      },
    },
    {
      key: "stokAwal",
      header: "Stok Awal",
      width: "120px",
      render: (row: StockGudang) => (
        <div className="text-xs">
          {row.unit !== "KG" && (
            <p className="font-mono text-gray-600">
              {row.stokAwalUnit?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} {getDisplayUnitLabel(row.unit)}
            </p>
          )}
          <p className="font-mono text-gray-500">{hitungStokAwalKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
        </div>
      ),
    },
    {
      key: "barangMasuk",
      header: "Masuk",
      width: "100px",
      render: (row: StockGudang) => (
        <div className="text-xs">
          {row.unit !== "KG" && (
            <p className="font-mono text-green-600">
              +{row.barangMasukUnit?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} {getDisplayUnitLabel(row.unit)}
            </p>
          )}
          <p className="font-mono text-green-500">+{row.barangMasukKG?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
        </div>
      ),
    },
    {
      key: "barangKeluar",
      header: "Keluar",
      width: "100px",
      render: (row: StockGudang) => (
        <div className="text-xs">
          {row.unit !== "KG" && (
            <p className="font-mono text-red-600">
              -{row.barangKeluarUnit?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} {getDisplayUnitLabel(row.unit)}
            </p>
          )}
          <p className="font-mono text-red-500">-{row.barangKeluarKG?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
        </div>
      ),
    },
    {
      key: "stokAkhir",
      header: "Stok Akhir",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {row.unit !== "KG" && (
            <p className="font-mono font-bold text-green-700">
              {row.stokAkhirUnit?.toLocaleString("id-ID", { maximumFractionDigits: 10 })} {getDisplayUnitLabel(row.unit)}
            </p>
          )}
          <p className="font-mono font-bold text-green-600">{hitungStokAkhirKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
        </div>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "120px",
      render: (row: StockGudang) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
            aria-label={`Edit ${row.namaBarang}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(row.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus"
            aria-label={`Hapus ${row.namaBarang}`}
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <Header title="Laporan & Input Stock Gudang" subtitle="Kelola data stock barang per FOT" />

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700" role="alert">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700" role="alert">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{errors.submit}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <Card
              title={isEditing ? "Edit Stock Gudang" : "Input Stock Gudang"}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">FOT (Tempat Gudang)</label>
                  <Select
                    name="fot"
                    value={isNewFot ? "__new__" : formData.fot}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "__new__") {
                        setIsNewFot(true);
                        setFormData((prev) => ({ ...prev, fot: "" }));
                      } else {
                        setIsNewFot(false);
                        setFormData((prev) => ({ ...prev, fot: value }));
                      }
                    }}
                    options={fotOptions}
                  />
                  {isNewFot && (
                    <Input
                      type="text"
                      name="fot"
                      value={formData.fot}
                      onChange={handleChange}
                      placeholder="Masukkan nama FOT baru"
                      error={errors.fot}
                      className="mt-2"
                      maxLength={FOT_MAX_LENGTH}
                    />
                  )}
                  {!isNewFot && errors.fot && <p className="mt-1 text-sm text-red-600">{errors.fot}</p>}
                </div>

                <Input
                  label="Kode Barang"
                  type="text"
                  name="kodeBarang"
                  value={formData.kodeBarang}
                  onChange={handleKodeBarangChange}
                  placeholder="Contoh: PUP-001"
                  error={errors.kodeBarang}
                  required
                  maxLength={KODE_BARANG_MAX_LENGTH}
                />

                <Input
                  label="Nama Barang"
                  type="text"
                  name="namaBarang"
                  value={formData.namaBarang}
                  onChange={handleChange}
                  placeholder="Contoh: Pupuk Urea"
                  error={errors.namaBarang}
                  required
                  maxLength={NAMA_BARANG_MAX_LENGTH}
                />

                <Select label="Unit" name="unit" value={formData.unit} onChange={handleChange} options={unitOptions} required />

                {isUnitBased && !isBotol && (
                  <Input
                    label="Bobot Per Unit (KG)"
                    type="number"
                    name="bobotPerUnit"
                    value={formData.bobotPerUnit}
                    onChange={handleChange}
                    placeholder="Contoh: 50"
                    error={errors.bobotPerUnit}
                    required
                    min={1}
                    max={1000}
                    step="0.01"
                  />
                )}

                {isBotol && (
                  <>
                    <Input
                      label="Botol Per DUS"
                      type="number"
                      name="botolPerDus"
                      value={formData.botolPerDus}
                      onChange={handleChange}
                      placeholder="Contoh: 20"
                      error={errors.botolPerDus}
                      required
                      min={1}
                      max={1000}
                    />
                    <Input
                      label="Volume (ml)"
                      type="number"
                      name="volumeMl"
                      value={formData.volumeMl}
                      onChange={handleChange}
                      placeholder="Contoh: 500"
                      error={errors.volumeMl}
                      required
                      min={1}
                      max={10000}
                    />
                  </>
                )}

                {!isEditing && (
                  <Input
                    label={`Stok Tersedia (${getDisplayUnit()})`}
                    type="number"
                    name="stokTersediaUnit"
                    value={formData.stokTersediaUnit}
                    onChange={handleChange}
                    placeholder={`Masukkan stok tersedia dalam ${getDisplayUnit()}`}
                    error={errors.stokTersediaUnit}
                    required
                    min={-MAX_STOK_VALUE}
                    max={MAX_STOK_VALUE}
                    step="0.01"
                  />
                )}

                {formData.stokTersediaUnit && !isEditing && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">Preview Stok</p>
                    <p className="text-3xl font-bold text-amber-700 font-mono">
                      {parseFloat(formData.stokTersediaUnit).toLocaleString("id-ID", { maximumFractionDigits: 10 })} {getDisplayUnit()}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex items-center justify-end gap-4">
              {isEditing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Batal Edit
                </Button>
              )}
              <Button type="button" variant="outline" onClick={resetForm}>
                Reset Form
              </Button>
              <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
                {isEditing ? "Update Stock" : "Simpan Stock"}
              </Button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <Card
            title={`Data Stock Gudang (${filteredStockList.length} item)`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            }
          >
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Cari nama barang, kode, atau FOT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                  maxLength={100}
                />
              </div>
              <div className="sm:w-48">
                <Select
                  value={filterFot}
                  onChange={(e) => setFilterFot(e.target.value)}
                  options={[
                    { value: "", label: "Semua FOT" },
                    ...uniqueFotList.map((f) => ({ value: f, label: f })),
                  ]}
                />
              </div>
            </div>

            <Table columns={columns} data={filteredStockList} isLoading={false} emptyMessage="Belum ada data stock gudang" keyExtractor={(row) => row.id} />
          </Card>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6">Apakah Anda yakin ingin menghapus data stock ini? Tindakan ini tidak dapat dibatalkan.</p>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                Batal
              </Button>
              <Button type="button" variant="primary" className="bg-red-600 hover:bg-red-700" onClick={() => handleDelete(showDeleteConfirm)}>
                Hapus Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Kode Barang Sudah Ada</h3>
            </div>
            <p className="text-gray-600 mb-2">
              Kode barang <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded">{duplicateKodeBarang}</span> sudah terdaftar di database.
            </p>
            <p className="text-gray-500 text-sm mb-6">Silakan gunakan kode barang yang berbeda atau edit data yang sudah ada melalui tabel di samping.</p>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="primary" className="bg-amber-600 hover:bg-amber-700" onClick={() => setShowDuplicateModal(false)}>
                Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}