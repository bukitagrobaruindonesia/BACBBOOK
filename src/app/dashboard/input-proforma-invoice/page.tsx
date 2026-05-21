"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Modal from "@/app/components/ui/Modal";
import { StockGudang } from "@/app/types";

interface ProdukItem {
  id: string;
  namaProduk: string;
  fot: string;
  produsen: string;
  kuantitas: string;
  satuan: string;
  hargaSatuan: string;
}

interface TTDData {
  id: string;
  nama: string;
  jabatan: string;
  ttdImage: string;
}

interface CustomerData {
  id: string;
  namaCustomer: string;
  alamatCustomer: string;
  createdAt: any;
}

export default function InputProformaInvoicePage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockGudang[]>([]);
  const [ttdList, setTtdList] = useState<TTDData[]>([]);
  const [existingPIList, setExistingPIList] = useState<string[]>([]);
  const [customerList, setCustomerList] = useState<CustomerData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const customerInputRef = useRef<HTMLDivElement>(null);

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
    { id: "1", namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "" },
  ]);

  const produkItemsRef = useRef(produkItems);
  const formDataRef = useRef(formData);

  useEffect(() => {
    produkItemsRef.current = produkItems;
  }, [produkItems]);

  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  useEffect(() => {
    fetchStockGudang();
    fetchTTD();
    fetchExistingPI();
    fetchCustomers();
    generateTanggalJatuhTempo();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerInputRef.current && !customerInputRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const fetchExistingPI = async () => {
    try {
      const q = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const nomorPIs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return (data.nomorPI || "").toString().trim().toUpperCase();
      }).filter((pi) => pi !== "");
      setExistingPIList(nomorPIs);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const q = query(collection(db, "customers"), orderBy("namaCustomer", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as CustomerData));
      setCustomerList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const saveCustomerToHistory = async (nama: string, alamat: string) => {
    if (!nama.trim() || !alamat.trim()) return;
    const normalizedName = nama.trim().toLowerCase();
    const existing = customerList.find((c) => c.namaCustomer.trim().toLowerCase() === normalizedName);
    if (existing) {
      if (existing.alamatCustomer.trim() !== alamat.trim()) {
        try {
          await updateDoc(doc(db, "customers", existing.id), {
            alamatCustomer: alamat.trim(),
            updatedAt: serverTimestamp(),
          });
          fetchCustomers();
        } catch (error) {
          console.error(error);
        }
      }
      return;
    }
    try {
      await addDoc(collection(db, "customers"), {
        namaCustomer: nama.trim(),
        alamatCustomer: alamat.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      fetchCustomers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus customer ini?")) return;
    try {
      await deleteDoc(doc(db, "customers", id));
      fetchCustomers();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditCustomer = (customer: CustomerData) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.namaCustomer);
    setEditCustomerAddress(customer.alamatCustomer);
  };

  const handleSaveEditCustomer = async () => {
    if (!editingCustomer || !editCustomerName.trim() || !editCustomerAddress.trim()) return;
    try {
      await updateDoc(doc(db, "customers", editingCustomer.id), {
        namaCustomer: editCustomerName.trim(),
        alamatCustomer: editCustomerAddress.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingCustomer(null);
      setEditCustomerName("");
      setEditCustomerAddress("");
      fetchCustomers();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredCustomers = customerList.filter((c) =>
    c.namaCustomer.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.alamatCustomer.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const customerDropdownOptions = customerList.filter((c) =>
    c.namaCustomer.toLowerCase().includes(formData.namaCustomer.toLowerCase())
  );

  const handleSelectCustomer = (customer: CustomerData) => {
    setFormData((prev) => ({
      ...prev,
      namaCustomer: customer.namaCustomer,
      alamatCustomer: customer.alamatCustomer,
    }));
    setShowCustomerDropdown(false);
    if (errors.namaCustomer) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.namaCustomer;
        return newErrors;
      });
    }
    if (errors.alamatCustomer) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.alamatCustomer;
        return newErrors;
      });
    }
  };

  const checkDuplicatePI = (nomorPI: string): boolean => {
    const normalized = nomorPI.trim().toUpperCase();
    if (!normalized) return false;
    return existingPIList.includes(normalized);
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
    const currentItems = produkItemsRef.current;
    const currentForm = formDataRef.current;

    let subtotal = 0;
    currentItems.forEach((item) => {
      const qty = parseFloat(item.kuantitas) || 0;
      const price = parseFloat(item.hargaSatuan) || 0;
      subtotal += qty * price;
    });

    const uangMuka = parseFloat(currentForm.uangMuka) || 0;
    const ongkosKirim = parseFloat(currentForm.ongkosKirim) || 0;
    let ppn = 0;
    if (currentForm.includePPN) {
      ppn = subtotal * 0.11;
    }
    const jumlahTertagih = subtotal - uangMuka + ppn + ongkosKirim;
    const terbilang = numberToWords(Math.round(jumlahTertagih));

    setFormData((prev) => ({
      ...prev,
      subtotal,
      ppnNominal: ppn,
      jumlahTertagih,
      terbilang,
    }));
  }, []);

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
    if (name === "nomorPI") {
      if (checkDuplicatePI(value)) {
        setErrors((prev) => ({ ...prev, nomorPI: `Nomor PI "${value.trim().toUpperCase()}" sudah terdaftar di database` }));
      } else {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.nomorPI;
          return newErrors;
        });
      }
    }
    setTimeout(() => calculateTotals(), 0);
  };

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, namaCustomer: value, alamatCustomer: "" }));
    setShowCustomerDropdown(true);
    if (errors.namaCustomer) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.namaCustomer;
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
              newItem.produsen = stock.namaProdusen || "";
            } else {
              newItem.fot = "";
              newItem.produsen = "";
            }
          }
          return newItem;
        }
        return item;
      });
    });
    setTimeout(() => calculateTotals(), 0);
  };

  const addProdukItem = () => {
    const newId = Date.now().toString();
    setProdukItems((prev) => [
      ...prev,
      { id: newId, namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "" },
    ]);
  };

  const removeProdukItem = (id: string) => {
    if (produkItems.length > 1) {
      setProdukItems((prev) => prev.filter((item) => item.id !== id));
      setTimeout(() => calculateTotals(), 0);
    }
  };

  const getItemTotal = (item: ProdukItem): number => {
    const qty = parseFloat(item.kuantitas) || 0;
    const price = parseFloat(item.hargaSatuan) || 0;
    return qty * price;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.nomorPI.trim()) newErrors.nomorPI = "Nomor PI wajib diisi";
    if (checkDuplicatePI(formData.nomorPI)) newErrors.nomorPI = `Nomor PI "${formData.nomorPI.trim().toUpperCase()}" sudah terdaftar di database`;
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
          produsen: item.produsen,
          kuantitas: parseFloat(item.kuantitas),
          satuan: item.satuan,
          hargaSatuan: parseFloat(item.hargaSatuan),
          totalHarga: getItemTotal(item),
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

      await saveCustomerToHistory(formData.namaCustomer, formData.alamatCustomer);

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
        { id: "1", namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "" },
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
    { value: "LITER", label: "LITER" },
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
              <div>
                <Input label="Nomor PI" type="text" name="nomorPI" value={formData.nomorPI} onChange={handleChange} placeholder="Contoh: BAGB-PI-0657" error={errors.nomorPI} required />
                {checkDuplicatePI(formData.nomorPI) && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-sm font-medium">Nomor PI sudah terdaftar, silakan gunakan nomor lain</span>
                  </div>
                )}
              </div>

              <div ref={customerInputRef} className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Nama Customer <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="namaCustomer"
                    value={formData.namaCustomer}
                    onChange={handleCustomerNameChange}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Ketik nama customer..."
                    autoComplete="off"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white ${errors.namaCustomer ? "border-red-500" : "border-gray-300"}`}
                  />
                  {formData.namaCustomer && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, namaCustomer: "", alamatCustomer: "" }));
                        setShowCustomerDropdown(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                {errors.namaCustomer && <p className="mt-1 text-sm text-red-600">{errors.namaCustomer}</p>}

                {showCustomerDropdown && customerDropdownOptions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {customerDropdownOptions.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleSelectCustomer(customer)}
                        className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <p className="text-sm font-medium text-gray-900">{customer.namaCustomer}</p>
                        <p className="text-xs text-gray-500 truncate">{customer.alamatCustomer}</p>
                      </button>
                    ))}
                  </div>
                )}

                {showCustomerDropdown && formData.namaCustomer && customerDropdownOptions.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
                    <p className="text-sm text-gray-500">Customer baru - alamat akan disimpan setelah submit</p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Alamat Customer <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="alamatCustomer"
                  value={formData.alamatCustomer}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Masukkan alamat lengkap customer"
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none ${errors.alamatCustomer ? "border-red-500" : "border-gray-300"}`}
                />
                {errors.alamatCustomer && <p className="mt-1 text-sm text-red-600">{errors.alamatCustomer}</p>}
              </div>

              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsCustomerModalOpen(true)}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  Riwayat Customer
                </Button>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-40">Produsen</th>
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
                        <input type="text" value={item.produsen} readOnly placeholder="Produsen" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600" />
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
                        {formatRupiah(getItemTotal(item))}
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
            setProdukItems([{ id: "1", namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "" }]);
            generateTanggalJatuhTempo();
            setErrors({});
          }}>
            Reset Form
          </Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} disabled={checkDuplicatePI(formData.nomorPI)}>
            Simpan Proforma Invoice
          </Button>
        </div>
      </form>

      <Modal isOpen={isCustomerModalOpen} onClose={() => { setIsCustomerModalOpen(false); setEditingCustomer(null); setCustomerSearch(""); }} title="Riwayat Customer" size="lg" footer={
        <Button variant="outline" onClick={() => { setIsCustomerModalOpen(false); setEditingCustomer(null); setCustomerSearch(""); }}>Tutup</Button>
      }>
        <div className="space-y-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Cari nama atau alamat customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
          </div>

          <div className="text-sm text-gray-500">
            Menampilkan {filteredCustomers.length} dari {customerList.length} customer
          </div>

          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="bg-green-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Nama Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Alamat</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {editingCustomer?.id === customer.id ? (
                        <input type="text" value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                      ) : (
                        customer.namaCustomer
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {editingCustomer?.id === customer.id ? (
                        <input type="text" value={editCustomerAddress} onChange={(e) => setEditCustomerAddress(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
                      ) : (
                        customer.alamatCustomer
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingCustomer?.id === customer.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={handleSaveEditCustomer} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Simpan">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => setEditingCustomer(null)} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors" title="Batal">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleSelectCustomer(customer)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Pilih">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button onClick={() => handleEditCustomer(customer)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button onClick={() => handleDeleteCustomer(customer.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-sm text-gray-500">
                      Belum ada data customer
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}