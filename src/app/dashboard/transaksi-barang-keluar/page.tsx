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
import { StockGudang } from "@/app/types";

interface StockOption {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  unit: "ZAK" | "DUS" | "KG" | "BOTOL";
  fot: string;
  bobotPerUnit: number;
  botolPerDus?: number;
  stokAkhirUnit?: number;
  stokAkhirKG: number;
}

interface SopirNopolItem {
  id: number;
  value: string;
}

export default function TransaksiBarangKeluarPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockOption[]>([]);
  const [fotList, setFotList] = useState<string[]>([]);
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
    bobotPerBotol: "",
    namaCustomer: "",
    nomorPI: "",
    nomorInvoice: "",
    nomorSuratPengangkutan: "",
    fot: "",
  });

  const [sopirNopolList, setSopirNopolList] = useState<SopirNopolItem[]>([{ id: 1, value: "" }]);
  const [selectedStock, setSelectedStock] = useState<StockOption | null>(null);

  useEffect(() => {
    fetchStockGudang();
  }, []);

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        kodeBarang: doc.data().kodeBarang,
        namaBarang: doc.data().namaBarang,
        unit: doc.data().unit,
        fot: doc.data().fot,
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        botolPerDus: doc.data().botolPerDus,
        stokAkhirUnit: doc.data().stokAkhirUnit || 0,
        stokAkhirKG: doc.data().stokAkhirKG || 0,
      } as StockOption));
      setStockList(data);

      const fotSet = new Set<string>();
      data.forEach((item) => {
        if (item.fot && item.fot.trim()) {
          fotSet.add(item.fot.trim().toUpperCase());
        }
      });
      setFotList(Array.from(fotSet).sort());
    } catch (error) {
      console.error(error);
    }
  };

  const handleStockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) {
      setSelectedStock(null);
      setFormData((prev) => ({
        ...prev,
        kodeBarang: "",
        namaBarang: "",
        unit: "ZAK",
        botolPerDus: "",
        bobotPerBotol: "",
        fot: "",
      }));
      return;
    }

    const stock = stockList.find((s) => s.id === value);
    if (stock) {
      setSelectedStock(stock);
      setFormData((prev) => ({
        ...prev,
        kodeBarang: stock.kodeBarang,
        namaBarang: stock.namaBarang,
        unit: stock.unit,
        fot: stock.fot,
        botolPerDus: stock.botolPerDus ? stock.botolPerDus.toString() : "",
        bobotPerBotol: stock.unit === "BOTOL" ? (stock.bobotPerUnit ? stock.bobotPerUnit.toString() : "") : "",
      }));
    }

    if (errors.kodeBarang) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.kodeBarang;
        return newErrors;
      });
    }
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

  const handleSopirNopolChange = (id: number, value: string) => {
    setSopirNopolList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, value } : item))
    );
    if (errors.sopirNopol) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.sopirNopol;
        return newErrors;
      });
    }
  };

  const addSopirNopol = () => {
    const newId = sopirNopolList.length > 0 ? Math.max(...sopirNopolList.map((s) => s.id)) + 1 : 1;
    setSopirNopolList((prev) => [...prev, { id: newId, value: "" }]);
  };

  const removeSopirNopol = (id: number) => {
    if (sopirNopolList.length <= 1) return;
    setSopirNopolList((prev) => prev.filter((item) => item.id !== id));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.kodeBarang) newErrors.kodeBarang = "Kode barang wajib dipilih";
    if (!formData.namaBarang) newErrors.namaBarang = "Nama barang wajib diisi";
    if (!formData.jumlahZAK || parseFloat(formData.jumlahZAK) <= 0) newErrors.jumlahZAK = "Jumlah ZAK harus lebih dari 0";
    if (!formData.namaCustomer.trim()) newErrors.namaCustomer = "Nama customer wajib diisi";
    if (!formData.nomorPI.trim()) newErrors.nomorPI = "No PI wajib diisi";
    if (!formData.nomorInvoice.trim()) newErrors.nomorInvoice = "No Invoice wajib diisi";
    if (!formData.nomorSuratPengangkutan.trim()) newErrors.nomorSuratPengangkutan = "Nomor Surat Pengangkutan wajib diisi";
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib dipilih";

    const validSopir = sopirNopolList.filter((s) => s.value.trim());
    if (validSopir.length === 0) newErrors.sopirNopol = "Minimal satu Sopir/Nopol wajib diisi";

    if (formData.unit === "BOTOL") {
      if (!formData.botolPerDus || parseFloat(formData.botolPerDus) <= 0) newErrors.botolPerDus = "Botol per DUS tidak valid";
      if (!formData.bobotPerBotol || parseFloat(formData.bobotPerBotol) <= 0) newErrors.bobotPerBotol = "Bobot per botol tidak valid";
    }

    if (selectedStock) {
      const jumlahZAK = parseFloat(formData.jumlahZAK) || 0;
      let totalKG = 0;
      if (formData.unit === "BOTOL") {
        const dusPerZak = 10;
        const botolPerDus = parseFloat(formData.botolPerDus) || 1;
        const bobotPerBotol = parseFloat(formData.bobotPerBotol) || 0;
        const totalBotol = jumlahZAK * dusPerZak * botolPerDus;
        totalKG = (totalBotol * bobotPerBotol) / 1000;
      } else if (formData.unit === "KG") {
        totalKG = jumlahZAK;
      } else {
        totalKG = jumlahZAK * selectedStock.bobotPerUnit;
      }

      if (formData.unit !== "KG" && jumlahZAK > (selectedStock.stokAkhirUnit || 0)) {
        newErrors.jumlahZAK = `Stok tidak mencukupi. Tersedia: ${selectedStock.stokAkhirUnit?.toLocaleString()} ${formData.unit}`;
      }
      if (totalKG > selectedStock.stokAkhirKG) {
        newErrors.jumlahZAK = `Stok KG tidak mencukupi. Tersedia: ${selectedStock.stokAkhirKG.toLocaleString()} KG`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (!selectedStock) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const jumlahZAK = parseFloat(formData.jumlahZAK) || 0;
      const botolPerDus = formData.unit === "BOTOL" ? parseFloat(formData.botolPerDus) || 0 : null;
      const bobotPerBotol = formData.unit === "BOTOL" ? parseFloat(formData.bobotPerBotol) || 0 : null;

      let totalKG = 0;
      if (formData.unit === "BOTOL") {
        const dusPerZak = 10;
        const totalBotol = jumlahZAK * dusPerZak * (botolPerDus || 1);
        totalKG = (totalBotol * (bobotPerBotol || 0)) / 1000;
      } else if (formData.unit === "KG") {
        totalKG = jumlahZAK;
      } else {
        totalKG = jumlahZAK * selectedStock.bobotPerUnit;
      }

      const sopirNopolValues = sopirNopolList
        .filter((s) => s.value.trim())
        .map((s) => s.value.trim());

      const transaksiData: any = {
        tanggal: formData.tanggal,
        kodeBarang: formData.kodeBarang,
        namaBarang: formData.namaBarang,
        unit: formData.unit,
        jumlahZAK: jumlahZAK,
        namaCustomer: formData.namaCustomer.trim(),
        nomorPI: formData.nomorPI.trim(),
        nomorInvoice: formData.nomorInvoice.trim(),
        sopirNopolList: sopirNopolValues,
        nomorSuratPengangkutan: formData.nomorSuratPengangkutan.trim(),
        fot: formData.fot.trim().toUpperCase(),
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (formData.unit === "BOTOL") {
        transaksiData.botolPerDus = botolPerDus;
        transaksiData.bobotPerBotol = bobotPerBotol;
      }

      await addDoc(collection(db, "transaksiBarangKeluar"), transaksiData);

      const stockRef = doc(db, "stockGudang", selectedStock.id);
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
          stokAkhirUnit: Math.max(0, currentStokUnit - minusUnit),
          stokAkhirKG: Math.max(0, currentStokKG - minusKG),
          updatedAt: serverTimestamp(),
        });
      }

      setSuccessMessage("Transaksi barang keluar berhasil disimpan dan stok diperbarui!");
      setFormData({
        tanggal: new Date().toISOString().split("T")[0],
        kodeBarang: "",
        namaBarang: "",
        unit: "ZAK",
        jumlahZAK: "",
        botolPerDus: "",
        bobotPerBotol: "",
        namaCustomer: "",
        nomorPI: "",
        nomorInvoice: "",
        nomorSuratPengangkutan: "",
        fot: "",
      });
      setSopirNopolList([{ id: 1, value: "" }]);
      setSelectedStock(null);

      fetchStockGudang();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan transaksi. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stockOptions = [
    { value: "", label: "Pilih barang dari stock gudang..." },
    ...stockList.map((stock) => ({
      value: stock.id,
      label: `${stock.namaBarang} (${stock.kodeBarang}) - ${stock.fot} - Stok: ${stock.stokAkhirKG.toLocaleString()} KG`,
    })),
  ];

  const fotOptions = [
    { value: "", label: "Pilih FOT..." },
    ...fotList.map((f) => ({ value: f, label: f })),
  ];

  const isBotol = formData.unit === "BOTOL";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Header
        title="Transaksi Barang Keluar"
        subtitle="Input data barang keluar dari gudang"
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
              label="Tanggal Keluar Barang"
              type="date"
              name="tanggal"
              value={formData.tanggal}
              onChange={handleChange}
              error={errors.tanggal}
              required
            />

            <Select
              label="Pilih Barang dari Stock Gudang"
              name="kodeBarang"
              value={selectedStock?.id || ""}
              onChange={handleStockChange}
              options={stockOptions}
              error={errors.kodeBarang}
              required
            />

            <Input
              label="Kode Barang"
              type="text"
              name="kodeBarangDisplay"
              value={formData.kodeBarang}
              readOnly
              className="bg-gray-50"
            />

            <Input
              label="Nama Barang"
              type="text"
              name="namaBarang"
              value={formData.namaBarang}
              readOnly
              className="bg-gray-50"
            />

            <Input
              label="Unit"
              type="text"
              name="unit"
              value={formData.unit}
              readOnly
              className="bg-gray-50"
            />

            <Select
              label="FOT (Tempat Gudang)"
              name="fot"
              value={formData.fot}
              onChange={handleChange}
              options={fotOptions}
              error={errors.fot}
              required
            />
          </div>
        </Card>

        <Card title="Detail Barang Keluar">
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
              <>
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

                <Input
                  label="Bobot Per Botol (ml)"
                  type="number"
                  name="bobotPerBotol"
                  value={formData.bobotPerBotol}
                  onChange={handleChange}
                  placeholder="Contoh: 500"
                  error={errors.bobotPerBotol}
                  required
                />
              </>
            )}

            <Input
              label="Nama Customer"
              type="text"
              name="namaCustomer"
              value={formData.namaCustomer}
              onChange={handleChange}
              placeholder="Masukkan nama customer"
              error={errors.namaCustomer}
              required
            />

            <Input
              label="No PI / Proforma Invoice"
              type="text"
              name="nomorPI"
              value={formData.nomorPI}
              onChange={handleChange}
              placeholder="Contoh: PI-0675"
              error={errors.nomorPI}
              required
            />

            <Input
              label="No Invoice"
              type="text"
              name="nomorInvoice"
              value={formData.nomorInvoice}
              onChange={handleChange}
              placeholder="Masukkan nomor invoice"
              error={errors.nomorInvoice}
              required
            />

            <Input
              label="Nomor Surat Pengangkutan"
              type="text"
              name="nomorSuratPengangkutan"
              value={formData.nomorSuratPengangkutan}
              onChange={handleChange}
              placeholder="Masukkan nomor surat pengangkutan"
              error={errors.nomorSuratPengangkutan}
              required
            />
          </div>
        </Card>

        <Card title="Sopir & Nopol">
          <div className="space-y-4">
            {sopirNopolList.map((item, index) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <Input
                    label={index === 0 ? "Sopir / Nopol" : `Sopir / Nopol ${index + 1}`}
                    type="text"
                    value={item.value}
                    onChange={(e) => handleSopirNopolChange(item.id, e.target.value)}
                    placeholder="Contoh: Budi / B 1234 ABC"
                    required={index === 0}
                  />
                </div>
                {sopirNopolList.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSopirNopol(item.id)}
                    className="mt-6 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {errors.sopirNopol && (
              <p className="text-sm text-red-600">{errors.sopirNopol}</p>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSopirNopol}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Sopir/Nopol
            </Button>
          </div>
        </Card>

        {selectedStock && formData.jumlahZAK && (
          <Card title="Preview & Validasi Stok">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-600 uppercase tracking-wide font-semibold mb-1">Stok Tersedia</p>
                <p className="text-xl font-bold text-green-700 font-mono">
                  {selectedStock.stokAkhirUnit?.toLocaleString()} {formData.unit === "KG" ? "KG" : formData.unit}
                </p>
                <p className="text-sm text-green-600">{selectedStock.stokAkhirKG.toLocaleString()} KG</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">Jumlah Keluar</p>
                <p className="text-xl font-bold text-amber-700 font-mono">
                  {parseFloat(formData.jumlahZAK).toLocaleString()} {formData.unit === "KG" ? "KG" : "ZAK"}
                </p>
                <p className="text-sm text-amber-600">
                  {formData.unit === "BOTOL"
                    ? `${((parseFloat(formData.jumlahZAK) || 0) * 10 * (parseFloat(formData.botolPerDus) || 1) * (parseFloat(formData.bobotPerBotol) || 0) / 1000).toLocaleString()} KG`
                    : `${((parseFloat(formData.jumlahZAK) || 0) * selectedStock.bobotPerUnit).toLocaleString()} KG`
                  }
                </p>
              </div>
            </div>
            {formData.unit === "BOTOL" && (
              <p className="text-xs text-amber-500 mt-2">
                Perhitungan: {formData.jumlahZAK} ZAK × 10 DUS/ZAK × {formData.botolPerDus || 0} botol/DUS × {formData.bobotPerBotol || 0} ml ÷ 1000 = KG
              </p>
            )}
            {formData.unit !== "BOTOL" && formData.unit !== "KG" && (
              <p className="text-xs text-amber-500 mt-2">
                Perhitungan: {formData.jumlahZAK} {formData.unit} × {selectedStock.bobotPerUnit} KG/{formData.unit}
              </p>
            )}
          </Card>
        )}

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
                bobotPerBotol: "",
                namaCustomer: "",
                nomorPI: "",
                nomorInvoice: "",
                nomorSuratPengangkutan: "",
                fot: "",
              });
              setSopirNopolList([{ id: 1, value: "" }]);
              setSelectedStock(null);
              setErrors({});
            }}
          >
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