"use client";

import React, { useState, useEffect } from "react";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

interface DOItem {
  id: string;
  nomorSubDO: string;
  nomorPO: string;
  namaProduk: string;
  namaPerusahaan: string;
  fot: string;
  tanggalPembuatan: string;
  tanggalKadaluarsa: string;
  partyKG: number;
  createdBy: string;
  createdAt: any;
}

interface StockItem {
  id: string;
  namaBarang: string;
}

interface SuratPengangkutanItem {
  nomorSubDO: string;
  nomorPO: string;
  jenisPupuk: string;
  pengambilanZAK: number;
  bobotPerUnit: number;
  totalKG: number;
  nomorPI: string;
  namaCustomer: string;
}

interface SuratDoc {
  id: string;
  nomorSeri: string;
  tanggal: string;
  jenisSurat: string;
  subJenisDO: string;
  nomorPolisi?: string;
  driverUnit?: string;
  items: SuratPengangkutanItem[];
  createdBy: string;
  nomorPI?: string[];
}

export default function InputDOPage() {
  const { user } = useAuth();
  const [doList, setDoList] = useState<DOItem[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [suratList, setSuratList] = useState<SuratDoc[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedDOId, setExpandedDOId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nomorSubDO: "",
    nomorPO: "",
    namaProduk: "",
    namaPerusahaan: "",
    fot: "",
    tanggalPembuatan: new Date().toISOString().split("T")[0],
    tanggalKadaluarsa: "",
    partyKG: "",
  });

  useEffect(() => {
    fetchDO();
    fetchStock();
    fetchSurat();
  }, []);

  const fetchDO = async () => {
    try {
      const q = query(collection(db, "do"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as DOItem));
      setDoList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchStock = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        namaBarang: doc.data().namaBarang || "",
      } as StockItem));
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchSurat = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), where("jenisSurat", "==", "do"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        nomorSeri: doc.data().nomorSeri || "",
        tanggal: doc.data().tanggal || "",
        jenisSurat: doc.data().jenisSurat || "",
        subJenisDO: doc.data().subJenisDO || "",
        nomorPolisi: doc.data().nomorPolisi || "",
        driverUnit: doc.data().driverUnit || "",
        items: doc.data().items || [],
        createdBy: doc.data().createdBy || "",
        nomorPI: doc.data().nomorPI || [],
      } as SuratDoc));
      setSuratList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const getLoadedKG = (nomorSubDO: string, nomorPO: string, namaProduk: string) => {
    let total = 0;
    suratList.forEach((surat) => {
      surat.items.forEach((item) => {
        if (
          item.nomorSubDO === nomorSubDO &&
          item.nomorPO === nomorPO &&
          item.jenisPupuk === namaProduk
        ) {
          total += (item.pengambilanZAK || 0) * (item.bobotPerUnit || 50);
        }
      });
    });
    return total;
  };

  const getSuratForDO = (nomorSubDO: string, nomorPO: string, namaProduk: string) => {
    const result: SuratDoc[] = [];
    suratList.forEach((surat) => {
      const hasMatch = surat.items.some((item) =>
        item.nomorSubDO === nomorSubDO &&
        item.nomorPO === nomorPO &&
        item.jenisPupuk === namaProduk
      );
      if (hasMatch) {
        result.push(surat);
      }
    });
    return result;
  };

  const getSisaParty = (doItem: DOItem) => {
    const loaded = getLoadedKG(doItem.nomorSubDO, doItem.nomorPO, doItem.namaProduk);
    return Math.max(0, (doItem.partyKG || 0) - loaded);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nomorSubDO.trim()) newErrors.nomorSubDO = "Nomor Sub DO wajib diisi";
    if (!formData.nomorPO.trim()) newErrors.nomorPO = "Nomor PO wajib diisi";
    if (!formData.namaProduk.trim()) newErrors.namaProduk = "Nama produk wajib dipilih";
    if (!formData.namaPerusahaan.trim()) newErrors.namaPerusahaan = "Nama perusahaan wajib diisi";
    if (!formData.fot.trim()) newErrors.fot = "FOT wajib diisi";
    if (!formData.tanggalPembuatan) newErrors.tanggalPembuatan = "Tanggal pembuatan wajib diisi";
    if (!formData.tanggalKadaluarsa) newErrors.tanggalKadaluarsa = "Tanggal kadaluarsa wajib diisi";
    if (!formData.partyKG.trim()) {
      newErrors.partyKG = "Party wajib diisi";
    } else {
      const party = parseFloat(formData.partyKG);
      if (isNaN(party) || party <= 0) newErrors.partyKG = "Party harus lebih dari 0";
    }
    if (formData.tanggalPembuatan && formData.tanggalKadaluarsa) {
      if (new Date(formData.tanggalKadaluarsa) <= new Date(formData.tanggalPembuatan)) {
        newErrors.tanggalKadaluarsa = "Tanggal kadaluarsa harus setelah tanggal pembuatan";
      }
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
      const data = {
        nomorSubDO: formData.nomorSubDO.trim(),
        nomorPO: formData.nomorPO.trim(),
        namaProduk: formData.namaProduk.trim(),
        namaPerusahaan: formData.namaPerusahaan.trim(),
        fot: formData.fot.trim(),
        tanggalPembuatan: formData.tanggalPembuatan,
        tanggalKadaluarsa: formData.tanggalKadaluarsa,
        partyKG: parseFloat(formData.partyKG),
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (editingId) {
        await updateDoc(doc(db, "do", editingId), data);
        setSuccessMessage("DO berhasil diperbarui!");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "do"), data);
        setSuccessMessage("DO berhasil disimpan!");
      }
      resetForm();
      fetchDO();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan DO. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (item: DOItem) => {
    setEditingId(item.id);
    setFormData({
      nomorSubDO: item.nomorSubDO,
      nomorPO: item.nomorPO,
      namaProduk: item.namaProduk,
      namaPerusahaan: item.namaPerusahaan,
      fot: item.fot,
      tanggalPembuatan: item.tanggalPembuatan,
      tanggalKadaluarsa: item.tanggalKadaluarsa,
      partyKG: String(item.partyKG),
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus DO ini?")) return;
    try {
      await deleteDoc(doc(db, "do", id));
      fetchDO();
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      nomorSubDO: "",
      nomorPO: "",
      namaProduk: "",
      namaPerusahaan: "",
      fot: "",
      tanggalPembuatan: new Date().toISOString().split("T")[0],
      tanggalKadaluarsa: "",
      partyKG: "",
    });
    setEditingId(null);
    setErrors({});
  };

  const filteredDO = doList.filter((item) => {
    const searchLower = searchQuery.toLowerCase();
    const matchSearch =
      item.nomorSubDO.toLowerCase().includes(searchLower) ||
      item.nomorPO.toLowerCase().includes(searchLower) ||
      item.namaProduk.toLowerCase().includes(searchLower) ||
      item.namaPerusahaan.toLowerCase().includes(searchLower) ||
      item.fot.toLowerCase().includes(searchLower);
    if (!matchSearch) return false;
    if (filterBulan) {
      const bulan = new Date(item.tanggalPembuatan).getMonth() + 1;
      if (String(bulan) !== filterBulan) return false;
    }
    if (filterTahun) {
      const tahun = new Date(item.tanggalPembuatan).getFullYear();
      if (String(tahun) !== filterTahun) return false;
    }
    return true;
  });

  const bulanOptions = [
    { value: "", label: "Semua Bulan" },
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

  const tahunOptions = Array.from(new Set(doList.map((d) => new Date(d.tanggalPembuatan).getFullYear()))).sort((a, b) => b - a);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Header title="Input DO" subtitle="Kelola Delivery Order (DO) dan monitoring party" />
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
        <Card title={editingId ? "Edit DO" : "Input DO Baru"}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Nomor SUB DO" type="text" name="nomorSubDO" value={formData.nomorSubDO} onChange={handleChange} placeholder="Contoh: 01" error={errors.nomorSubDO} required />
            <Input label="Nomor PO" type="text" name="nomorPO" value={formData.nomorPO} onChange={handleChange} placeholder="Contoh: 01" error={errors.nomorPO} required />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Produk <span className="text-red-500">*</span></label>
              <select name="namaProduk" value={formData.namaProduk} onChange={handleChange} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white ${errors.namaProduk ? "border-red-500" : "border-gray-300"}`}>
                <option value="">Pilih produk...</option>
                {stockList.map((s) => (
                  <option key={s.id} value={s.namaBarang}>{s.namaBarang}</option>
                ))}
              </select>
              {errors.namaProduk && <p className="mt-1 text-sm text-red-600">{errors.namaProduk}</p>}
            </div>
            <Input label="Nama Perusahaan" type="text" name="namaPerusahaan" value={formData.namaPerusahaan} onChange={handleChange} placeholder="Contoh: PT WILMAR CHEMICAL INDONESIA" error={errors.namaPerusahaan} required />
            <Input label="FOT" type="text" name="fot" value={formData.fot} onChange={handleChange} placeholder="Contoh: Gudang Induk" error={errors.fot} required />
            <Input label="Tanggal Pembuatan DO" type="date" name="tanggalPembuatan" value={formData.tanggalPembuatan} onChange={handleChange} error={errors.tanggalPembuatan} required />
            <Input label="Tanggal Kadaluarsa DO" type="date" name="tanggalKadaluarsa" value={formData.tanggalKadaluarsa} onChange={handleChange} error={errors.tanggalKadaluarsa} required />
            <Input label="Party (KG)" type="number" name="partyKG" value={formData.partyKG} onChange={handleChange} placeholder="Contoh: 20000" error={errors.partyKG} required />
          </div>
          <div className="flex items-center gap-3 mt-6">
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {editingId ? "Update DO" : "Simpan DO"}
            </Button>
            {editingId && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal
              </Button>
            )}
          </div>
        </Card>
      </form>

      <Card title="Riwayat DO">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Input label="Cari" type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nomor DO, PO, produk, perusahaan..." />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Filter Bulan</label>
            <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              {bulanOptions.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Filter Tahun</label>
            <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="">Semua Tahun</option>
              {tahunOptions.map((t) => (
                <option key={t} value={String(t)}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">No</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Sub DO</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">No PO</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Produk</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Perusahaan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">FOT</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tgl Buat</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tgl Kadaluarsa</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Party (KG)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Dimuat (KG)</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Sisa (KG)</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredDO.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-gray-500 text-sm">Tidak ada data DO</td>
                </tr>
              ) : (
                filteredDO.map((item, idx) => {
                  const loaded = getLoadedKG(item.nomorSubDO, item.nomorPO, item.namaProduk);
                  const sisa = getSisaParty(item);
                  const isExpired = new Date(item.tanggalKadaluarsa) < new Date();
                  const suratRelated = getSuratForDO(item.nomorSubDO, item.nomorPO, item.namaProduk);
                  const isExpanded = expandedDOId === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.nomorSubDO}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.nomorPO}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.namaProduk}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.namaPerusahaan}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{item.fot}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{new Date(item.tanggalPembuatan).toLocaleDateString("id-ID")}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          <span className={isExpired ? "text-red-600 font-medium" : ""}>
                            {new Date(item.tanggalKadaluarsa).toLocaleDateString("id-ID")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{item.partyKG.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 text-right">{loaded.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium">
                          <span className={sisa <= 0 ? "text-red-600" : "text-green-600"}>
                            {sisa.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {suratRelated.length > 0 && (
                              <button
                                onClick={() => setExpandedDOId(isExpanded ? null : item.id)}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Lihat SP"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExpanded ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
                                </svg>
                              </button>
                            )}
                            <button onClick={() => handleEdit(item)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDelete(item.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={12} className="px-4 py-3 bg-blue-50/50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                              {suratRelated.map((surat) => (
                                <div key={surat.id} className="bg-white rounded-xl border border-blue-200 p-4 shadow-sm">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-sm font-bold text-blue-800">{surat.nomorSeri}</p>
                                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                                      {surat.subJenisDO === "mandiri" ? "DO Mandiri" : "DO Dikuasakan"}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500 mb-1">Tanggal: {new Date(surat.tanggal).toLocaleDateString("id-ID")}</p>
                                  {surat.nomorPI && surat.nomorPI.length > 0 && (
                                    <p className="text-xs text-gray-700 mb-1 font-medium">Nomor PI: {surat.nomorPI.join(", ")}</p>
                                  )}
                                  {surat.driverUnit && (
                                    <p className="text-xs text-gray-500 mb-1">Driver: {surat.driverUnit}</p>
                                  )}
                                  {surat.nomorPolisi && (
                                    <p className="text-xs text-gray-500 mb-1">No Polisi: {surat.nomorPolisi}</p>
                                  )}
                                  <div className="mt-2 space-y-1">
                                    {surat.items
                                      .filter((it) => it.nomorSubDO === item.nomorSubDO && it.nomorPO === item.nomorPO && it.jenisPupuk === item.namaProduk)
                                      .map((it, i) => (
                                        <div key={i} className="flex justify-between text-xs">
                                          <span className="text-gray-600">{it.jenisPupuk}</span>
                                          <span className="font-medium text-gray-900">
                                            {it.pengambilanZAK} ZAK = {(it.pengambilanZAK * it.bobotPerUnit).toLocaleString()} KG
                                          </span>
                                        </div>
                                      ))}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">Dibuat oleh: {surat.createdBy}</p>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}