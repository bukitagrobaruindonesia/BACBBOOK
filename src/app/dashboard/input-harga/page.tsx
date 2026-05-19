"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, addDoc, getDocs, query, Timestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";

interface HargaProduk {
  id?: string;
  kodeBarang: string;
  namaProduk: string;
  jenisProduk: string;
  jenisUnit: "ZAK" | "BOTOL";
  hargaPerKg: number;
  hargaPerZak: number;
  hargaPerLiter: number;
  hargaPerDus: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export default function InputHargaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [existingKodeList, setExistingKodeList] = useState<string[]>([]);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [formData, setFormData] = useState<HargaProduk>({
    kodeBarang: "",
    namaProduk: "",
    jenisProduk: "",
    jenisUnit: "ZAK",
    hargaPerKg: 0,
    hargaPerZak: 0,
    hargaPerLiter: 0,
    hargaPerDus: 0,
  });

  useEffect(() => {
    fetchExistingKode();
  }, []);

  const fetchExistingKode = async () => {
    try {
      const snapshot = await getDocs(collection(db, "daftarHarga"));
      const kodeList = snapshot.docs.map((doc) => doc.data().kodeBarang);
      setExistingKodeList(kodeList);
    } catch (error) {
      console.error(error);
    }
  };

  const checkDuplicateKode = (kode: string) => {
    return existingKodeList.includes(kode.trim().toUpperCase());
  };

  const handleKodeBarangChange = (value: string) => {
    setFormData((prev) => ({ ...prev, kodeBarang: value }));
    if (value.trim().length > 0) {
      const isDuplicate = checkDuplicateKode(value);
      setShowDuplicateWarning(isDuplicate);
    } else {
      setShowDuplicateWarning(false);
    }
  };

  const handleUnitChange = (unit: "ZAK" | "BOTOL") => {
    setFormData((prev) => ({
      ...prev,
      jenisUnit: unit,
      hargaPerKg: unit === "BOTOL" ? 0 : prev.hargaPerKg,
      hargaPerZak: unit === "BOTOL" ? 0 : prev.hargaPerZak,
      hargaPerLiter: unit === "BOTOL" ? prev.hargaPerLiter : 0,
      hargaPerDus: unit === "BOTOL" ? prev.hargaPerDus : 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (!formData.kodeBarang.trim()) {
      alert("Kode barang wajib diisi!");
      setIsLoading(false);
      return;
    }

    if (!formData.namaProduk.trim()) {
      alert("Nama produk wajib diisi!");
      setIsLoading(false);
      return;
    }

    if (checkDuplicateKode(formData.kodeBarang)) {
      alert("Kode barang sudah ada dalam database! Silakan gunakan kode lain.");
      setIsLoading(false);
      return;
    }

    try {
      const dataToSave: any = {
        kodeBarang: formData.kodeBarang.trim().toUpperCase(),
        namaProduk: formData.namaProduk.trim(),
        jenisProduk: formData.jenisProduk.trim(),
        jenisUnit: formData.jenisUnit,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        createdBy: user?.nama || "Admin",
      };

      if (formData.jenisUnit === "ZAK") {
        dataToSave.hargaPerKg = Number(formData.hargaPerKg) || 0;
        dataToSave.hargaPerZak = Number(formData.hargaPerZak) || 0;
      } else {
        dataToSave.hargaPerLiter = Number(formData.hargaPerLiter) || 0;
        dataToSave.hargaPerDus = Number(formData.hargaPerDus) || 0;
      }

      await addDoc(collection(db, "daftarHarga"), dataToSave);
      alert("Harga produk berhasil disimpan!");

      setFormData({
        kodeBarang: "",
        namaProduk: "",
        jenisProduk: "",
        jenisUnit: "ZAK",
        hargaPerKg: 0,
        hargaPerZak: 0,
        hargaPerLiter: 0,
        hargaPerDus: 0,
      });
      setShowDuplicateWarning(false);
      fetchExistingKode();
    } catch (error) {
      alert("Gagal menyimpan data harga!");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <Header
        title="Input Daftar Harga Produk"
        subtitle="Kelola harga produk pupuk per unit"
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Kode Barang <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.kodeBarang}
                onChange={(e) => handleKodeBarangChange(e.target.value)}
                placeholder="Masukkan kode barang"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                required
              />
              {showDuplicateWarning && (
                <p className="text-sm text-red-500 font-medium">
                  Kode barang sudah terdaftar!
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.namaProduk}
                onChange={(e) => setFormData((prev) => ({ ...prev, namaProduk: e.target.value }))}
                placeholder="Masukkan nama produk"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Jenis Produk
              </label>
              <input
                type="text"
                value={formData.jenisProduk}
                onChange={(e) => setFormData((prev) => ({ ...prev, jenisProduk: e.target.value }))}
                placeholder="Contoh: NPK, Urea, SP-36"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">
                Jenis Unit <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => handleUnitChange("ZAK")}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold transition-all ${
                    formData.jenisUnit === "ZAK"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-600 hover:border-green-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    ZAK
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleUnitChange("BOTOL")}
                  className={`flex-1 px-4 py-3 rounded-xl border-2 font-semibold transition-all ${
                    formData.jenisUnit === "BOTOL"
                      ? "border-pink-500 bg-pink-50 text-pink-700"
                      : "border-gray-200 text-gray-600 hover:border-pink-300"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    BOTOL
                  </div>
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">
              {formData.jenisUnit === "ZAK" ? "Harga per Unit ZAK" : "Harga per Unit BOTOL"}
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {formData.jenisUnit === "ZAK" ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Harga per KG
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={formData.hargaPerKg || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hargaPerKg: Number(e.target.value) }))}
                        placeholder="0"
                        min="0"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {formData.hargaPerKg > 0 && (
                      <p className="text-sm text-green-600 font-medium">
                        {formatRupiah(formData.hargaPerKg)} / KG
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Harga per ZAK
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={formData.hargaPerZak || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hargaPerZak: Number(e.target.value) }))}
                        placeholder="0"
                        min="0"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {formData.hargaPerZak > 0 && (
                      <p className="text-sm text-green-600 font-medium">
                        {formatRupiah(formData.hargaPerZak)} / ZAK
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Harga per Liter
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={formData.hargaPerLiter || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hargaPerLiter: Number(e.target.value) }))}
                        placeholder="0"
                        min="0"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {formData.hargaPerLiter > 0 && (
                      <p className="text-sm text-pink-600 font-medium">
                        {formatRupiah(formData.hargaPerLiter)} / Liter
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      Harga per Dus
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">
                        Rp
                      </span>
                      <input
                        type="number"
                        value={formData.hargaPerDus || ""}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hargaPerDus: Number(e.target.value) }))}
                        placeholder="0"
                        min="0"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      />
                    </div>
                    {formData.hargaPerDus > 0 && (
                      <p className="text-sm text-pink-600 font-medium">
                        {formatRupiah(formData.hargaPerDus)} / Dus
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4">
            <Button
              type="submit"
              variant="primary"
              isLoading={isLoading}
              className="px-8 py-3 text-base"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              Simpan Harga
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/dashboard/daftar-harga")}
            >
              Lihat Daftar Harga
            </Button>
          </div>
        </form>
      </Card>

      <Card title="Panduan Input Harga">
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-green-800">Unit ZAK</p>
              <p>Jika produk menggunakan unit ZAK, input harga per KG dan harga per ZAK.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-pink-50 rounded-lg">
            <svg className="w-5 h-5 text-pink-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-semibold text-pink-800">Unit BOTOL</p>
              <p>Jika produk menggunakan unit BOTOL, input harga per Liter dan harga per Dus.</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold text-blue-800">Validasi Kode</p>
              <p>Sistem akan memeriksa duplikasi kode barang secara otomatis.</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}