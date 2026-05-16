"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

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

export default function TransaksiBarangMasukPage() {
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
    fot: "",
  });

  const [sopirNopolList, setSopirNopolList] = useState<SopirNopolItem[]>([
    { id: 1, namaSopir: "", nopol: "", nomorSIM: "" },
  ]);

  const [matchedStock, setMatchedStock] = useState<StockItem | null>(null);
  const [showNewStockModal, setShowNewStockModal] = useState(false);
  const [newStockData, setNewStockData] = useState({
    bobotPerUnit: "50",
    stokTersediaUnit: "",
    botolPerDus: "20",
    volumeMl: "500",
  });

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
      console.error(error);
    }
  };

  const findMatchingStock = (kode: string, nama: string) => {
    if (!kode.trim() || !nama.trim()) {
      setMatchedStock(null);
      return;
    }
    const kodeNormalized = kode.trim().toUpperCase();
    const namaNormalized = nama.trim().toUpperCase();
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
  };

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
    setSopirNopolList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.kodeBarang.trim()) newErrors.kodeBarang = "Kode barang wajib diisi";
    if (!formData.namaBarang.trim()) newErrors.namaBarang = "Nama barang wajib diisi";
    if (!formData.jumlahZAK || parseFloat(formData.jumlahZAK) <= 0) newErrors.jumlahZAK = "Jumlah harus lebih dari 0";
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";

    if (formData.unit === "BOTOL") {
      if (!formData.botolPerDus || parseFloat(formData.botolPerDus) <= 0) newErrors.botolPerDus = "Botol per DUS tidak valid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateNewStockForm = () => {
    const newErrors: Record<string, string> = {};
    const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";
    const isBotol = formData.unit === "BOTOL";

    if (isUnitBased && !isBotol) {
      if (!newStockData.bobotPerUnit || parseFloat(newStockData.bobotPerUnit) <= 0)
        newErrors.bobotPerUnit = "Bobot per unit tidak valid";
    }

    if (!newStockData.stokTersediaUnit || isNaN(parseFloat(newStockData.stokTersediaUnit)))
      newErrors.stokTersediaUnit = "Stok tersedia tidak valid";

    if (isBotol) {
      if (!newStockData.botolPerDus || parseFloat(newStockData.botolPerDus) <= 0)
        newErrors.botolPerDus = "Jumlah botol per dus tidak valid";
      if (!newStockData.volumeMl || parseFloat(newStockData.volumeMl) <= 0)
        newErrors.volumeMl = "Volume tidak valid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const createNewStockInGudang = async () => {
    if (!validateNewStockForm()) return false;

    try {
      const isBotol = formData.unit === "BOTOL";
      const isKG = formData.unit === "KG";
      const isZAK = formData.unit === "ZAK";
      const stokTersediaUnit = parseFloat(newStockData.stokTersediaUnit) || 0;
      const bobotPerUnit = isBotol ? 50 : (parseFloat(newStockData.bobotPerUnit) || 50);
      const botolPerDus = isBotol ? parseFloat(newStockData.botolPerDus) || 20 : null;

      const hitungStokAwalKG = () => {
        if (isKG) return 0;
        if (isZAK) return stokTersediaUnit * bobotPerUnit;
        return 0;
      };

      const stokAwalKG = hitungStokAwalKG();
      const stokAkhirUnit = isKG ? 0 : stokTersediaUnit;
      const stokAkhirKG = stokAwalKG;

      const docData: any = {
        fot: formData.fot.trim().toUpperCase(),
        kodeBarang: formData.kodeBarang.trim().toUpperCase(),
        namaBarang: formData.namaBarang.trim(),
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
        docData.volumeMl = parseFloat(newStockData.volumeMl) || 500;
        docData.displayUnit = "ZAK";
      }

      const docRef = await addDoc(collection(db, "stockGudang"), docData);

      const newStockItem: StockItem = {
        id: docRef.id,
        kodeBarang: formData.kodeBarang.trim().toUpperCase(),
        namaBarang: formData.namaBarang.trim(),
        unit: formData.unit,
        fot: formData.fot.trim().toUpperCase(),
        bobotPerUnit: bobotPerUnit,
        botolPerDus: isBotol && botolPerDus !== null ? botolPerDus : undefined,
        volumeMl: isBotol ? parseFloat(newStockData.volumeMl) || 500 : undefined,
        stokAkhirUnit: stokAkhirUnit,
        stokAkhirKG: stokAkhirKG,
      };

      setMatchedStock(newStockItem);
      setStockList((prev) => [...prev, newStockItem]);
      setShowNewStockModal(false);
      setNewStockData({
        bobotPerUnit: "50",
        stokTersediaUnit: "",
        botolPerDus: "20",
        volumeMl: "500",
      });

      return true;
    } catch (error) {
      console.error("Error creating new stock:", error);
      setErrors({ submit: "Gagal membuat data stock baru. Silakan coba lagi." });
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const kodeNormalized = formData.kodeBarang.trim().toUpperCase();
    const namaNormalized = formData.namaBarang.trim().toUpperCase();
    const existingStock = stockList.find(
      (s) =>
        s.kodeBarang.toUpperCase() === kodeNormalized &&
        s.namaBarang.toUpperCase() === namaNormalized
    );

    if (!existingStock) {
      setShowNewStockModal(true);
      return;
    }

    await processTransaksi();
  };

  const processTransaksi = async () => {
    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const jumlahZAK = parseFloat(formData.jumlahZAK) || 0;
      const botolPerDus = formData.unit === "BOTOL" ? parseFloat(formData.botolPerDus) || 0 : null;
      const bobotPerUnit = matchedStock ? matchedStock.bobotPerUnit : 50;
      const bobotPerBotol = formData.unit === "BOTOL" ? 50 : null;

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
        kodeBarang: formData.kodeBarang.trim(),
        namaBarang: formData.namaBarang.trim(),
        unit: formData.unit,
        jumlahZAK: jumlahZAK,
        totalKG: totalKG,
        sopirNopolList: sopirNopolValues.length > 0 ? sopirNopolValues : null,
        fot: formData.fot.trim().toUpperCase(),
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (formData.unit === "BOTOL") {
        transaksiData.botolPerDus = botolPerDus;
        transaksiData.bobotPerBotol = bobotPerBotol;
      }

      await addDoc(collection(db, "transaksiBarangMasuk"), transaksiData);

      if (matchedStock) {
        const stockRef = doc(db, "stockGudang", matchedStock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const currentData = stockSnap.data();
          const currentMasukUnit = currentData.barangMasukUnit || 0;
          const currentMasukKG = currentData.barangMasukKG || 0;
          const currentStokUnit = currentData.stokAkhirUnit || 0;
          const currentStokKG = currentData.stokAkhirKG || 0;

          let addUnit = jumlahZAK;
          let addKG = totalKG;

          if (formData.unit === "KG") {
            addUnit = 0;
            addKG = jumlahZAK;
          }

          await updateDoc(stockRef, {
            barangMasukUnit: currentMasukUnit + addUnit,
            barangMasukKG: currentMasukKG + addKG,
            stokAkhirUnit: currentStokUnit + addUnit,
            stokAkhirKG: currentStokKG + addKG,
            updatedAt: serverTimestamp(),
          });
        }
      }

      setSuccessMessage("Transaksi barang masuk berhasil disimpan!");
      setFormData({
        tanggal: new Date().toISOString().split("T")[0],
        kodeBarang: "",
        namaBarang: "",
        unit: "ZAK",
        jumlahZAK: "",
        botolPerDus: "",
        fot: "",
      });
      setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
      setMatchedStock(null);

      fetchStockGudang();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan transaksi. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateStockAndSubmit = async () => {
    const success = await createNewStockInGudang();
    if (success) {
      await processTransaksi();
    }
  };

  const isBotol = formData.unit === "BOTOL";
  const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Header
        title="Transaksi Barang Masuk"
        subtitle="Input data barang masuk ke gudang"
      />

      {successMessage && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3 text-green-700">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errors.submit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{errors.submit}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Informasi Transaksi">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Tanggal Barang Masuk"
              type="date"
              name="tanggal"
              value={formData.tanggal}
              onChange={handleChange}
              error={errors.tanggal}
              required
            />

            <Input
              label="Kode Barang"
              type="text"
              name="kodeBarang"
              value={formData.kodeBarang}
              onChange={handleChange}
              placeholder="Masukkan kode barang"
              error={errors.kodeBarang}
              required
            />

            <Input
              label="Nama Barang"
              type="text"
              name="namaBarang"
              value={formData.namaBarang}
              onChange={handleChange}
              placeholder="Masukkan nama barang"
              error={errors.namaBarang}
              required
            />

            <Select
              label="Unit"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              options={unitOptions}
              required
            />

            <Input
              label="FOT (Tempat Gudang)"
              type="text"
              name="fot"
              value={formData.fot}
              onChange={handleChange}
              placeholder="Masukkan nama FOT / lokasi gudang"
              error={errors.fot}
              required
            />
          </div>

          {matchedStock && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-700 font-medium">
                Barang ditemukan di database: Stok tersedia {matchedStock.stokAkhirUnit?.toLocaleString()} {matchedStock.unit} ({matchedStock.stokAkhirKG.toLocaleString()} KG)
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Unit, FOT, dan bobot otomatis disesuaikan dari data gudang
              </p>
            </div>
          )}

          {!matchedStock && formData.kodeBarang.trim() && formData.namaBarang.trim() && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700 font-medium">
                Barang baru terdeteksi: Kode <span className="font-mono font-bold">{formData.kodeBarang}</span> belum terdaftar di stock gudang
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Data akan otomatis ditambahkan ke laporan stock gudang saat transaksi disimpan
              </p>
            </div>
          )}
        </Card>

        <Card title="Detail Barang Masuk">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label={`Jumlah Barang (${formData.unit === "KG" ? "KG" : "ZAK"})`}
              type="number"
              name="jumlahZAK"
              value={formData.jumlahZAK}
              onChange={handleChange}
              placeholder={`Masukkan jumlah dalam ${formData.unit === "KG" ? "KG" : "ZAK"}`}
              error={errors.jumlahZAK}
              required
            />

            {isBotol && (
              <Input
                label="Botol per DUS"
                type="number"
                name="botolPerDus"
                value={formData.botolPerDus}
                onChange={handleChange}
                placeholder="Contoh: 20"
                error={errors.botolPerDus}
                required
              />
            )}
          </div>
        </Card>

        <Card title="Sopir & Nopol (Opsional)">
          <div className="space-y-6">
            {sopirNopolList.map((item, index) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {index === 0 ? "Sopir & Kendaraan Utama" : `Sopir & Kendaraan ${index + 1}`}
                  </h4>
                  {sopirNopolList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSopirNopol(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Nama Sopir"
                    type="text"
                    value={item.namaSopir}
                    onChange={(e) => handleSopirChange(item.id, "namaSopir", e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                  />
                  <Input
                    label="Nomor Polisi"
                    type="text"
                    value={item.nopol}
                    onChange={(e) => handleSopirChange(item.id, "nopol", e.target.value)}
                    placeholder="Contoh: B 1234 ABC"
                  />
                  <Input
                    label="Nomor SIM"
                    type="text"
                    value={item.nomorSIM}
                    onChange={(e) => handleSopirChange(item.id, "nomorSIM", e.target.value)}
                    placeholder="Contoh: 1234567890"
                  />
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSopirNopol}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Sopir & Kendaraan
            </Button>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setFormData({
                tanggal: new Date().toISOString().split("T")[0],
                kodeBarang: "",
                namaBarang: "",
                unit: "ZAK",
                jumlahZAK: "",
                botolPerDus: "",
                fot: "",
              });
              setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
              setMatchedStock(null);
              setErrors({});
            }}
          >
            Reset Form
          </Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            Simpan Transaksi Masuk
          </Button>
        </div>
      </form>

      {showNewStockModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-indigo-100 rounded-full">
                <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Tambah Stock Baru ke Gudang</h3>
                <p className="text-sm text-gray-500">Kode <span className="font-mono font-bold text-indigo-600">{formData.kodeBarang}</span> belum terdaftar</p>
              </div>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700"><span className="font-semibold">Nama Barang:</span> {formData.namaBarang}</p>
              <p className="text-sm text-gray-700"><span className="font-semibold">Unit:</span> {formData.unit}</p>
              <p className="text-sm text-gray-700"><span className="font-semibold">FOT:</span> {formData.fot}</p>
            </div>

            <div className="space-y-4">
              {isUnitBased && !isBotol && (
                <Input
                  label="Bobot Per Unit (KG)"
                  type="number"
                  name="bobotPerUnit"
                  value={newStockData.bobotPerUnit}
                  onChange={(e) => setNewStockData((prev) => ({ ...prev, bobotPerUnit: e.target.value }))}
                  placeholder="Contoh: 50"
                  error={errors.bobotPerUnit}
                  required
                />
              )}

              {isBotol && (
                <>
                  <Input
                    label="Botol Per DUS"
                    type="number"
                    name="botolPerDus"
                    value={newStockData.botolPerDus}
                    onChange={(e) => setNewStockData((prev) => ({ ...prev, botolPerDus: e.target.value }))}
                    placeholder="Contoh: 20"
                    error={errors.botolPerDus}
                    required
                  />
                  <Input
                    label="Volume (ml)"
                    type="number"
                    name="volumeMl"
                    value={newStockData.volumeMl}
                    onChange={(e) => setNewStockData((prev) => ({ ...prev, volumeMl: e.target.value }))}
                    placeholder="Contoh: 500"
                    error={errors.volumeMl}
                    required
                  />
                </>
              )}

              <Input
                label={`Stok Tersedia (${isBotol ? "ZAK" : formData.unit})`}
                type="number"
                name="stokTersediaUnit"
                value={newStockData.stokTersediaUnit}
                onChange={(e) => setNewStockData((prev) => ({ ...prev, stokTersediaUnit: e.target.value }))}
                placeholder={`Masukkan stok awal dalam ${isBotol ? "ZAK" : formData.unit}`}
                error={errors.stokTersediaUnit}
                required
              />
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowNewStockModal(false);
                  setNewStockData({
                    bobotPerUnit: "50",
                    stokTersediaUnit: "",
                    botolPerDus: "20",
                    volumeMl: "500",
                  });
                  setErrors({});
                }}
              >
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleCreateStockAndSubmit}
                isLoading={isSubmitting}
              >
                Simpan & Lanjutkan Transaksi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}