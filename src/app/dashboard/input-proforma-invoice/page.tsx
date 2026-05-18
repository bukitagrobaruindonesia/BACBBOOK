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
import { StockGudang } from "@/app/types";

export default function InputProformaInvoicePage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockGudang[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    nomorPI: "",
    namaCustomer: "",
    namaProduk: "",
    fot: "",
    kuantitasKG: "",
    barangDiambil: "",
    sisaBarang: "",
    kodeBeritaAcara: "",
    kodeInvoice: "",
    keterangan: "",
  });

  const [files, setFiles] = useState({
    fileBeritaAcara: null as File | null,
    fileInvoice: null as File | null,
  });

  const [filePreviews, setFilePreviews] = useState({
    fileBeritaAcara: "",
    fileInvoice: "",
  });

  useEffect(() => {
    fetchStockGudang();
  }, []);

  useEffect(() => {
    const kuantitas = parseFloat(formData.kuantitasKG) || 0;
    const diambil = parseFloat(formData.barangDiambil) || 0;
    const sisa = kuantitas - diambil;
    setFormData((prev) => ({ ...prev, sisaBarang: sisa >= 0 ? sisa.toString() : "0" }));
  }, [formData.kuantitasKG, formData.barangDiambil]);

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StockGudang));
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.nomorPI.trim()) newErrors.nomorPI = "Nomor PI wajib diisi";
    if (!formData.namaCustomer.trim()) newErrors.namaCustomer = "Nama customer wajib diisi";
    if (!formData.namaProduk) newErrors.namaProduk = "Nama produk wajib dipilih";
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";
    if (!formData.kuantitasKG || parseFloat(formData.kuantitasKG) <= 0) newErrors.kuantitasKG = "Kuantitas harus lebih dari 0";
    if (!formData.barangDiambil || parseFloat(formData.barangDiambil) < 0) newErrors.barangDiambil = "Barang diambil tidak valid";
    if (!formData.kodeBeritaAcara.trim()) newErrors.kodeBeritaAcara = "Kode berita acara wajib diisi";
    if (!files.fileBeritaAcara) newErrors.fileBeritaAcara = "File berita acara wajib diupload";
    if (!formData.kodeInvoice.trim()) newErrors.kodeInvoice = "Kode invoice wajib diisi";
    if (!files.fileInvoice) newErrors.fileInvoice = "File invoice wajib diupload";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: "fileBeritaAcara" | "fileInvoice") => {
    const file = e.target.files?.[0] || null;
    if (file && file.type !== "application/pdf") {
      setErrors((prev) => ({ ...prev, [field]: "File harus berformat PDF" }));
      return;
    }
    if (file && file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, [field]: "Ukuran file maksimal 2MB untuk penyimpanan Firestore" }));
      return;
    }
    setFiles((prev) => ({ ...prev, [field]: file }));
    if (file) {
      const base64 = await fileToBase64(file);
      setFilePreviews((prev) => ({ ...prev, [field]: base64 }));
    }
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      let fileBeritaAcaraBase64 = "";
      let fileInvoiceBase64 = "";

      if (files.fileBeritaAcara) {
        fileBeritaAcaraBase64 = await fileToBase64(files.fileBeritaAcara);
      }
      if (files.fileInvoice) {
        fileInvoiceBase64 = await fileToBase64(files.fileInvoice);
      }

      await addDoc(collection(db, "proformaInvoice"), {
        tanggal: formData.tanggal,
        nomorPI: formData.nomorPI.trim(),
        namaCustomer: formData.namaCustomer.trim(),
        namaProduk: formData.namaProduk,
        fot: formData.fot.trim(),
        kuantitasKG: parseFloat(formData.kuantitasKG),
        barangDiambil: parseFloat(formData.barangDiambil),
        sisaBarang: parseFloat(formData.sisaBarang),
        kodeBeritaAcara: formData.kodeBeritaAcara.trim(),
        fileBeritaAcara: fileBeritaAcaraBase64,
        fileBeritaAcaraName: files.fileBeritaAcara?.name || "",
        kodeInvoice: formData.kodeInvoice.trim(),
        fileInvoice: fileInvoiceBase64,
        fileInvoiceName: files.fileInvoice?.name || "",
        keterangan: formData.keterangan.trim(),
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessMessage("Proforma Invoice berhasil disimpan!");
      setFormData({
        tanggal: new Date().toISOString().split("T")[0],
        nomorPI: "",
        namaCustomer: "",
        namaProduk: "",
        fot: "",
        kuantitasKG: "",
        barangDiambil: "",
        sisaBarang: "",
        kodeBeritaAcara: "",
        kodeInvoice: "",
        keterangan: "",
      });
      setFiles({ fileBeritaAcara: null, fileInvoice: null });
      setFilePreviews({ fileBeritaAcara: "", fileInvoice: "" });

      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
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

  const stockOptions = [
    { value: "", label: "Pilih produk dari stock gudang..." },
    ...stockList.map((stock) => ({
      value: stock.namaBarang,
      label: `${stock.namaBarang} (${stock.kodeBarang}) - Stok: ${stock.stokAkhirKG.toLocaleString()} KG`,
    })),
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Header title="Input Proforma Invoice" subtitle="Buat proforma invoice baru untuk customer" />

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Informasi Dasar">
            <div className="space-y-4">
              <Input label="Tanggal" type="date" name="tanggal" value={formData.tanggal} onChange={handleChange} error={errors.tanggal} required />
              <Input label="Nomor PI" type="text" name="nomorPI" value={formData.nomorPI} onChange={handleChange} placeholder="Contoh: PI/2026/001" error={errors.nomorPI} required />
              <Input label="Nama Customer" type="text" name="namaCustomer" value={formData.namaCustomer} onChange={handleChange} placeholder="Masukkan nama customer" error={errors.namaCustomer} required />
              <Select label="Nama Produk" name="namaProduk" value={formData.namaProduk} onChange={handleChange} options={stockOptions} placeholder="Pilih produk dari stock gudang" error={errors.namaProduk} required />
              <Input label="FOT" type="text" name="fot" value={formData.fot} onChange={handleChange} placeholder="Masukkan FOT" error={errors.fot} required />
            </div>
          </Card>

          <Card title="Informasi Kuantitas">
            <div className="space-y-4">
              <Input label="Kuantitas (KG)" type="number" name="kuantitasKG" value={formData.kuantitasKG} onChange={handleChange} placeholder="Masukkan kuantitas dalam KG" error={errors.kuantitasKG} required />
              <Input label="Barang Diambil" type="number" name="barangDiambil" value={formData.barangDiambil} onChange={handleChange} placeholder="Masukkan jumlah barang diambil" error={errors.barangDiambil} required />
              <Input label="Sisa Barang" type="number" name="sisaBarang" value={formData.sisaBarang} readOnly className="bg-gray-50" />
            </div>
          </Card>

          <Card title="Dokumen Berita Acara">
            <div className="space-y-4">
              <Input label="Kode Berita Acara" type="text" name="kodeBeritaAcara" value={formData.kodeBeritaAcara} onChange={handleChange} placeholder="Masukkan kode berita acara" error={errors.kodeBeritaAcara} required />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Upload File Berita Acara (PDF, max 2MB)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, "fileBeritaAcara")} className="hidden" id="file-berita-acara" />
                <label htmlFor="file-berita-acara" className={`flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${files.fileBeritaAcara ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-green-400"}`}>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{files.fileBeritaAcara ? files.fileBeritaAcara.name : "Klik untuk upload PDF"}</p>
                    <p className="text-xs text-gray-400 mt-1">Maksimal 2MB (disimpan di Firestore)</p>
                  </div>
                </label>
                {errors.fileBeritaAcara && <p className="mt-1 text-sm text-red-600">{errors.fileBeritaAcara}</p>}
                {filePreviews.fileBeritaAcara && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">File siap disimpan ke Firestore</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Dokumen Invoice">
            <div className="space-y-4">
              <Input label="Kode Invoice" type="text" name="kodeInvoice" value={formData.kodeInvoice} onChange={handleChange} placeholder="Masukkan kode invoice" error={errors.kodeInvoice} required />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Upload File Invoice (PDF, max 2MB)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input type="file" accept=".pdf" onChange={(e) => handleFileChange(e, "fileInvoice")} className="hidden" id="file-invoice" />
                <label htmlFor="file-invoice" className={`flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${files.fileInvoice ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-green-400"}`}>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{files.fileInvoice ? files.fileInvoice.name : "Klik untuk upload PDF"}</p>
                    <p className="text-xs text-gray-400 mt-1">Maksimal 2MB (disimpan di Firestore)</p>
                  </div>
                </label>
                {errors.fileInvoice && <p className="mt-1 text-sm text-red-600">{errors.fileInvoice}</p>}
                {filePreviews.fileInvoice && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">File siap disimpan ke Firestore</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <Card title="Keterangan Tambahan">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Keterangan</label>
            <textarea name="keterangan" value={formData.keterangan} onChange={handleChange} rows={4} placeholder="Masukkan keterangan tambahan jika ada" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none" />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => {
            setFormData({ tanggal: new Date().toISOString().split("T")[0], nomorPI: "", namaCustomer: "", namaProduk: "", fot: "", kuantitasKG: "", barangDiambil: "", sisaBarang: "", kodeBeritaAcara: "", kodeInvoice: "", keterangan: "" });
            setFiles({ fileBeritaAcara: null, fileInvoice: null });
            setFilePreviews({ fileBeritaAcara: "", fileInvoice: "" });
            setErrors({});
          }}>
            Reset Form
          </Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            Simpan Proforma Invoice
          </Button>
        </div>
      </form>
    </div>
  );
}