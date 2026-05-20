"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import { StockGudang } from "@/app/types";

interface ProdukItem {
  id: string;
  namaProduk: string;
  fot: string;
  kuantitas: string;
  satuan: string;
  hargaSatuan: string;
  totalHarga: number;
}

interface TTDData {
  id: string;
  nama: string;
  jabatan: string;
  ttdImage: string;
}

export default function InputProformaInvoicePage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockGudang[]>([]);
  const [ttdList, setTtdList] = useState<TTDData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    nomorPI: "",
    namaCustomer: "",
    alamatCustomer: "",
    metodePembayaran: "Transfer",
    uangMuka: "",
    includePPN: false,
    ppnNominal: 0,
    ongkosKirim: "",
    subtotal: 0,
    jumlahTertagih: 0,
    terbilang: "",
    tanggalJatuhTempo: "",
    keterangan: "",
    selectedTTD: "",
  });

  const [produkItems, setProdukItems] = useState<ProdukItem[]>([
    { id: "1", namaProduk: "", fot: "", kuantitas: "", satuan: "KG", hargaSatuan: "", totalHarga: 0 },
  ]);

  useEffect(() => {
    fetchStockGudang();
    fetchTTD();
    generateTanggalJatuhTempo();
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [produkItems, formData.uangMuka, formData.includePPN, formData.ongkosKirim]);

  const generateTanggalJatuhTempo = () => {
    const today = new Date();
    today.setHours(16, 0, 0, 0);
    const dateStr = today.toISOString().split("T")[0] + " 16.00 WIB";
    setFormData((prev) => ({ ...prev, tanggalJatuhTempo: dateStr }));
  };

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

  const fetchTTD = async () => {
    try {
      const q = query(collection(db, "ttd"), orderBy("nama", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TTDData));
      setTtdList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const numberToWords = (num: number): string => {
    if (num === 0) return "NOL RUPIAH";
    const ones = ["", "SATU", "DUA", "TIGA", "EMPAT", "LIMA", "ENAM", "TUJUH", "DELAPAN", "SEMBILAN"];
    const teens = ["SEPULUH", "SEBELAS", "DUA BELAS", "TIGA BELAS", "EMPAT BELAS", "LIMA BELAS", "ENAM BELAS", "TUJUH BELAS", "DELAPAN BELAS", "SEMBILAN BELAS"];
    const tens = ["", "", "DUA PULUH", "TIGA PULUH", "EMPAT PULUH", "LIMA PULUH", "ENAM PULUH", "TUJUH PULUH", "DELAPAN PULUH", "SEMBILAN PULUH"];
    const thousands = ["", "RIBU", "JUTA", "MILIAR", "TRILIUN"];

    const convertThreeDigits = (n: number): string => {
      let result = "";
      const hundreds = Math.floor(n / 100);
      const remainder = n % 100;
      if (hundreds > 0) {
        if (hundreds === 1) result += "SERATUS ";
        else result += ones[hundreds] + " RATUS ";
      }
      if (remainder > 0) {
        if (remainder < 10) result += ones[remainder] + " ";
        else if (remainder < 20) result += teens[remainder - 10] + " ";
        else {
          const ten = Math.floor(remainder / 10);
          const one = remainder % 10;
          result += tens[ten] + " ";
          if (one > 0) result += ones[one] + " ";
        }
      }
      return result.trim();
    };

    if (num < 0) return "MINUS " + numberToWords(-num);
    let result = "";
    let i = 0;
    let tempNum = num;
    while (tempNum > 0) {
      const chunk = tempNum % 1000;
      if (chunk > 0) {
        let chunkWords = convertThreeDigits(chunk);
        if (i === 1 && chunk === 1) chunkWords = "SERIBU";
        else if (i > 0) chunkWords += " " + thousands[i];
        result = chunkWords + " " + result;
      }
      tempNum = Math.floor(tempNum / 1000);
      i++;
    }
    return result.trim() + " RUPIAH";
  };

  const calculateTotals = useCallback(() => {
    let subtotal = 0;
    const updatedItems = produkItems.map((item) => {
      const qty = parseFloat(item.kuantitas) || 0;
      const price = parseFloat(item.hargaSatuan) || 0;
      const total = qty * price;
      subtotal += total;
      return { ...item, totalHarga: total };
    });

    const uangMuka = parseFloat(formData.uangMuka) || 0;
    const ongkosKirim = parseFloat(formData.ongkosKirim) || 0;
    let ppn = 0;
    if (formData.includePPN) {
      ppn = subtotal * 0.11;
    }
    const jumlahTertagih = subtotal - uangMuka + ppn + ongkosKirim;
    const terbilang = numberToWords(Math.round(jumlahTertagih));

    setProdukItems(updatedItems);
    setFormData((prev) => ({
      ...prev,
      subtotal,
      ppnNominal: ppn,
      jumlahTertagih,
      terbilang,
    }));
  }, [produkItems, formData.uangMuka, formData.includePPN, formData.ongkosKirim]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleProdukChange = (id: string, field: string, value: string) => {
    setProdukItems((prev) => {
      return prev.map((item) => {
        if (item.id === id) {
          const newItem = { ...item, [field]: value };
          if (field === "namaProduk") {
            const stock = stockList.find((s) => s.namaBarang === value);
            if (stock) {
              newItem.fot = stock.fot || "";
            }
          }
          return newItem;
        }
        return item;
      });
    });
  };

  const addProdukItem = () => {
    const newId = Date.now().toString();
    setProdukItems((prev) => [
      ...prev,
      { id: newId, namaProduk: "", fot: "", kuantitas: "", satuan: "KG", hargaSatuan: "", totalHarga: 0 },
    ]);
  };

  const removeProdukItem = (id: string) => {
    if (produkItems.length > 1) {
      setProdukItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.nomorPI.trim()) newErrors.nomorPI = "Nomor PI wajib diisi";
    if (!formData.namaCustomer.trim()) newErrors.namaCustomer = "Nama customer wajib diisi";
    if (!formData.alamatCustomer.trim()) newErrors.alamatCustomer = "Alamat customer wajib diisi";
    if (!formData.selectedTTD) newErrors.selectedTTD = "Tanda tangan wajib dipilih";

    produkItems.forEach((item, index) => {
      if (!item.namaProduk) newErrors[`produk_${index}`] = `Produk baris ${index + 1} wajib dipilih`;
      if (!item.kuantitas || parseFloat(item.kuantitas) <= 0) newErrors[`kuantitas_${index}`] = `Kuantitas baris ${index + 1} harus lebih dari 0`;
      if (!item.hargaSatuan || parseFloat(item.hargaSatuan) <= 0) newErrors[`harga_${index}`] = `Harga baris ${index + 1} harus lebih dari 0`;
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const selectedTTD = ttdList.find((t) => t.id === formData.selectedTTD);

      await addDoc(collection(db, "proformaInvoice"), {
        tanggal: formData.tanggal,
        nomorPI: formData.nomorPI.trim(),
        namaCustomer: formData.namaCustomer.trim(),
        alamatCustomer: formData.alamatCustomer.trim(),
        metodePembayaran: formData.metodePembayaran,
        produkItems: produkItems.map((item) => ({
          namaProduk: item.namaProduk,
          fot: item.fot,
          kuantitas: parseFloat(item.kuantitas),
          satuan: item.satuan,
          hargaSatuan: parseFloat(item.hargaSatuan),
          totalHarga: item.totalHarga,
        })),
        uangMuka: parseFloat(formData.uangMuka) || 0,
        includePPN: formData.includePPN,
        ppnNominal: formData.ppnNominal,
        ongkosKirim: parseFloat(formData.ongkosKirim) || 0,
        subtotal: formData.subtotal,
        jumlahTertagih: formData.jumlahTertagih,
        terbilang: formData.terbilang,
        tanggalJatuhTempo: formData.tanggalJatuhTempo,
        keterangan: formData.keterangan.trim(),
        ttdNama: selectedTTD?.nama || "",
        ttdJabatan: selectedTTD?.jabatan || "",
        ttdImage: selectedTTD?.ttdImage || "",
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setSuccessMessage("Proforma Invoice berhasil disimpan!");
      setFormData({
        tanggal: new Date().toISOString().split("T")[0],
        nomorPI: "",
        namaCustomer: "",
        alamatCustomer: "",
        metodePembayaran: "Transfer",
        uangMuka: "",
        includePPN: false,
        ppnNominal: 0,
        ongkosKirim: "",
        subtotal: 0,
        jumlahTertagih: 0,
        terbilang: "",
        tanggalJatuhTempo: "",
        keterangan: "",
        selectedTTD: "",
      });
      setProdukItems([
        { id: "1", namaProduk: "", fot: "", kuantitas: "", satuan: "KG", hargaSatuan: "", totalHarga: 0 },
      ]);
      generateTanggalJatuhTempo();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stockOptions = [
    { value: "", label: "Pilih produk..." },
    ...stockList.map((stock) => ({
      value: stock.namaBarang,
      label: `${stock.namaBarang} (${stock.kodeBarang})`,
    })),
  ];

  const ttdOptions = [
    { value: "", label: "Pilih tanda tangan..." },
    ...ttdList.map((ttd) => ({
      value: ttd.id,
      label: `${ttd.nama} - ${ttd.jabatan}`,
    })),
  ];

  const satuanOptions = [
    { value: "KG", label: "KG" },
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
  ];

  const formatRupiah = (num: number) => {
    return "Rp " + num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

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
          <Card title="Informasi Customer">
            <div className="space-y-4">
              <Input label="Tanggal" type="date" name="tanggal" value={formData.tanggal} onChange={handleChange} error={errors.tanggal} required />
              <Input label="Nomor PI" type="text" name="nomorPI" value={formData.nomorPI} onChange={handleChange} placeholder="Contoh: BAGB-PI-0657" error={errors.nomorPI} required />
              <Input label="Nama Customer" type="text" name="namaCustomer" value={formData.namaCustomer} onChange={handleChange} placeholder="Masukkan nama customer" error={errors.namaCustomer} required />
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Alamat Customer <span className="text-red-500">*</span>
                </label>
                <textarea name="alamatCustomer" value={formData.alamatCustomer} onChange={handleChange} rows={3} placeholder="Masukkan alamat lengkap customer" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none ${errors.alamatCustomer ? "border-red-500" : "border-gray-300"}`} />
                {errors.alamatCustomer && <p className="mt-1 text-sm text-red-600">{errors.alamatCustomer}</p>}
              </div>
              <Select label="Metode Pembayaran" name="metodePembayaran" value={formData.metodePembayaran} onChange={handleChange} options={[{ value: "Transfer", label: "Transfer" }, { value: "Cash", label: "Cash" }]} required />
            </div>
          </Card>

          <Card title="Tanda Tangan">
            <div className="space-y-4">
              <Select label="Pilih Tanda Tangan" name="selectedTTD" value={formData.selectedTTD} onChange={handleChange} options={ttdOptions} error={errors.selectedTTD} required />
              {formData.selectedTTD && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  {(() => {
                    const selected = ttdList.find((t) => t.id === formData.selectedTTD);
                    if (!selected) return null;
                    return (
                      <div className="flex flex-col items-center gap-2">
                        <img src={selected.ttdImage} alt="TTD" className="h-20 object-contain" />
                        <p className="text-sm font-semibold text-gray-800">{selected.nama}</p>
                        <p className="text-xs text-gray-500">{selected.jabatan}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card title="Daftar Produk">
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-green-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-12">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Nama Produk</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-32">FOT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-32">Kuantitas</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-24">Satuan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-40">Harga Satuan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-40">Total Harga</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase tracking-wider w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {produkItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3">
                        <select value={item.namaProduk} onChange={(e) => handleProdukChange(item.id, "namaProduk", e.target.value)} className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors[`produk_${index}`] ? "border-red-500" : "border-gray-300"}`}>
                          {stockOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                        {errors[`produk_${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`produk_${index}`]}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <input type="text" value={item.fot} onChange={(e) => handleProdukChange(item.id, "fot", e.target.value)} placeholder="FOT" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                      </td>
                      <td className="px-4 py-3">
                        <input type="text" inputMode="decimal" value={item.kuantitas} onChange={(e) => handleProdukChange(item.id, "kuantitas", e.target.value)} placeholder="0.00" className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors[`kuantitas_${index}`] ? "border-red-500" : "border-gray-300"}`} />
                        {errors[`kuantitas_${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`kuantitas_${index}`]}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select value={item.satuan} onChange={(e) => handleProdukChange(item.id, "satuan", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                          {satuanOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input type="text" inputMode="decimal" value={item.hargaSatuan} onChange={(e) => handleProdukChange(item.id, "hargaSatuan", e.target.value)} placeholder="0.00" className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${errors[`harga_${index}`] ? "border-red-500" : "border-gray-300"}`} />
                        {errors[`harga_${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`harga_${index}`]}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                        {formatRupiah(item.totalHarga)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button type="button" onClick={() => removeProdukItem(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" disabled={produkItems.length === 1}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="secondary" onClick={addProdukItem}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Produk
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card title="Kalkulasi Harga">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Subtotal</span>
                <span className="text-sm font-mono font-semibold text-gray-900">{formatRupiah(formData.subtotal)}</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="includePPN" name="includePPN" checked={formData.includePPN} onChange={handleChange} className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" />
                <label htmlFor="includePPN" className="text-sm font-medium text-gray-700">Include PPN 11%</label>
              </div>
              {formData.includePPN && (
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-sm font-medium text-amber-700">PPN 11%</span>
                  <span className="text-sm font-mono font-semibold text-amber-700">{formatRupiah(formData.ppnNominal)}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Uang Muka (Opsional)</label>
                <input type="text" inputMode="decimal" name="uangMuka" value={formData.uangMuka} onChange={handleChange} placeholder="0.00" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white" />
              </div>
              {parseFloat(formData.uangMuka) > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <span className="text-sm font-medium text-blue-700">Uang Muka</span>
                  <span className="text-sm font-mono font-semibold text-blue-700">{formatRupiah(parseFloat(formData.uangMuka) || 0)}</span>
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Ongkos Kirim (Opsional)</label>
                <input type="text" inputMode="decimal" name="ongkosKirim" value={formData.ongkosKirim} onChange={handleChange} placeholder="0.00" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white" />
              </div>
              {parseFloat(formData.ongkosKirim) > 0 && (
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <span className="text-sm font-medium text-purple-700">Ongkos Kirim</span>
                  <span className="text-sm font-mono font-semibold text-purple-700">{formatRupiah(parseFloat(formData.ongkosKirim) || 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl border-2 border-green-200">
                <span className="text-base font-bold text-green-800">Jumlah Tertagih</span>
                <span className="text-lg font-mono font-bold text-green-700">{formatRupiah(formData.jumlahTertagih)}</span>
              </div>
            </div>
          </Card>

          <Card title="Informasi Tambahan">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Terbilang</p>
                <p className="text-sm font-semibold text-gray-800 uppercase leading-relaxed">{formData.terbilang || "-"}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Tanggal Jatuh Tempo</p>
                <p className="text-sm font-semibold text-red-600">{formData.tanggalJatuhTempo || "-"}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Keterangan</label>
                <textarea name="keterangan" value={formData.keterangan} onChange={handleChange} rows={4} placeholder="Masukkan keterangan tambahan jika ada" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none" />
              </div>
            </div>
          </Card>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={() => {
            setFormData({
              tanggal: new Date().toISOString().split("T")[0],
              nomorPI: "",
              namaCustomer: "",
              alamatCustomer: "",
              metodePembayaran: "Transfer",
              uangMuka: "",
              includePPN: false,
              ppnNominal: 0,
              ongkosKirim: "",
              subtotal: 0,
              jumlahTertagih: 0,
              terbilang: "",
              tanggalJatuhTempo: "",
              keterangan: "",
              selectedTTD: "",
            });
            setProdukItems([{ id: "1", namaProduk: "", fot: "", kuantitas: "", satuan: "KG", hargaSatuan: "", totalHarga: 0 }]);
            generateTanggalJatuhTempo();
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