"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Table from "@/app/components/ui/Table";
import { StockGudang } from "@/app/types";

export default function InputStockGudangPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockGudang[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    fot: "",
    kodeBarang: "",
    namaBarang: "",
    unit: "ZAK" as "ZAK" | "DUS",
    stokAwalZAK: "",
    stokAwalKG: "",
    barangMasukKG: "",
    barangKeluarKG: "",
  });

  const [fotList, setFotList] = useState<string[]>([]);
  const [isNewFot, setIsNewFot] = useState(false);

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
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
      console.error(error);
    }
  };

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as StockGudang));
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

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

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";
    if (!formData.kodeBarang.trim()) newErrors.kodeBarang = "Kode barang wajib diisi";
    if (!formData.namaBarang.trim()) newErrors.namaBarang = "Nama barang wajib diisi";
    if (!formData.stokAwalZAK || parseFloat(formData.stokAwalZAK) < 0) newErrors.stokAwalZAK = "Stok awal tidak valid";
    if (!formData.stokAwalKG || parseFloat(formData.stokAwalKG) < 0) newErrors.stokAwalKG = "Stok awal KG tidak valid";
    if (!formData.barangMasukKG || parseFloat(formData.barangMasukKG) < 0) newErrors.barangMasukKG = "Barang masuk tidak valid";
    if (!formData.barangKeluarKG || parseFloat(formData.barangKeluarKG) < 0) newErrors.barangKeluarKG = "Barang keluar tidak valid";

    const stokAwalKG = parseFloat(formData.stokAwalKG) || 0;
    const barangMasuk = parseFloat(formData.barangMasukKG) || 0;
    const barangKeluar = parseFloat(formData.barangKeluarKG) || 0;
    const { stokAkhirKG } = calculateStock(stokAwalKG, barangMasuk, barangKeluar, formData.unit);

    if (stokAkhirKG < 0) newErrors.barangKeluarKG = "Barang keluar melebihi total stok";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const stokAwalKG = parseFloat(formData.stokAwalKG);
      const barangMasuk = parseFloat(formData.barangMasukKG);
      const barangKeluar = parseFloat(formData.barangKeluarKG);
      const { stokAkhirKG, stokBarangZAK } = calculateStock(stokAwalKG, barangMasuk, barangKeluar, formData.unit);

      await addDoc(collection(db, "stockGudang"), {
        fot: formData.fot.trim().toUpperCase(),
        kodeBarang: formData.kodeBarang.trim().toUpperCase(),
        namaBarang: formData.namaBarang.trim(),
        unit: formData.unit,
        stokAwalZAK: parseFloat(formData.stokAwalZAK),
        stokAwalKG: stokAwalKG,
        barangMasukKG: barangMasuk,
        barangKeluarKG: barangKeluar,
        stokAkhirKG: stokAkhirKG,
        stokBarangZAK: stokBarangZAK,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessMessage("Stock gudang berhasil disimpan!");
      setFormData({
        fot: "",
        kodeBarang: "",
        namaBarang: "",
        unit: "ZAK",
        stokAwalZAK: "",
        stokAwalKG: "",
        barangMasukKG: "",
        barangKeluarKG: "",
      });
      setIsNewFot(false);

      fetchStockGudang();
      fetchFotList();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

  const previewCalculation = () => {
    const stokAwalKG = parseFloat(formData.stokAwalKG) || 0;
    const barangMasuk = parseFloat(formData.barangMasukKG) || 0;
    const barangKeluar = parseFloat(formData.barangKeluarKG) || 0;
    return calculateStock(stokAwalKG, barangMasuk, barangKeluar, formData.unit);
  };

  const preview = previewCalculation();

  const fotOptions = [
    { value: "", label: "Pilih atau tambah FOT..." },
    ...fotList.map((f) => ({ value: f, label: f })),
    { value: "__new__", label: "+ Tambah FOT Baru" },
  ];

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
          <p className="font-mono">{row.stokAwalZAK.toLocaleString()} {row.unit}</p>
          <p className="text-gray-500 text-xs">{row.stokAwalKG.toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "masuk",
      header: "Masuk",
      width: "120px",
      render: (row: StockGudang) => (
        <span className="text-green-600 font-mono">+{row.barangMasukKG.toLocaleString()} KG</span>
      ),
    },
    {
      key: "keluar",
      header: "Keluar",
      width: "120px",
      render: (row: StockGudang) => (
        <span className="text-red-600 font-mono">-{row.barangKeluarKG.toLocaleString()} KG</span>
      ),
    },
    {
      key: "stokAkhir",
      header: "Stok Akhir",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          <p className="font-mono font-bold text-green-700">{row.stokAkhirKG.toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "stokZAK",
      header: "Stok Barang",
      width: "120px",
      render: (row: StockGudang) => (
        <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded">
          {row.stokBarangZAK.toLocaleString()} {row.unit}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Header
        title="Input Stock Gudang"
        subtitle="Tambah dan kelola data stock barang per FOT"
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Informasi Barang" icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              }>
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
                      />
                    )}
                    {!isNewFot && errors.fot && (
                      <p className="mt-1 text-sm text-red-600">{errors.fot}</p>
                    )}
                  </div>

                  <Input
                    label="Kode Barang"
                    type="text"
                    name="kodeBarang"
                    value={formData.kodeBarang}
                    onChange={handleChange}
                    placeholder="Contoh: PUP-001"
                    error={errors.kodeBarang}
                    required
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
                  />

                  <Select
                    label="Unit"
                    name="unit"
                    value={formData.unit}
                    onChange={handleChange}
                    options={unitOptions}
                    required
                  />
                </div>
              </Card>

              <Card title="Stok Awal" icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }>
                <div className="space-y-4">
                  <Input
                    label={`Stok Awal (${formData.unit})`}
                    type="number"
                    name="stokAwalZAK"
                    value={formData.stokAwalZAK}
                    onChange={handleChange}
                    placeholder={`Masukkan stok awal dalam ${formData.unit}`}
                    error={errors.stokAwalZAK}
                    required
                  />

                  <Input
                    label="Stok Awal (KG)"
                    type="number"
                    name="stokAwalKG"
                    value={formData.stokAwalKG}
                    onChange={handleChange}
                    placeholder="Masukkan stok awal dalam KG"
                    error={errors.stokAwalKG}
                    required
                  />
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card title="Pergerakan Barang" icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              }>
                <div className="space-y-4">
                  <Input
                    label="Barang Masuk (KG)"
                    type="number"
                    name="barangMasukKG"
                    value={formData.barangMasukKG}
                    onChange={handleChange}
                    placeholder="Masukkan barang masuk dalam KG"
                    error={errors.barangMasukKG}
                    required
                  />

                  <Input
                    label="Barang Keluar (KG)"
                    type="number"
                    name="barangKeluarKG"
                    value={formData.barangKeluarKG}
                    onChange={handleChange}
                    placeholder="Masukkan barang keluar dalam KG"
                    error={errors.barangKeluarKG}
                    required
                  />
                </div>
              </Card>

              <Card title="Preview Perhitungan" icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }>
                <div className="space-y-4 p-2">
                  <div className="p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-green-200">
                    <p className="text-xs text-green-600 uppercase tracking-wide font-semibold mb-1">Stok Akhir (KG)</p>
                    <p className="text-3xl font-bold text-green-700 font-mono">{preview.stokAkhirKG.toLocaleString()}</p>
                  </div>

                  <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">Stok Barang ({formData.unit})</p>
                    <p className="text-3xl font-bold text-amber-700 font-mono">{preview.stokBarangZAK.toLocaleString()}</p>
                    <p className="text-xs text-amber-500 mt-1">
                      {formData.unit === "ZAK" ? "Perhitungan: 1 ZAK = 50 KG" : "Perhitungan: 1 DUS = 25 KG"}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFormData({
                    fot: "",
                    kodeBarang: "",
                    namaBarang: "",
                    unit: "ZAK",
                    stokAwalZAK: "",
                    stokAwalKG: "",
                    barangMasukKG: "",
                    barangKeluarKG: "",
                  });
                  setIsNewFot(false);
                  setErrors({});
                }}
              >
                Reset Form
              </Button>
              <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
                Simpan Stock Gudang
              </Button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-3">
          <Card title={`Data Stock Gudang (${stockList.length} item)`} icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          }>
            <Table
              columns={columns}
              data={stockList}
              isLoading={false}
              emptyMessage="Belum ada data stock gudang"
              keyExtractor={(row) => row.id}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}