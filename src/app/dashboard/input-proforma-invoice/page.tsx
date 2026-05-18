"use client";

import React, { useState, useEffect, useCallback } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { StockGudang } from "@/app/types";

const ALLOWED_FILE_TYPES = ["application/pdf"];
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAGIC_BYTES_PDF = [0x25, 0x50, 0x44, 0x46];

function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();
}

function validateFileType(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const arr = new Uint8Array(reader.result as ArrayBuffer).subarray(0, 4);
      const isValidPDF = arr.every((byte, index) => byte === MAGIC_BYTES_PDF[index]);
      resolve(isValidPDF && file.type === "application/pdf");
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 4));
  });
}

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
      console.error("Error fetching stock:", error);
    }
  };

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";

    const nomorPI = sanitizeString(formData.nomorPI);
    if (!nomorPI || nomorPI.length < 3) newErrors.nomorPI = "Nomor PI wajib diisi (min 3 karakter)";
    if (nomorPI.length > 50) newErrors.nomorPI = "Nomor PI maksimal 50 karakter";

    const namaCustomer = sanitizeString(formData.namaCustomer);
    if (!namaCustomer || namaCustomer.length < 2) newErrors.namaCustomer = "Nama customer wajib diisi (min 2 karakter)";
    if (namaCustomer.length > 100) newErrors.namaCustomer = "Nama customer maksimal 100 karakter";

    if (!formData.namaProduk) newErrors.namaProduk = "Nama produk wajib dipilih";

    const fot = sanitizeString(formData.fot);
    if (!fot || fot.length < 2) newErrors.fot = "FOT wajib diisi (min 2 karakter)";
    if (fot.length > 50) newErrors.fot = "FOT maksimal 50 karakter";

    const kuantitas = parseFloat(formData.kuantitasKG);
    if (!formData.kuantitasKG || isNaN(kuantitas) || kuantitas <= 0) newErrors.kuantitasKG = "Kuantitas harus lebih dari 0";
    if (kuantitas > 999999) newErrors.kuantitasKG = "Kuantitas terlalu besar";

    const diambil = parseFloat(formData.barangDiambil);
    if (!formData.barangDiambil || isNaN(diambil) || diambil < 0) newErrors.barangDiambil = "Barang diambil tidak valid";
    if (diambil > kuantitas) newErrors.barangDiambil = "Barang diambil tidak boleh melebihi kuantitas";

    const kodeBA = sanitizeString(formData.kodeBeritaAcara);
    if (!kodeBA || kodeBA.length < 2) newErrors.kodeBeritaAcara = "Kode berita acara wajib diisi";
    if (kodeBA.length > 50) newErrors.kodeBeritaAcara = "Kode berita acara maksimal 50 karakter";

    if (!files.fileBeritaAcara) newErrors.fileBeritaAcara = "File berita acara wajib diupload";

    const kodeInv = sanitizeString(formData.kodeInvoice);
    if (!kodeInv || kodeInv.length < 2) newErrors.kodeInvoice = "Kode invoice wajib diisi";
    if (kodeInv.length > 50) newErrors.kodeInvoice = "Kode invoice maksimal 50 karakter";

    if (!files.fileInvoice) newErrors.fileInvoice = "File invoice wajib diupload";

    const keterangan = sanitizeString(formData.keterangan);
    if (keterangan.length > 500) newErrors.keterangan = "Keterangan maksimal 500 karakter";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, files]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, field: "fileBeritaAcara" | "fileInvoice") => {
    const file = e.target.files?.[0] || null;

    if (!file) return;

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, [field]: "File harus berformat PDF" }));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, [field]: "Ukuran file maksimal 2MB" }));
      return;
    }

    const isValidMagic = await validateFileType(file);
    if (!isValidMagic) {
      setErrors((prev) => ({ ...prev, [field]: "File PDF tidak valid atau corrupt" }));
      return;
    }

    setFiles((prev) => ({ ...prev, [field]: file }));
    setFilePreviews((prev) => ({ ...prev, [field]: file.name }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  };

  const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${sanitizedName}`;
    const storageRef = ref(storage, `${path}/${fileName}`);
    await uploadBytes(storageRef, file, { contentType: "application/pdf" });
    return getDownloadURL(storageRef);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      let fileBeritaAcaraURL = "";
      let fileInvoiceURL = "";

      if (files.fileBeritaAcara) {
        fileBeritaAcaraURL = await uploadFileToStorage(files.fileBeritaAcara, "berita-acara");
      }
      if (files.fileInvoice) {
        fileInvoiceURL = await uploadFileToStorage(files.fileInvoice, "invoice");
      }

      await addDoc(collection(db, "proformaInvoice"), {
        tanggal: formData.tanggal,
        nomorPI: sanitizeString(formData.nomorPI).toUpperCase(),
        namaCustomer: sanitizeString(formData.namaCustomer),
        namaProduk: formData.namaProduk,
        fot: sanitizeString(formData.fot).toUpperCase(),
        kuantitasKG: parseFloat(formData.kuantitasKG),
        barangDiambil: parseFloat(formData.barangDiambil),
        sisaBarang: parseFloat(formData.sisaBarang),
        kodeBeritaAcara: sanitizeString(formData.kodeBeritaAcara).toUpperCase(),
        fileBeritaAcara: fileBeritaAcaraURL,
        fileBeritaAcaraName: files.fileBeritaAcara?.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "",
        kodeInvoice: sanitizeString(formData.kodeInvoice).toUpperCase(),
        fileInvoice: fileInvoiceURL,
        fileInvoiceName: files.fileInvoice?.name.replace(/[^a-zA-Z0-9.-]/g, "_") || "",
        keterangan: sanitizeString(formData.keterangan),
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
      console.error("Submit error:", error);
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Informasi Dasar">
            <div className="space-y-4">
              <Input label="Tanggal" type="date" name="tanggal" value={formData.tanggal} onChange={handleChange} error={errors.tanggal} required />
              <Input label="Nomor PI" type="text" name="nomorPI" value={formData.nomorPI} onChange={handleChange} placeholder="Contoh: PI/2026/001" error={errors.nomorPI} required maxLength={50} />
              <Input label="Nama Customer" type="text" name="namaCustomer" value={formData.namaCustomer} onChange={handleChange} placeholder="Masukkan nama customer" error={errors.namaCustomer} required maxLength={100} />
              <Select label="Nama Produk" name="namaProduk" value={formData.namaProduk} onChange={handleChange} options={stockOptions} placeholder="Pilih produk dari stock gudang" error={errors.namaProduk} required />
              <Input label="FOT" type="text" name="fot" value={formData.fot} onChange={handleChange} placeholder="Masukkan FOT" error={errors.fot} required maxLength={50} />
            </div>
          </Card>

          <Card title="Informasi Kuantitas">
            <div className="space-y-4">
              <Input label="Kuantitas (KG)" type="number" name="kuantitasKG" value={formData.kuantitasKG} onChange={handleChange} placeholder="Masukkan kuantitas dalam KG" error={errors.kuantitasKG} required min={0} step="0.01" />
              <Input label="Barang Diambil" type="number" name="barangDiambil" value={formData.barangDiambil} onChange={handleChange} placeholder="Masukkan jumlah barang diambil" error={errors.barangDiambil} required min={0} step="0.01" />
              <Input label="Sisa Barang" type="number" name="sisaBarang" value={formData.sisaBarang} readOnly className="bg-gray-50" />
            </div>
          </Card>

          <Card title="Dokumen Berita Acara">
            <div className="space-y-4">
              <Input label="Kode Berita Acara" type="text" name="kodeBeritaAcara" value={formData.kodeBeritaAcara} onChange={handleChange} placeholder="Masukkan kode berita acara" error={errors.kodeBeritaAcara} required maxLength={50} />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Upload File Berita Acara (PDF, max 2MB)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFileChange(e, "fileBeritaAcara")}
                  className="hidden"
                  id="file-berita-acara"
                  aria-describedby="file-berita-acara-help"
                />
                <label
                  htmlFor="file-berita-acara"
                  className={`flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    files.fileBeritaAcara ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-green-400"
                  }`}
                >
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{files.fileBeritaAcara ? files.fileBeritaAcara.name : "Klik untuk upload PDF"}</p>
                    <p className="text-xs text-gray-400 mt-1" id="file-berita-acara-help">Maksimal 2MB, format PDF</p>
                  </div>
                </label>
                {errors.fileBeritaAcara && <p className="mt-1 text-sm text-red-600">{errors.fileBeritaAcara}</p>}
                {filePreviews.fileBeritaAcara && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">File siap diupload ke cloud storage</p>
                  </div>
                )}
              </div>
            </div>
          </Card>

          <Card title="Dokumen Invoice">
            <div className="space-y-4">
              <Input label="Kode Invoice" type="text" name="kodeInvoice" value={formData.kodeInvoice} onChange={handleChange} placeholder="Masukkan kode invoice" error={errors.kodeInvoice} required maxLength={50} />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Upload File Invoice (PDF, max 2MB)
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFileChange(e, "fileInvoice")}
                  className="hidden"
                  id="file-invoice"
                  aria-describedby="file-invoice-help"
                />
                <label
                  htmlFor="file-invoice"
                  className={`flex items-center justify-center w-full px-4 py-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
                    files.fileInvoice ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-green-400"
                  }`}
                >
                  <div className="text-center">
                    <p className="text-sm text-gray-600">{files.fileInvoice ? files.fileInvoice.name : "Klik untuk upload PDF"}</p>
                    <p className="text-xs text-gray-400 mt-1" id="file-invoice-help">Maksimal 2MB, format PDF</p>
                  </div>
                </label>
                {errors.fileInvoice && <p className="mt-1 text-sm text-red-600">{errors.fileInvoice}</p>}
                {filePreviews.fileInvoice && (
                  <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                    <p className="text-xs text-blue-600">File siap diupload ke cloud storage</p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        <Card title="Keterangan Tambahan">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Keterangan</label>
            <textarea
              name="keterangan"
              value={formData.keterangan}
              onChange={handleChange}
              rows={4}
              placeholder="Masukkan keterangan tambahan jika ada"
              maxLength={500}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{formData.keterangan.length}/500 karakter</p>
            {errors.keterangan && <p className="mt-1 text-sm text-red-600">{errors.keterangan}</p>}
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
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
              setErrors({});
            }}
          >
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