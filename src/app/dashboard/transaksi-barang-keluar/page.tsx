"use client";

import React, { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

const MAX_STRING_LENGTH = 100;
const MAX_KODE_LENGTH = 50;
const MAX_JUMLAH = 999999;
const MIN_JUMLAH = 0.01;

function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function normalizeKode(kode: string): string {
  return kode.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, "");
}

interface StockItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  unit: "ZAK" | "DUS" | "KG" | "BOTOL";
  fot: string;
  bobotPerUnit: number;
  botolPerDus?: number;
  volumeMl?: number;
  stokAkhirUnit?: number;
  stokAkhirKG: number;
}

interface SopirNopolItem {
  id: number;
  namaSopir: string;
  nopol: string;
  nomorSIM: string;
}

export default function TransaksiBarangKeluarPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    kodeBarang: "",
    namaBarang: "",
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    jumlahZAK: "",
    botolPerDus: "",
    namaCustomer: "",
    nomorPI: "",
    nomorInvoice: "",
    nomorSuratPengangkutan: "",
    fot: "",
  });

  const [sopirNopolList, setSopirNopolList] = useState<SopirNopolItem[]>([
    { id: 1, namaSopir: "", nopol: "", nomorSIM: "" },
  ]);

  const [matchedStock, setMatchedStock] = useState<StockItem | null>(null);

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "KG", label: "KG" },
    { value: "BOTOL", label: "BOTOL" },
  ];

  useEffect(() => {
    fetchStockGudang();
  }, []);

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
        fot: doc.data().fot || "",
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        botolPerDus: doc.data().botolPerDus ?? undefined,
        volumeMl: doc.data().volumeMl ?? undefined,
        stokAkhirUnit: doc.data().stokAkhirUnit || 0,
        stokAkhirKG: doc.data().stokAkhirKG || 0,
      } as StockItem));
      setStockList(data);
    } catch (error) {
      console.error("Error fetching stock:", error);
    }
  };

  const findMatchingStock = useCallback((kode: string, nama: string) => {
    if (!kode.trim() || !nama.trim()) {
      setMatchedStock(null);
      return;
    }
    const kodeNormalized = normalizeKode(kode);
    const namaNormalized = sanitizeInput(nama).toUpperCase();
    const match = stockList.find(
      (s) =>
        s.kodeBarang.toUpperCase() === kodeNormalized &&
        s.namaBarang.toUpperCase() === namaNormalized
    );
    if (match) {
      setMatchedStock(match);
      setFormData((prev) => ({
        ...prev,
        unit: match.unit,
        fot: match.fot,
        botolPerDus: match.botolPerDus ? match.botolPerDus.toString() : "",
      }));
    } else {
      setMatchedStock(null);
    }
  }, [stockList]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "kodeBarang" || name === "namaBarang") {
        setTimeout(() => findMatchingStock(updated.kodeBarang, updated.namaBarang), 0);
      }
      return updated;
    });
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSopirChange = (id: number, field: "namaSopir" | "nopol" | "nomorSIM", value: string) => {
    const sanitized = field === "nopol" ? value.toUpperCase().replace(/[^A-Z0-9\\s]/g, "") : sanitizeInput(value);
    setSopirNopolList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: sanitized } : item))
    );
  };

  const addSopirNopol = () => {
    const newId = sopirNopolList.length > 0 ? Math.max(...sopirNopolList.map((s) => s.id)) + 1 : 1;
    setSopirNopolList((prev) => [...prev, { id: newId, namaSopir: "", nopol: "", nomorSIM: "" }]);
  };

  const removeSopirNopol = (id: number) => {
    if (sopirNopolList.length <= 1) return;
    setSopirNopolList((prev) => prev.filter((item) => item.id !== id));
  };

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";

    const kode = normalizeKode(formData.kodeBarang);
    if (!kode || kode.length < 3) newErrors.kodeBarang = "Kode barang wajib diisi (min 3 karakter)";
    if (kode.length > MAX_KODE_LENGTH) newErrors.kodeBarang = `Kode barang maksimal ${MAX_KODE_LENGTH} karakter`;

    const nama = sanitizeInput(formData.namaBarang);
    if (!nama || nama.length < 2) newErrors.namaBarang = "Nama barang wajib diisi (min 2 karakter)";
    if (nama.length > MAX_STRING_LENGTH) newErrors.namaBarang = `Nama barang maksimal ${MAX_STRING_LENGTH} karakter`;

    const jumlah = parseFloat(formData.jumlahZAK);
    if (!formData.jumlahZAK || isNaN(jumlah) || jumlah < MIN_JUMLAH || jumlah > MAX_JUMLAH) {
      newErrors.jumlahZAK = `Jumlah harus antara ${MIN_JUMLAH} dan ${MAX_JUMLAH}`;
    }

    const customer = sanitizeInput(formData.namaCustomer);
    if (!customer || customer.length < 2) newErrors.namaCustomer = "Nama customer wajib diisi (min 2 karakter)";
    if (customer.length > MAX_STRING_LENGTH) newErrors.namaCustomer = `Nama customer maksimal ${MAX_STRING_LENGTH} karakter`;

    const nomorPI = sanitizeInput(formData.nomorPI);
    if (!nomorPI || nomorPI.length < 2) newErrors.nomorPI = "No PI wajib diisi (min 2 karakter)";
    if (nomorPI.length > MAX_KODE_LENGTH) newErrors.nomorPI = `No PI maksimal ${MAX_KODE_LENGTH} karakter`;

    const nomorSurat = sanitizeInput(formData.nomorSuratPengangkutan);
    if (!nomorSurat || nomorSurat.length < 2) newErrors.nomorSuratPengangkutan = "Nomor Surat Pengangkutan wajib diisi (min 2 karakter)";
    if (nomorSurat.length > MAX_KODE_LENGTH) newErrors.nomorSuratPengangkutan = `Nomor Surat Pengangkutan maksimal ${MAX_KODE_LENGTH} karakter`;

    const fot = sanitizeInput(formData.fot);
    if (!fot || fot.length < 2) newErrors.fot = "FOT wajib diisi (min 2 karakter)";
    if (fot.length > MAX_STRING_LENGTH) newErrors.fot = `FOT maksimal ${MAX_STRING_LENGTH} karakter`;

    if (formData.unit === "BOTOL") {
      const botolPerDus = parseFloat(formData.botolPerDus);
      if (!formData.botolPerDus || isNaN(botolPerDus) || botolPerDus <= 0 || botolPerDus > 1000) {
        newErrors.botolPerDus = "Botol per DUS tidak valid (1-1000)";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const jumlahZAK = parseFloat(formData.jumlahZAK) || 0;
      const botolPerDus = formData.unit === "BOTOL" ? parseFloat(formData.botolPerDus) || 0 : null;
      const bobotPerUnit = matchedStock ? matchedStock.bobotPerUnit : 50;
      const bobotPerBotol = formData.unit === "BOTOL" ? 50 : null;
      const volumeMl = matchedStock?.volumeMl || 500;

      let totalKG = 0;
      if (formData.unit === "BOTOL") {
        const dusPerZak = 10;
        const totalBotol = jumlahZAK * dusPerZak * (botolPerDus || 1);
        totalKG = (totalBotol * (bobotPerBotol || 0)) / 1000;
      } else if (formData.unit === "KG") {
        totalKG = jumlahZAK;
      } else {
        totalKG = jumlahZAK * bobotPerUnit;
      }

      const sopirNopolValues = sopirNopolList
        .filter((s) => s.namaSopir.trim() || s.nopol.trim())
        .map((s) => ({
          namaSopir: s.namaSopir.trim() || null,
          nopol: s.nopol.trim() || null,
          nomorSIM: s.nomorSIM.trim() || null,
        }));

      const transaksiData: any = {
        tanggal: formData.tanggal,
        kodeBarang: normalizeKode(formData.kodeBarang),
        namaBarang: sanitizeInput(formData.namaBarang),
        unit: formData.unit,
        jumlahZAK: jumlahZAK,
        totalKG: totalKG,
        namaCustomer: sanitizeInput(formData.namaCustomer),
        nomorPI: sanitizeInput(formData.nomorPI).toUpperCase(),
        nomorInvoice: sanitizeInput(formData.nomorInvoice),
        sopirNopolList: sopirNopolValues.length > 0 ? sopirNopolValues : null,
        nomorSuratPengangkutan: sanitizeInput(formData.nomorSuratPengangkutan).toUpperCase(),
        fot: sanitizeInput(formData.fot).toUpperCase(),
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (formData.unit === "BOTOL") {
        transaksiData.botolPerDus = botolPerDus;
        transaksiData.bobotPerBotol = bobotPerBotol;
        transaksiData.volumeMl = volumeMl;
      }

      await addDoc(collection(db, "transaksiBarangKeluar"), transaksiData);

      if (matchedStock) {
        const stockRef = doc(db, "stockGudang", matchedStock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const currentData = stockSnap.data();
          const currentKeluarUnit = currentData.barangKeluarUnit || 0;
          const currentKeluarKG = currentData.barangKeluarKG || 0;
          const currentStokUnit = currentData.stokAkhirUnit || 0;
          const currentStokKG = currentData.stokAkhirKG || 0;

          let minusUnit = jumlahZAK;
          let minusKG = totalKG;

          if (formData.unit === "KG") {
            minusUnit = 0;
            minusKG = jumlahZAK;
          }

          await updateDoc(stockRef, {
            barangKeluarUnit: currentKeluarUnit + minusUnit,
            barangKeluarKG: currentKeluarKG + minusKG,
            stokAkhirUnit: currentStokUnit - minusUnit,
            stokAkhirKG: currentStokKG - minusKG,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setSuccessMessage("Transaksi barang keluar berhasil disimpan!");
      setFormData({
        tanggal: new Date().toISOString().split("T")[0],
        kodeBarang: "",
        namaBarang: "",
        unit: "ZAK",
        jumlahZAK: "",
        botolPerDus: "",
        namaCustomer: "",
        nomorPI: "",
        nomorInvoice: "",
        nomorSuratPengangkutan: "",
        fot: "",
      });
      setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
      setMatchedStock(null);

      fetchStockGudang();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({ submit: "Gagal menyimpan transaksi. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBotol = formData.unit === "BOTOL";

  const getJumlahLabel = () => {
    if (formData.unit === "KG") return "KG";
    if (formData.unit === "BOTOL") return "ZAK";
    return formData.unit;
  };

  const getStokWarning = () => {
    if (!matchedStock || !formData.jumlahZAK) return null;
    const jumlah = parseFloat(formData.jumlahZAK) || 0;
    const stokUnit = matchedStock.stokAkhirUnit || 0;
    const stokKG = matchedStock.stokAkhirKG || 0;

    let totalKG = 0;
    if (formData.unit === "BOTOL") {
      const dusPerZak = 10;
      const botolPerDus = parseFloat(formData.botolPerDus) || (matchedStock.botolPerDus || 20);
      const totalBotol = jumlah * dusPerZak * botolPerDus;
      totalKG = (totalBotol * 50) / 1000;
    } else if (formData.unit === "KG") {
      totalKG = jumlah;
    } else {
      totalKG = jumlah * matchedStock.bobotPerUnit;
    }

    const sisaUnit = stokUnit - jumlah;
    const sisaKG = stokKG - totalKG;

    if (sisaUnit < 0 || sisaKG < 0) {
      return {
        isNegative: true,
        sisaUnit,
        sisaKG,
        message: `Stok akan minus: ${sisaUnit.toLocaleString()} ${formData.unit === "KG" ? "KG" : formData.unit} (${sisaKG.toLocaleString()} KG)`
      };
    }
    return null;
  };

  const stokWarning = getStokWarning();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Header title="Transaksi Barang Keluar" subtitle="Input data barang keluar dari gudang" />

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

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <Card title="Informasi Transaksi">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Tanggal Keluar Barang" type="date" name="tanggal" value={formData.tanggal} onChange={handleChange} error={errors.tanggal} required />
            <Input label="Kode Barang" type="text" name="kodeBarang" value={formData.kodeBarang} onChange={handleChange} placeholder="Masukkan kode barang" error={errors.kodeBarang} required maxLength={MAX_KODE_LENGTH} />
            <Input label="Nama Barang" type="text" name="namaBarang" value={formData.namaBarang} onChange={handleChange} placeholder="Masukkan nama barang" error={errors.namaBarang} required maxLength={MAX_STRING_LENGTH} />
            <Select label="Unit" name="unit" value={formData.unit} onChange={handleChange} options={unitOptions} required />
            <Input label="FOT (Tempat Gudang)" type="text" name="fot" value={formData.fot} onChange={handleChange} placeholder="Masukkan nama FOT / lokasi gudang" error={errors.fot} required maxLength={MAX_STRING_LENGTH} />
          </div>

          {matchedStock && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl" role="status">
              <p className="text-sm text-blue-700 font-medium">
                Barang ditemukan di database: Stok tersedia {matchedStock.stokAkhirUnit?.toLocaleString()} {matchedStock.unit === "KG" ? "KG" : matchedStock.unit} ({matchedStock.stokAkhirKG.toLocaleString()} KG)
              </p>
              <p className="text-xs text-blue-600 mt-1">Unit, FOT, dan bobot otomatis disesuaikan dari data gudang. Stok akan berkurang setelah disimpan.</p>
            </div>
          )}
        </Card>

        <Card title="Detail Barang Keluar">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label={`Jumlah Barang (${getJumlahLabel()})`} type="number" name="jumlahZAK" value={formData.jumlahZAK} onChange={handleChange} placeholder={`Masukkan jumlah dalam ${getJumlahLabel()}`} error={errors.jumlahZAK} required min={MIN_JUMLAH} max={MAX_JUMLAH} step="0.01" />

            {isBotol && (
              <Input label="Botol per DUS" type="number" name="botolPerDus" value={formData.botolPerDus} onChange={handleChange} placeholder="Contoh: 20" error={errors.botolPerDus} required min={1} max={1000} />
            )}

            <Input label="Nama Customer" type="text" name="namaCustomer" value={formData.namaCustomer} onChange={handleChange} placeholder="Masukkan nama customer" error={errors.namaCustomer} required maxLength={MAX_STRING_LENGTH} />
            <Input label="No PI / Proforma Invoice" type="text" name="nomorPI" value={formData.nomorPI} onChange={handleChange} placeholder="Contoh: PI-0675" error={errors.nomorPI} required maxLength={MAX_KODE_LENGTH} />
            <Input label="No Invoice (Opsional)" type="text" name="nomorInvoice" value={formData.nomorInvoice} onChange={handleChange} placeholder="Masukkan nomor invoice" error={errors.nomorInvoice} maxLength={MAX_KODE_LENGTH} />
            <Input label="Nomor Surat Pengangkutan" type="text" name="nomorSuratPengangkutan" value={formData.nomorSuratPengangkutan} onChange={handleChange} placeholder="Masukkan nomor surat pengangkutan" error={errors.nomorSuratPengangkutan} required maxLength={MAX_KODE_LENGTH} />
          </div>
        </Card>

        {matchedStock && formData.jumlahZAK && (
          <Card title="Preview & Validasi Stok">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-600 uppercase tracking-wide font-semibold mb-1">Stok Tersedia</p>
                <p className="text-xl font-bold text-green-700 font-mono">{matchedStock.stokAkhirUnit?.toLocaleString()} {formData.unit === "KG" ? "KG" : formData.unit}</p>
                <p className="text-sm text-green-600">{matchedStock.stokAkhirKG.toLocaleString()} KG</p>
              </div>
              <div className={`p-4 rounded-xl border ${stokWarning?.isNegative ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
                <p className={`text-xs uppercase tracking-wide font-semibold mb-1 ${stokWarning?.isNegative ? "text-red-600" : "text-amber-600"}`}>Jumlah Keluar</p>
                <p className={`text-xl font-bold font-mono ${stokWarning?.isNegative ? "text-red-700" : "text-amber-700"}`}>{parseFloat(formData.jumlahZAK).toLocaleString()} {getJumlahLabel()}</p>
                <p className={`text-sm ${stokWarning?.isNegative ? "text-red-600" : "text-amber-600"}`}>
                  {formData.unit === "BOTOL"
                    ? `${((parseFloat(formData.jumlahZAK) || 0) * 10 * (parseFloat(formData.botolPerDus) || (matchedStock.botolPerDus || 20)) * 50 / 1000).toLocaleString()} KG`
                    : formData.unit === "KG"
                    ? `${parseFloat(formData.jumlahZAK).toLocaleString()} KG`
                    : `${((parseFloat(formData.jumlahZAK) || 0) * matchedStock.bobotPerUnit).toLocaleString()} KG`
                  }
                </p>
              </div>
            </div>

            {stokWarning?.isNegative && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl" role="alert">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm font-bold text-red-700">PERINGATAN: Stok Tidak Mencukupi</p>
                </div>
                <p className="text-sm text-red-600">Stok akan menjadi minus setelah transaksi ini. Sisa stok yang dihitung:</p>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white rounded-lg border border-red-100">
                    <p className="text-xs text-red-500">Sisa Unit</p>
                    <p className="text-lg font-bold text-red-700 font-mono">{stokWarning.sisaUnit.toLocaleString()} {formData.unit === "KG" ? "KG" : formData.unit}</p>
                  </div>
                  <div className="p-3 bg-white rounded-lg border border-red-100">
                    <p className="text-xs text-red-500">Sisa KG</p>
                    <p className="text-lg font-bold text-red-700 font-mono">{stokWarning.sisaKG.toLocaleString()} KG</p>
                  </div>
                </div>
                <p className="text-xs text-red-500 mt-2">Transaksi tetap bisa disimpan. Stok akan tertulis minus di laporan stock gudang.</p>
              </div>
            )}

            {formData.unit === "BOTOL" && (
              <p className="text-xs text-amber-500 mt-2">Perhitungan: {formData.jumlahZAK} ZAK x 10 DUS/ZAK x {formData.botolPerDus || matchedStock.botolPerDus || 0} botol/DUS x 50 ml / 1000 = KG</p>
            )}
            {formData.unit !== "BOTOL" && formData.unit !== "KG" && (
              <p className="text-xs text-amber-500 mt-2">Perhitungan: {formData.jumlahZAK} {formData.unit} x {matchedStock.bobotPerUnit} KG/{formData.unit}</p>
            )}
          </Card>
        )}

        <Card title="Sopir & Nopol (Opsional)">
          <div className="space-y-6">
            {sopirNopolList.map((item, index) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">{index === 0 ? "Sopir & Kendaraan Utama" : `Sopir & Kendaraan ${index + 1}`}</h4>
                  {sopirNopolList.length > 1 && (
                    <button type="button" onClick={() => removeSopirNopol(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" aria-label={`Hapus sopir ${index + 1}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input label="Nama Sopir" type="text" value={item.namaSopir} onChange={(e) => handleSopirChange(item.id, "namaSopir", e.target.value)} placeholder="Contoh: Budi Santoso" maxLength={MAX_STRING_LENGTH} />
                  <Input label="Nomor Polisi" type="text" value={item.nopol} onChange={(e) => handleSopirChange(item.id, "nopol", e.target.value)} placeholder="Contoh: B 1234 ABC" maxLength={20} />
                  <Input label="Nomor SIM" type="text" value={item.nomorSIM} onChange={(e) => handleSopirChange(item.id, "nomorSIM", e.target.value)} placeholder="Contoh: 1234567890" maxLength={20} />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSopirNopol}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Sopir & Kendaraan
            </Button>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => {
            setFormData({ tanggal: new Date().toISOString().split("T")[0], kodeBarang: "", namaBarang: "", unit: "ZAK", jumlahZAK: "", botolPerDus: "", namaCustomer: "", nomorPI: "", nomorInvoice: "", nomorSuratPengangkutan: "", fot: "" });
            setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
            setMatchedStock(null);
            setErrors({});
          }}>
            Reset Form
          </Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            Simpan Transaksi Keluar
          </Button>
        </div>
      </form>
    </div>
  );
}