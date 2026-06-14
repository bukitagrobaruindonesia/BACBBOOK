"use client";

import React, { useState, useEffect, useRef } from "react";
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
  namaProdusen: string;
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

interface BarangRusakItem {
  unit: string;
  jumlah: string;
  keterangan: string;
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
    namaProdusen: "",
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    jumlahZAK: "",
    botolPerDus: "",
    fot: "",
    nomorKontainer: "",
    nomorDO: "",
  });

  const [sopirNopolList, setSopirNopolList] = useState<SopirNopolItem[]>([
    { id: 1, namaSopir: "", nopol: "", nomorSIM: "" },
  ]);
  const formRef = useRef<HTMLFormElement>(null);

  const [matchedStock, setMatchedStock] = useState<StockItem | null>(null);
  const [showNewStockModal, setShowNewStockModal] = useState(false);
  const [newStockData, setNewStockData] = useState({
    bobotPerUnit: "50",
    stokTersediaUnit: "",
    botolPerDus: "20",
    volumeMl: "500",
  });

  const [fotoFiles, setFotoFiles] = useState<string[]>([]);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [barangRusakList, setBarangRusakList] = useState<BarangRusakItem[]>([]);
  const [adaBarangRusak, setAdaBarangRusak] = useState(false);

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "KG", label: "KG" },
    { value: "BOTOL", label: "BOTOL" },
  ];

  const unitRusakOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "KG", label: "KG" },
    { value: "BOTOL", label: "BOTOL" },
    { value: "UNIT", label: "UNIT" },
  ];

  useEffect(() => {
    fetchStockGudang();
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const numberInputs = form.querySelectorAll('input[type="number"]');
    const handler = (e: Event) => {
      (e.target as HTMLInputElement).blur();
    };
    numberInputs.forEach((input) => {
      input.addEventListener("wheel", handler, { passive: true });
    });
    return () => {
      numberInputs.forEach((input) => {
        input.removeEventListener("wheel", handler);
      });
    };
  }, []);

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        namaProdusen: doc.data().namaProdusen || "",
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

  const compressImage = (file: File, maxSizeMB: number = 2): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas context failed")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          let quality = 0.9;
          let result = canvas.toDataURL("image/jpeg", quality);
          const maxBytes = maxSizeMB * 1024 * 1024;
          while (result.length > maxBytes && quality > 0.1) {
            quality -= 0.1;
            result = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(result);
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  };

  const handleFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setFotoLoading(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressed = await compressImage(file, 2);
        newPhotos.push(compressed);
      }
      setFotoFiles((prev) => [...prev, ...newPhotos]);
    } catch (error) {
      console.error(error);
      setErrors((prev) => ({ ...prev, foto: "Gagal memproses foto. Silakan coba lagi." }));
    } finally {
      setFotoLoading(false);
      e.target.value = "";
    }
  };

  const removeFoto = (index: number) => {
    setFotoFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleNamaBarangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedNama = e.target.value;
    if (!selectedNama) {
      setFormData((prev) => ({
        ...prev,
        namaBarang: "",
        kodeBarang: "",
        namaProdusen: "",
        unit: "ZAK",
        fot: "",
        botolPerDus: "",
      }));
      setMatchedStock(null);
      return;
    }
    const match = stockList.find((s) => s.namaBarang === selectedNama);
    if (match) {
      setMatchedStock(match);
      setFormData((prev) => ({
        ...prev,
        namaBarang: match.namaBarang,
        kodeBarang: match.kodeBarang,
        namaProdusen: match.namaProdusen,
        unit: match.unit,
        fot: match.fot,
        botolPerDus: match.botolPerDus ? match.botolPerDus.toString() : "",
      }));
    }
    if (errors.namaBarang) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.namaBarang;
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

  const addBarangRusak = () => {
    setBarangRusakList((prev) => [...prev, { unit: "ZAK", jumlah: "", keterangan: "" }]);
  };

  const removeBarangRusak = (index: number) => {
    setBarangRusakList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBarangRusakChange = (index: number, field: keyof BarangRusakItem, value: string) => {
    setBarangRusakList((prev) => {
      const newList = [...prev];
      newList[index] = { ...newList[index], [field]: value };
      return newList;
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.namaBarang.trim()) newErrors.namaBarang = "Nama barang wajib dipilih";
    if (!formData.jumlahZAK || parseFloat(formData.jumlahZAK) <= 0) newErrors.jumlahZAK = "Jumlah harus lebih dari 0";
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";
    if (!formData.nomorKontainer.trim()) newErrors.nomorKontainer = "Nomor kontainer wajib diisi";

    if (formData.unit === "BOTOL") {
      if (!formData.botolPerDus || parseFloat(formData.botolPerDus) <= 0) newErrors.botolPerDus = "Botol per DUS tidak valid";
    }

    if (adaBarangRusak && barangRusakList.length > 0) {
      barangRusakList.forEach((item, idx) => {
        if (!item.jumlah || parseFloat(item.jumlah) <= 0) {
          newErrors[`barangRusak_${idx}_jumlah`] = "Jumlah barang rusak tidak valid";
        }
        if (!item.keterangan.trim()) {
          newErrors[`barangRusak_${idx}_keterangan`] = "Keterangan wajib diisi";
        }
      });
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
        namaProdusen: "",
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
        namaProdusen: "",
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

      const barangRusakData = adaBarangRusak
        ? barangRusakList
            .filter((b) => b.jumlah && parseFloat(b.jumlah) > 0)
            .map((b) => ({
              unit: b.unit,
              jumlah: parseFloat(b.jumlah) || 0,
              keterangan: b.keterangan.trim(),
            }))
        : [];

      const transaksiData: any = {
        tanggal: formData.tanggal,
        kodeBarang: formData.kodeBarang.trim(),
        namaBarang: formData.namaBarang.trim(),
        unit: formData.unit,
        jumlahZAK: jumlahZAK,
        totalKG: totalKG,
        sopirNopolList: sopirNopolValues.length > 0 ? sopirNopolValues : null,
        fot: formData.fot.trim().toUpperCase(),
        nomorKontainer: formData.nomorKontainer.trim().toUpperCase(),
        nomorDO: formData.nomorDO.trim().toUpperCase() || null,
        fotoUrls: fotoFiles.length > 0 ? fotoFiles : null,
        barangRusak: barangRusakData.length > 0 ? barangRusakData : null,
        adaBarangRusak: adaBarangRusak && barangRusakData.length > 0,
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
        namaProdusen: "",
        unit: "ZAK",
        jumlahZAK: "",
        botolPerDus: "",
        fot: "",
        nomorKontainer: "",
        nomorDO: "",
      });
      setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
      setMatchedStock(null);
      setFotoFiles([]);
      setBarangRusakList([]);
      setAdaBarangRusak(false);

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

  const namaBarangOptions = [
    { value: "", label: "Pilih nama barang..." },
    ...stockList.map((s) => ({ value: s.namaBarang, label: `${s.namaBarang} (${s.kodeBarang})` })),
  ];

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

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
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

            <Select
              label="Nama Barang"
              name="namaBarang"
              value={formData.namaBarang}
              onChange={handleNamaBarangChange}
              options={namaBarangOptions}
              error={errors.namaBarang}
              required
            />

            <Input
              label="Kode Barang"
              type="text"
              name="kodeBarang"
              value={formData.kodeBarang}
              onChange={handleChange}
              placeholder="Otomatis dari nama barang"
              error={errors.kodeBarang}
              readOnly
              className="bg-gray-100"
            />

            <Input
              label="Nama Produsen"
              type="text"
              name="namaProdusen"
              value={formData.namaProdusen}
              onChange={handleChange}
              placeholder="Otomatis dari nama barang"
              error={errors.namaProdusen}
              readOnly
              className="bg-gray-100"
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
              placeholder="Otomatis dari nama barang"
              error={errors.fot}
              readOnly
              className="bg-gray-100"
            />

            <Input
              label="Nomor Kontainer"
              type="text"
              name="nomorKontainer"
              value={formData.nomorKontainer}
              onChange={handleChange}
              placeholder="Contoh: BSIU 123456 7"
              error={errors.nomorKontainer}
              required
            />

            <Input
              label="Nomor DO (Delivery Order)"
              type="text"
              name="nomorDO"
              value={formData.nomorDO}
              onChange={handleChange}
              placeholder="Opsional"
              error={errors.nomorDO}
            />
          </div>

          {matchedStock && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <p className="text-sm text-blue-700 font-medium">
                Barang ditemukan di database: Stok tersedia {matchedStock.stokAkhirUnit?.toLocaleString()} {matchedStock.unit} ({matchedStock.stokAkhirKG.toLocaleString()} KG)
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Kode, produsen, unit, FOT, dan bobot otomatis disesuaikan dari data gudang
              </p>
            </div>
          )}

          {!matchedStock && formData.namaBarang.trim() && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700 font-medium">
                Barang baru terdeteksi: <span className="font-mono font-bold">{formData.namaBarang}</span> belum terdaftar di stock gudang
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

        <Card title="Foto Dokumentasi">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <label className="relative cursor-pointer inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Tambah Foto
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFotoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={fotoLoading}
                />
              </label>
              {fotoLoading && (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Memproses...
                </span>
              )}
            </div>

            {errors.foto && (
              <p className="text-sm text-red-600">{errors.foto}</p>
            )}

            {fotoFiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {fotoFiles.map((foto, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={foto}
                      alt={`Foto ${idx + 1}`}
                      className="w-full h-32 object-cover rounded-lg border border-gray-200"
                    />
                    <button
                      type="button"
                      onClick={() => removeFoto(idx)}
                      className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <p className="text-xs text-center text-gray-500 mt-1">Foto {idx + 1}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-500">
              Maksimal 2MB per foto. Foto akan otomatis dikompres jika melebihi batas.
            </p>
          </div>
        </Card>

        <Card title="Barang Rusak">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="adaBarangRusak"
                checked={adaBarangRusak}
                onChange={(e) => setAdaBarangRusak(e.target.checked)}
                className="w-5 h-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
              />
              <label htmlFor="adaBarangRusak" className="text-sm font-medium text-gray-700">
                Terdapat barang rusak / cacat pada saat penerimaan
              </label>
            </div>

            {adaBarangRusak && (
              <div className="space-y-4">
                {barangRusakList.map((item, index) => (
                  <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-700">Barang Rusak {index + 1}</h4>
                      {barangRusakList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBarangRusak(index)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Select
                        label="Satuan"
                        value={item.unit}
                        onChange={(e) => handleBarangRusakChange(index, "unit", e.target.value)}
                        options={unitRusakOptions}
                        required
                      />
                      <Input
                        label="Jumlah"
                        type="number"
                        value={item.jumlah}
                        onChange={(e) => handleBarangRusakChange(index, "jumlah", e.target.value)}
                        placeholder="Masukkan jumlah"
                        error={errors[`barangRusak_${index}_jumlah`]}
                        required
                      />
                      <Input
                        label="Keterangan"
                        type="text"
                        value={item.keterangan}
                        onChange={(e) => handleBarangRusakChange(index, "keterangan", e.target.value)}
                        placeholder="Contoh: Kemasan sobek, basah, dll"
                        error={errors[`barangRusak_${index}_keterangan`]}
                        required
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBarangRusak}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Tambah Barang Rusak
                </Button>
              </div>
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
                namaProdusen: "",
                unit: "ZAK",
                jumlahZAK: "",
                botolPerDus: "",
                fot: "",
                nomorKontainer: "",
                nomorDO: "",
              });
              setSopirNopolList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
              setMatchedStock(null);
              setFotoFiles([]);
              setBarangRusakList([]);
              setAdaBarangRusak(false);
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