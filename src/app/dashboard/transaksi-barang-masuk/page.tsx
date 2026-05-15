"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

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
  namaSopir: string;
  nopol: string;
  nomorSIM: string;
}

export default function TransaksiBarangMasukPage() {
  const { user } = useAuth();
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
    fot: "",
  });

  const [sopirNopolList, setSopirNopolList] = useState<SopirNopolItem[]>([
    { id: 1, namaSopir: "", nopol: "", nomorSIM: "" },
  ]);

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
    if (!formData.jumlahZAK || parseFloat(formData.jumlahZAK) <= 0) newErrors.jumlahZAK = "Jumlah ZAK harus lebih dari 0";
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";

    if (formData.unit === "BOTOL") {
      if (!formData.botolPerDus || parseFloat(formData.botolPerDus) <= 0) newErrors.botolPerDus = "Botol per DUS tidak valid";
      if (!formData.bobotPerBotol || parseFloat(formData.bobotPerBotol) <= 0) newErrors.bobotPerBotol = "Bobot per botol tidak valid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

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
        totalKG = jumlahZAK * 50;
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

      setSuccessMessage("Transaksi barang masuk berhasil disimpan!");
      setFormData({
        tanggal: new Date().toISOString().split("T")[0],
        kodeBarang: "",
        namaBarang: "",
        unit: "ZAK",
        jumlahZAK: "",
        botolPerDus: "",
        bobotPerBotol: "",
        fot: "",
      });
      setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan transaksi. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isBotol = formData.unit === "BOTOL";

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

            <Input
              label="Unit"
              type="text"
              name="unit"
              value={formData.unit}
              onChange={handleChange}
              placeholder="Contoh: ZAK, DUS, KG, BOTOL"
              error={errors.unit}
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
                bobotPerBotol: "",
                fot: "",
              });
              setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
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
    </div>
  );
}