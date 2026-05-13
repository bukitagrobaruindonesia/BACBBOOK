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
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    bobotPerUnit: "50",
    stokAwalUnit: "",
    stokAwalKG: "",
    stokAwalBotol: "",
    barangMasukKG: "",
    barangMasukBotol: "",
    barangKeluarKG: "",
    barangKeluarBotol: "",
  });

  const [fotList, setFotList] = useState<string[]>([]);
  const [isNewFot, setIsNewFot] = useState(false);

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
    stokAwalBotol: number,
    barangMasukKG: number,
    barangMasukBotol: number,
    barangKeluarKG: number,
    barangKeluarBotol: number,
    bobotPerUnit: number,
    unit: string
  ) => {
    const stokAkhirKG = stokAwalKG + barangMasukKG - barangKeluarKG;
    const stokAkhirBotol = stokAwalBotol + barangMasukBotol - barangKeluarBotol;
    let stokAkhirUnit = 0;
    if (unit === "ZAK" || unit === "DUS") {
      stokAkhirUnit = Math.floor(stokAkhirKG / bobotPerUnit);
    } else if (unit === "BOTOL") {
      stokAkhirUnit = stokAkhirBotol;
    }
    return { stokAkhirKG, stokAkhirBotol, stokAkhirUnit };
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";
    if (!formData.kodeBarang.trim()) newErrors.kodeBarang = "Kode barang wajib diisi";
    if (!formData.namaBarang.trim()) newErrors.namaBarang = "Nama barang wajib diisi";
    if (!formData.bobotPerUnit || parseFloat(formData.bobotPerUnit) <= 0) newErrors.bobotPerUnit = "Bobot per unit tidak valid";

    const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS";
    const isBottle = formData.unit === "BOTOL";

    if (isUnitBased) {
      if (!formData.stokAwalUnit || parseFloat(formData.stokAwalUnit) < 0) newErrors.stokAwalUnit = "Stok awal tidak valid";
    }
    if (!formData.stokAwalKG || parseFloat(formData.stokAwalKG) < 0) newErrors.stokAwalKG = "Stok awal KG tidak valid";
    if (isBottle) {
      if (!formData.stokAwalBotol || parseFloat(formData.stokAwalBotol) < 0) newErrors.stokAwalBotol = "Stok awal botol tidak valid";
    }

    if (!formData.barangMasukKG || parseFloat(formData.barangMasukKG) < 0) newErrors.barangMasukKG = "Barang masuk tidak valid";
    if (isBottle && (!formData.barangMasukBotol || parseFloat(formData.barangMasukBotol) < 0)) newErrors.barangMasukBotol = "Barang masuk botol tidak valid";
    if (!formData.barangKeluarKG || parseFloat(formData.barangKeluarKG) < 0) newErrors.barangKeluarKG = "Barang keluar tidak valid";
    if (isBottle && (!formData.barangKeluarBotol || parseFloat(formData.barangKeluarBotol) < 0)) newErrors.barangKeluarBotol = "Barang keluar botol tidak valid";

    const stokAwalKG = parseFloat(formData.stokAwalKG) || 0;
    const stokAwalBotol = parseFloat(formData.stokAwalBotol) || 0;
    const barangMasukKG = parseFloat(formData.barangMasukKG) || 0;
    const barangMasukBotol = parseFloat(formData.barangMasukBotol) || 0;
    const barangKeluarKG = parseFloat(formData.barangKeluarKG) || 0;
    const barangKeluarBotol = parseFloat(formData.barangKeluarBotol) || 0;
    const bobotPerUnit = parseFloat(formData.bobotPerUnit) || 50;

    const { stokAkhirKG, stokAkhirBotol } = calculateStock(
      stokAwalKG, stokAwalBotol, barangMasukKG, barangMasukBotol,
      barangKeluarKG, barangKeluarBotol, bobotPerUnit, formData.unit
    );

    if (stokAkhirKG < 0) newErrors.barangKeluarKG = "Barang keluar melebihi total stok KG";
    if (isBottle && stokAkhirBotol < 0) newErrors.barangKeluarBotol = "Barang keluar melebihi total stok botol";

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
      const stokAwalBotol = parseFloat(formData.stokAwalBotol) || 0;
      const barangMasukKG = parseFloat(formData.barangMasukKG);
      const barangMasukBotol = parseFloat(formData.barangMasukBotol) || 0;
      const barangKeluarKG = parseFloat(formData.barangKeluarKG);
      const barangKeluarBotol = parseFloat(formData.barangKeluarBotol) || 0;
      const bobotPerUnit = parseFloat(formData.bobotPerUnit);

      const { stokAkhirKG, stokAkhirBotol, stokAkhirUnit } = calculateStock(
        stokAwalKG, stokAwalBotol, barangMasukKG, barangMasukBotol,
        barangKeluarKG, barangKeluarBotol, bobotPerUnit, formData.unit
      );

      await addDoc(collection(db, "stockGudang"), {
        fot: formData.fot.trim().toUpperCase(),
        kodeBarang: formData.kodeBarang.trim().toUpperCase(),
        namaBarang: formData.namaBarang.trim(),
        unit: formData.unit,
        bobotPerUnit: bobotPerUnit,
        stokAwalUnit: parseFloat(formData.stokAwalUnit) || 0,
        stokAwalKG: stokAwalKG,
        stokAwalBotol: stokAwalBotol,
        barangMasukKG: barangMasukKG,
        barangMasukBotol: barangMasukBotol,
        barangKeluarKG: barangKeluarKG,
        barangKeluarBotol: barangKeluarBotol,
        stokAkhirKG: stokAkhirKG,
        stokAkhirBotol: stokAkhirBotol,
        stokAkhirUnit: stokAkhirUnit,
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
        bobotPerUnit: "50",
        stokAwalUnit: "",
        stokAwalKG: "",
        stokAwalBotol: "",
        barangMasukKG: "",
        barangMasukBotol: "",
        barangKeluarKG: "",
        barangKeluarBotol: "",
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
    const stokAwalBotol = parseFloat(formData.stokAwalBotol) || 0;
    const barangMasukKG = parseFloat(formData.barangMasukKG) || 0;
    const barangMasukBotol = parseFloat(formData.barangMasukBotol) || 0;
    const barangKeluarKG = parseFloat(formData.barangKeluarKG) || 0;
    const barangKeluarBotol = parseFloat(formData.barangKeluarBotol) || 0;
    const bobotPerUnit = parseFloat(formData.bobotPerUnit) || 50;
    return calculateStock(
      stokAwalKG, stokAwalBotol, barangMasukKG, barangMasukBotol,
      barangKeluarKG, barangKeluarBotol, bobotPerUnit, formData.unit
    );
  };

  const preview = previewCalculation();

  const fotOptions = [
    { value: "", label: "Pilih atau tambah FOT..." },
    ...fotList.map((f) => ({ value: f, label: f })),
    { value: "__new__", label: "+ Tambah FOT Baru" },
  ];

  const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS";
  const isBottle = formData.unit === "BOTOL";
  const isKG = formData.unit === "KG";

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
      key: "bobot",
      header: "Bobot/Unit",
      width: "100px",
      render: (row: StockGudang) => (
        <span className="font-mono text-gray-600">
          {row.unit === "KG" ? "-" : `${row.bobotPerUnit?.toLocaleString()} KG`}
        </span>
      ),
    },
    {
      key: "stokAwal",
      header: "Stok Awal",
      width: "160px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {(row.unit === "ZAK" || row.unit === "DUS") && (
            <p className="font-mono">{row.stokAwalUnit?.toLocaleString()} {row.unit}</p>
          )}
          {row.unit === "BOTOL" && (
            <p className="font-mono">{row.stokAwalBotol?.toLocaleString()} BOTOL</p>
          )}
          <p className="text-gray-500 text-xs">{row.stokAwalKG.toLocaleString()} KG</p>
        </div>
      ),
    },
    {
      key: "masuk",
      header: "Masuk",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          <span className="text-green-600 font-mono">+{row.barangMasukKG.toLocaleString()} KG</span>
          {row.unit === "BOTOL" && (
            <p className="text-green-500 font-mono text-xs">+{row.barangMasukBotol?.toLocaleString()} BOTOL</p>
          )}
        </div>
      ),
    },
    {
      key: "keluar",
      header: "Keluar",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          <span className="text-red-600 font-mono">-{row.barangKeluarKG.toLocaleString()} KG</span>
          {row.unit === "BOTOL" && (
            <p className="text-red-500 font-mono text-xs">-{row.barangKeluarBotol?.toLocaleString()} BOTOL</p>
          )}
        </div>
      ),
    },
    {
      key: "stokAkhir",
      header: "Stok Akhir",
      width: "160px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {(row.unit === "ZAK" || row.unit === "DUS") && (
            <p className="font-mono font-bold text-green-700">{row.stokAkhirUnit?.toLocaleString()} {row.unit}</p>
          )}
          {row.unit === "BOTOL" && (
            <p className="font-mono font-bold text-pink-700">{row.stokAkhirBotol?.toLocaleString()} BOTOL</p>
          )}
          <p className="text-gray-500 text-xs">{row.stokAkhirKG.toLocaleString()} KG</p>
        </div>
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

                  {!isKG && (
                    <Input
                      label="Bobot Per Unit (KG)"
                      type="number"
                      name="bobotPerUnit"
                      value={formData.bobotPerUnit}
                      onChange={handleChange}
                      placeholder="Contoh: 50"
                      error={errors.bobotPerUnit}
                      required
                    />
                  )}
                </div>
              </Card>

              <Card title="Stok Awal" icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }>
                <div className="space-y-4">
                  {isUnitBased && (
                    <Input
                      label={`Stok Awal (${formData.unit})`}
                      type="number"
                      name="stokAwalUnit"
                      value={formData.stokAwalUnit}
                      onChange={handleChange}
                      placeholder={`Masukkan stok awal dalam ${formData.unit}`}
                      error={errors.stokAwalUnit}
                      required
                    />
                  )}

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

                  {isBottle && (
                    <Input
                      label="Stok Awal (BOTOL)"
                      type="number"
                      name="stokAwalBotol"
                      value={formData.stokAwalBotol}
                      onChange={handleChange}
                      placeholder="Masukkan stok awal dalam BOTOL"
                      error={errors.stokAwalBotol}
                      required
                    />
                  )}
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

                  {isBottle && (
                    <Input
                      label="Barang Masuk (BOTOL)"
                      type="number"
                      name="barangMasukBotol"
                      value={formData.barangMasukBotol}
                      onChange={handleChange}
                      placeholder="Masukkan barang masuk dalam BOTOL"
                      error={errors.barangMasukBotol}
                      required
                    />
                  )}

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

                  {isBottle && (
                    <Input
                      label="Barang Keluar (BOTOL)"
                      type="number"
                      name="barangKeluarBotol"
                      value={formData.barangKeluarBotol}
                      onChange={handleChange}
                      placeholder="Masukkan barang keluar dalam BOTOL"
                      error={errors.barangKeluarBotol}
                      required
                    />
                  )}
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

                  {(isUnitBased || isKG) && (
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200">
                      <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">
                        {isUnitBased ? `Stok Barang (${formData.unit})` : "Stok (KG)"}
                      </p>
                      <p className="text-3xl font-bold text-amber-700 font-mono">
                        {isUnitBased ? preview.stokAkhirUnit.toLocaleString() : preview.stokAkhirKG.toLocaleString()}
                      </p>
                      {isUnitBased && (
                        <p className="text-xs text-amber-500 mt-1">
                          Perhitungan: 1 {formData.unit} = {formData.bobotPerUnit || 50} KG
                        </p>
                      )}
                    </div>
                  )}

                  {isBottle && (
                    <div className="p-4 bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl border border-pink-200">
                      <p className="text-xs text-pink-600 uppercase tracking-wide font-semibold mb-1">Stok Akhir (BOTOL)</p>
                      <p className="text-3xl font-bold text-pink-700 font-mono">{preview.stokAkhirBotol.toLocaleString()}</p>
                    </div>
                  )}
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
                    bobotPerUnit: "50",
                    stokAwalUnit: "",
                    stokAwalKG: "",
                    stokAwalBotol: "",
                    barangMasukKG: "",
                    barangMasukBotol: "",
                    barangKeluarKG: "",
                    barangKeluarBotol: "",
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