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
  const [stockList, setStockList] = useState([] as StockGudang[]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState({} as Record<string, string>);

  const [formData, setFormData] = useState({
    fot: "",
    kodeBarang: "",
    namaBarang: "",
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    bobotPerUnit: "50",
    stokTersediaUnit: "",
    stokTersediaKG: "",
    botolPerDus: "20",
  });

  const [fotList, setFotList] = useState([] as string[]);
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

  const getDisplayUnit = () => {
    if (formData.unit === "BOTOL") return "ZAK";
    return formData.unit;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";
    if (!formData.kodeBarang.trim()) newErrors.kodeBarang = "Kode barang wajib diisi";
    if (!formData.namaBarang.trim()) newErrors.namaBarang = "Nama barang wajib diisi";

    const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";
    const isKG = formData.unit === "KG";
    const isBotol = formData.unit === "BOTOL";

    if (isUnitBased) {
      if (!formData.bobotPerUnit || parseFloat(formData.bobotPerUnit) <= 0) newErrors.bobotPerUnit = "Bobot per unit tidak valid";
      if (!formData.stokTersediaUnit || parseFloat(formData.stokTersediaUnit) < 0) newErrors.stokTersediaUnit = "Stok tersedia tidak valid";
    }

    if (!isBotol && !isKG) {
      if (!formData.stokTersediaKG || parseFloat(formData.stokTersediaKG) < 0) newErrors.stokTersediaKG = "Stok tersedia KG tidak valid";
    }

    if (isBotol) {
      if (!formData.botolPerDus || parseFloat(formData.botolPerDus) <= 0) newErrors.botolPerDus = "Jumlah botol per dus tidak valid";
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
      const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";
      const isBotol = formData.unit === "BOTOL";
      const stokTersediaUnit = isUnitBased ? parseFloat(formData.stokTersediaUnit) : 0;
      const stokTersediaKG = isBotol ? 0 : parseFloat(formData.stokTersediaKG);
      const bobotPerUnit = parseFloat(formData.bobotPerUnit) || 50;
      const botolPerDus = isBotol ? parseFloat(formData.botolPerDus) || 20 : null;

      const docData: any = {
        fot: formData.fot.trim().toUpperCase(),
        kodeBarang: formData.kodeBarang.trim().toUpperCase(),
        namaBarang: formData.namaBarang.trim(),
        unit: formData.unit,
        bobotPerUnit: bobotPerUnit,
        stokAwalUnit: stokTersediaUnit,
        stokAwalKG: stokTersediaKG,
        barangMasukUnit: 0,
        barangMasukKG: 0,
        barangKeluarUnit: 0,
        barangKeluarKG: 0,
        stokAkhirUnit: stokTersediaUnit,
        stokAkhirKG: stokTersediaKG,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isBotol) {
        docData.botolPerDus = botolPerDus;
        docData.displayUnit = "ZAK";
      }

      await addDoc(collection(db, "stockGudang"), docData);

      setSuccessMessage("Stock gudang berhasil disimpan!");
      setFormData({
        fot: "",
        kodeBarang: "",
        namaBarang: "",
        unit: "ZAK",
        bobotPerUnit: "50",
        stokTersediaUnit: "",
        stokTersediaKG: "",
        botolPerDus: "20",
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

  const handleChange = (e: any) => {
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
  const isKG = formData.unit === "KG";
  const isBotol = formData.unit === "BOTOL";

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
      key: "konversi",
      header: "Konversi",
      width: "140px",
      render: (row: StockGudang) => {
        if (row.unit === "BOTOL") {
          return (
            <div className="text-xs">
              <p className="font-mono text-pink-600">{row.botolPerDus || 20} botol/DUS</p>
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
      key: "stokTersedia",
      header: "Stok Tersedia",
      width: "160px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {row.unit !== "KG" && (
            <p className="font-mono font-bold text-green-700">
              {row.unit === "BOTOL"
                ? `${row.stokAkhirUnit?.toLocaleString()} ZAK`
                : `${row.stokAkhirUnit?.toLocaleString()} ${row.unit}`
              }
            </p>
          )}
          {row.unit === "KG" && (
            <p className="font-mono font-bold text-green-700">{row.stokAkhirKG.toLocaleString()} KG</p>
          )}
          {row.unit !== "BOTOL" && row.unit !== "KG" && (
            <p className="text-gray-500 text-xs">{row.stokAkhirKG.toLocaleString()} KG</p>
          )}
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

                  {isUnitBased && (
                    <Input
                      label={isBotol ? "Bobot Per Botol (ml)" : "Bobot Per Unit (KG)"}
                      type="number"
                      name="bobotPerUnit"
                      value={formData.bobotPerUnit}
                      onChange={handleChange}
                      placeholder={isBotol ? "Contoh: 500" : "Contoh: 50"}
                      error={errors.bobotPerUnit}
                      required
                    />
                  )}

                  {isBotol && (
                    <Input
                      label="Botol Per DUS"
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

              <Card title="Stok Tersedia" icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              }>
                <div className="space-y-4">
                  {isUnitBased && (
                    <Input
                      label={`Stok Tersedia (${getDisplayUnit()})`}
                      type="number"
                      name="stokTersediaUnit"
                      value={formData.stokTersediaUnit}
                      onChange={handleChange}
                      placeholder={`Masukkan stok tersedia dalam ${getDisplayUnit()}`}
                      error={errors.stokTersediaUnit}
                      required
                    />
                  )}

                  {!isBotol && (
                    <Input
                      label="Stok Tersedia (KG)"
                      type="number"
                      name="stokTersediaKG"
                      value={formData.stokTersediaKG}
                      onChange={handleChange}
                      placeholder="Masukkan stok tersedia dalam KG"
                      error={errors.stokTersediaKG}
                      required
                    />
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
                    stokTersediaUnit: "",
                    stokTersediaKG: "",
                    botolPerDus: "20",
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