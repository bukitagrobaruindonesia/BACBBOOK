"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc, runTransaction, getDoc, setDoc, where } from "firebase/firestore";
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
  hargaPerZakDus: string;
  bobotPerUnit: number;
  jumlahIsiBotol: number;
  includePPN: boolean;
}

interface TTDData {
  id: string;
  nama: string;
  jabatan: string;
  ttdImage: string;
}

interface CustomerData {
  id: string;
  customerId: string;
  namaCustomer: string;
  alamatCustomer: string;
  npwp: string;
  createdAt: any;
  updatedAt?: any;
}

interface FOTData {
  id: string;
  namaFOT: string;
  alamatFOT: string;
}

interface FormDataState {
  tanggal: string;
  nomorPI: string;
  namaCustomer: string;
  alamatCustomer: string;
  npwp: string;
  metodePembayaran: string;
  uangMuka: string;
  ppnNominal: number;
  ongkosKirim: string;
  jumlahUangDibayar: string;
  tanggalPembayaran: string;
  subtotal: number;
  jumlahTertagih: number;
  terbilang: string;
  tanggalJatuhTempo: string;
  keterangan: string;
  cc: string;
  selectedTTD: string;
  fotoBukti: string[];
}

const getRomanMonth = (month: number) => {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[month - 1] || "I";
};

const compressImage = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas context not available"));
        ctx.drawImage(img, 0, 0, width, height);
        let quality = 0.7;
        let result = canvas.toDataURL("image/jpeg", quality);
        while (result.length > 2 * 1024 * 1024 * 1.37 && quality > 0.1) {
          quality -= 0.1;
          result = canvas.toDataURL("image/jpeg", quality);
        }
        resolve(result);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function InputProformaInvoicePage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockGudang[]>([]);
  const [ttdList, setTtdList] = useState<TTDData[]>([]);
  const [customerList, setCustomerList] = useState<CustomerData[]>([]);
  const [fotList, setFotList] = useState<FOTData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [pendingPI, setPendingPI] = useState("");
  const pendingPIRef = useRef("");
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editCustomerNpwp, setEditCustomerNpwp] = useState("");
  const customerInputRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState<FormDataState>({
    tanggal: new Date().toISOString().split("T")[0],
    nomorPI: "",
    namaCustomer: "",
    alamatCustomer: "",
    npwp: "",
    metodePembayaran: "Transfer",
    uangMuka: "",
    ppnNominal: 0,
    ongkosKirim: "",
    jumlahUangDibayar: "",
    tanggalPembayaran: new Date().toISOString().split("T")[0],
    subtotal: 0,
    jumlahTertagih: 0,
    terbilang: "",
    tanggalJatuhTempo: "",
    keterangan: "",
    cc: "",
    selectedTTD: "",
    fotoBukti: [],
  });

  const [produkItems, setProdukItems] = useState<ProdukItem[]>([
    { id: "1", namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "", hargaPerZakDus: "", bobotPerUnit: 50, jumlahIsiBotol: 1, includePPN: false },
  ]);

  const produkItemsRef = useRef<ProdukItem[]>(produkItems);
  const formDataRef = useRef<FormDataState>(formData);

  useEffect(() => { produkItemsRef.current = produkItems; }, [produkItems]);
  useEffect(() => { formDataRef.current = formData; }, [formData]);

  useEffect(() => {
    fetchStockGudang();
    fetchTTD();
    fetchCustomers();
    fetchFOT();
    generateTanggalJatuhTempo();
  }, []);

  useEffect(() => {
    const generateNomor = async () => {
      try {
        const nomor = await getUniquePINumber();
        pendingPIRef.current = nomor;
        setPendingPI(nomor);
      } catch (err) {
        console.error("Gagal generate nomor PI:", err);
      }
    };
    generateNomor();
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

  useEffect(() => {
    cleanupStalePILocks();
    const interval = setInterval(cleanupStalePILocks, 10 * 60 * 1000);
    const handleBeforeUnload = () => {
      if (pendingPIRef.current) {
        releasePINumber(pendingPIRef.current);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (pendingPIRef.current) {
        releasePINumber(pendingPIRef.current);
        pendingPIRef.current = "";
      }
    };
  }, []);


  const generateTanggalJatuhTempo = () => {
    const today = new Date();
    today.setHours(16, 0, 0, 0);
    const dateStr = today.toISOString().split("T")[0] + " 16.00 WIB";
    setFormData((prev) => ({ ...prev, tanggalJatuhTempo: dateStr }));
  };

  const getUniquePINumber = async (): Promise<string> => {
  const now = new Date();
  const year = now.getFullYear();
  const shortYear = String(year).slice(-2);
  const roman = getRomanMonth(now.getMonth() + 1);
  const prefix = "BAGB-PI-(W)";
  const counterRef = doc(db, "counters", `piCounter_${year}_${roman}`);
  const maxRetries = 15;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let lastNum = 0;
        if (counterDoc.exists()) {
          lastNum = counterDoc.data().lastNumber || 0;
        }
        let candidateNum = lastNum + 1;
        let candidatePI = `${prefix}/${roman}/${shortYear}-${String(candidateNum).padStart(3, "0")}`;
        const safeLockId = candidatePI.replace(/\//g, "_");
        const lockRef = doc(db, "piNumberLocks", safeLockId);
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists()) {
          throw new Error("LOCK_EXISTS");
        }
        transaction.set(lockRef, { createdAt: serverTimestamp(), used: true, lockedBy: user?.email || "unknown" });
        transaction.set(counterRef, { lastNumber: candidateNum });
        return candidatePI;
      });
      return result;
    } catch (error: any) {
      if (error.message === "LOCK_EXISTS" || error.code === "aborted") {
        const jitter = Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, 150 * Math.pow(2, attempt) + jitter));
        continue;
      }
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw new Error("Failed to generate unique PI number after retries");
};

const releasePINumber = async (nomorPI: string) => {
  try {
    const safeLockId = nomorPI.replace(/\//g, "_");
    const lockRef = doc(db, "piNumberLocks", safeLockId);
    const lockSnap = await getDoc(lockRef);
    if (lockSnap.exists()) {
      await deleteDoc(lockRef);
    }
    const parts = nomorPI.split("/");
    if (parts.length === 3) {
      const yearPart = parts[2].split("-")[0];
      const year = 2000 + parseInt(yearPart);
      const roman = parts[1];
      const num = parseInt(parts[2].split("-")[1]);
      const counterRef = doc(db, "counters", `piCounter_${year}_${roman}`);
      await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let lastNum = counterDoc.data()?.lastNumber || 0;
        if (num === lastNum) {
          let newLast = lastNum - 1;
          while (newLast > 0) {
            const testPI = `BAGB-PI-(W)/${roman}/${yearPart}-${String(newLast).padStart(3, "0")}`;
            const testSafeId = testPI.replace(/\//g, "_");
            const testRef = doc(db, "piNumberLocks", testSafeId);
            const testDoc = await transaction.get(testRef);
            if (testDoc.exists()) break;
            newLast--;
          }
          lastNum = Math.max(0, newLast);
        }
        transaction.set(counterRef, { lastNumber: lastNum });
      });
    }
  } catch (error) {
    console.error("Failed to release PI number:", error);
  }
};

const cleanupStalePILocks = async () => {
  try {
    const locksQuery = query(collection(db, "piNumberLocks"));
    const locksSnap = await getDocs(locksQuery);
    const staleThreshold = Date.now() - 30 * 60 * 1000;
    for (const lockDoc of locksSnap.docs) {
      const lockData = lockDoc.data();
      const createdAt = lockData.createdAt?.toMillis?.() || lockData.createdAt || 0;
      if (createdAt < staleThreshold && !lockData.used) {
        const nomorPI = lockDoc.id.replace(/_/g, "/");
        await releasePINumber(nomorPI);
      }
    }
  } catch (error) {
    console.error("PI cleanup failed:", error);
  }
};

const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StockGudang));
      setStockList(data);
    } catch (error) { console.error(error); }
  };

  const fetchTTD = async () => {
    try {
      const q = query(collection(db, "ttd"), orderBy("nama", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as TTDData));
      setTtdList(data);
    } catch (error) { console.error(error); }
  };

  const fetchCustomers = async () => {
    try {
      const q = query(collection(db, "customers"), orderBy("namaCustomer", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as CustomerData));
      setCustomerList(data);
    } catch (error) { console.error(error); }
  };

  const fetchFOT = async () => {
    try {
      const q = query(collection(db, "fot"), orderBy("namaFOT", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        namaFOT: doc.data().namaFOT || "",
        alamatFOT: doc.data().alamatFOT || "",
      } as FOTData));
      setFotList(data);
    } catch (error) { console.error(error); }
  };

  const generateCustomerId = async (): Promise<string> => {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const q = query(collection(db, "customers"), orderBy("customerId", "asc"));
        const snapshot = await getDocs(q);
        const ids = snapshot.docs
          .map((d) => d.data().customerId)
          .filter((id): id is string => typeof id === "string" && id.startsWith("BAGB-CS-"))
          .map((id) => parseInt(id.replace("BAGB-CS-", ""), 10))
          .filter((n) => !isNaN(n))
          .sort((a, b) => a - b);
        if (ids.length === 0) return "BAGB-CS-001";
        let nextId = 1;
        for (const id of ids) {
          if (id !== nextId) {
            return `BAGB-CS-${String(nextId).padStart(3, "0")}`;
          }
          nextId++;
        }
        return `BAGB-CS-${String(nextId).padStart(3, "0")}`;
      });
      return result;
    } catch (error) {
      console.error(error);
      return "BAGB-CS-001";
    }
  };

const ensureCustomerExists = async (nama: string, alamat: string, npwp: string): Promise<CustomerData | undefined> => {
    if (!nama.trim() || !alamat.trim()) return;

    try {
      const result = await runTransaction(db, async (transaction) => {
        const q = query(
          collection(db, "customers"),
          where("namaCustomer", "==", nama.trim()),
          where("alamatCustomer", "==", alamat.trim())
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data() as CustomerData;
          return { ...data, id: snap.docs[0].id };
        }

        const customerId = await generateCustomerId();
        const newDocRef = doc(collection(db, "customers"));
        transaction.set(newDocRef, {
          customerId,
          namaCustomer: nama.trim(),
          alamatCustomer: alamat.trim(),
          npwp: npwp.trim() || "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { id: newDocRef.id, customerId, namaCustomer: nama.trim(), alamatCustomer: alamat.trim(), npwp: npwp.trim() || "", createdAt: new Date(), updatedAt: new Date() };
      });

      fetchCustomers();
      return result;
    } catch (error) { console.error(error); }
  };

const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus customer ini?")) return;
    try {
      await deleteDoc(doc(db, "customers", id));
      fetchCustomers();
    } catch (error) { console.error(error); }
  };

  const handleEditCustomer = (customer: CustomerData) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.namaCustomer);
    setEditCustomerAddress(customer.alamatCustomer);
    setEditCustomerNpwp(customer.npwp || "");
  };

  const handleSaveEditCustomer = async () => {
    if (!editingCustomer || !editCustomerName.trim() || !editCustomerAddress.trim()) return;
    try {
      await updateDoc(doc(db, "customers", editingCustomer.id), {
        namaCustomer: editCustomerName.trim(),
        alamatCustomer: editCustomerAddress.trim(),
        npwp: editCustomerNpwp.trim(),
        updatedAt: serverTimestamp(),
      });
      setEditingCustomer(null);
      setEditCustomerName("");
      setEditCustomerAddress("");
      setEditCustomerNpwp("");
      fetchCustomers();
    } catch (error) { console.error(error); }
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
      npwp: customer.npwp || "",
    }));
    setShowCustomerDropdown(false);
    if (errors.namaCustomer) {
      setErrors((prev) => { const newErrors = { ...prev }; delete newErrors.namaCustomer; return newErrors; });
    }
    if (errors.alamatCustomer) {
      setErrors((prev) => { const newErrors = { ...prev }; delete newErrors.alamatCustomer; return newErrors; });
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
    const currentItems = produkItemsRef.current;
    const currentForm = formDataRef.current;
    let subtotal = 0;
    let ppnTotal = 0;
    currentItems.forEach((item) => {
      const qty = parseFloat(item.kuantitas) || 0;
      const price = parseFloat(item.hargaSatuan) || 0;
      const baseTotal = qty * price;
      if (item.includePPN) {
        const itemPPN = baseTotal * 0.11;
        ppnTotal += itemPPN;
        subtotal += baseTotal + itemPPN;
      } else {
        subtotal += baseTotal;
      }
    });
    const uangMuka = parseFloat(currentForm.uangMuka) || 0;
    const ongkosKirim = parseFloat(currentForm.ongkosKirim) || 0;
    const jumlahTertagih = subtotal - uangMuka + ongkosKirim;
    const terbilang = numberToWords(Math.round(jumlahTertagih));
    setFormData((prev) => ({
      ...prev,
      subtotal,
      ppnNominal: ppnTotal,
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
      setErrors((prev) => { const newErrors = { ...prev }; delete newErrors[name]; return newErrors; });
    }
    setTimeout(() => calculateTotals(), 0);
  };

  const handleCustomerNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData((prev) => ({ ...prev, namaCustomer: value, alamatCustomer: "", npwp: "" }));
    setShowCustomerDropdown(true);
    if (errors.namaCustomer) {
      setErrors((prev) => { const newErrors = { ...prev }; delete newErrors.namaCustomer; return newErrors; });
    }
  };

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newPhotos: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const compressed = await compressImage(files[i]);
      newPhotos.push(compressed);
    }
    setFormData((prev) => ({ ...prev, fotoBukti: [...prev.fotoBukti, ...newPhotos] }));
  };

  const removeFoto = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      fotoBukti: prev.fotoBukti.filter((_, i) => i !== index),
    }));
  };

  const calculateHargaPerZakDus = (item: ProdukItem): string => {
    const price = parseFloat(item.hargaSatuan) || 0;
    const stock = stockList.find((s) => s.namaBarang === item.namaProduk);
    if (!stock) return String(price * (item.bobotPerUnit || 1));

    // If unit is DUS or BOTOL, multiply by botolPerDus
    if (stock.unit === "DUS" || stock.unit === "BOTOL") {
      const botolPerDus = stock.botolPerDus || 20;
      return String(price * botolPerDus);
    }
    // If unit is ZAK, multiply by bobotPerUnit
    if (stock.unit === "ZAK") {
      return String(price * (stock.bobotPerUnit || 50));
    }
    // For KG, just return the price
    return String(price);
  };

  const handleProdukChange = (id: string, field: string, value: string | boolean) => {
    setProdukItems((prev) => {
      return prev.map((item) => {
        if (item.id === id) {
          const newItem = { ...item, [field]: value };
          if (field === "namaProduk" && typeof value === "string") {
            const stock = stockList.find((s) => s.namaBarang === value);
            if (stock) {
              newItem.fot = stock.fot || "";
              newItem.produsen = stock.namaProdusen || "";
              newItem.bobotPerUnit = stock.bobotPerUnit || 50;
              newItem.jumlahIsiBotol = (stock as any).jumlahIsiBotol || 1;
              // Auto-set satuan from stock unit
              if (stock.unit === "DUS") {
              newItem.satuan = "BOTOL";
            } else if (stock.unit === "BOTOL") {
              newItem.satuan = "BOTOL";
            } else if (stock.unit === "ZAK") {
              newItem.satuan = "ZAK";
            } else {
              newItem.satuan = "KG";
            }
            } else {
              newItem.fot = "";
              newItem.produsen = "";
              newItem.bobotPerUnit = 50;
              newItem.jumlahIsiBotol = 1;
            }
            if (newItem.hargaSatuan) {
              newItem.hargaPerZakDus = calculateHargaPerZakDus(newItem);
            }
          }
          if (field === "hargaSatuan" && typeof value === "string") {
            newItem.hargaPerZakDus = calculateHargaPerZakDus(newItem);
          }
          if (field === "satuan" && typeof value === "string") {
            if (newItem.hargaSatuan) {
              newItem.hargaPerZakDus = calculateHargaPerZakDus(newItem);
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
      { id: newId, namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "", hargaPerZakDus: "", bobotPerUnit: 50, jumlahIsiBotol: 1, includePPN: false },
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
    const base = qty * price;
    if (item.includePPN) return base * 1.11;
    return base;
  };

  const getItemPPN = (item: ProdukItem): number => {
    const qty = parseFloat(item.kuantitas) || 0;
    const price = parseFloat(item.hargaSatuan) || 0;
    if (item.includePPN) return qty * price * 0.11;
    return 0;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
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
      await ensureCustomerExists(formData.namaCustomer, formData.alamatCustomer, formData.npwp);
      const selectedTTD = ttdList.find((t) => t.id === formData.selectedTTD);

      const finalNomorPI = pendingPIRef.current || await getUniquePINumber();
      pendingPIRef.current = "";
      setPendingPI(finalNomorPI);

      const jumlahBayar = parseFloat(formData.jumlahUangDibayar) || 0;
      const riwayatPembayaran = jumlahBayar > 0
        ? [{ tanggal: formData.tanggalPembayaran || formData.tanggal, jumlah: jumlahBayar, fotoBukti: formData.fotoBukti }]
        : [];

      await addDoc(collection(db, "proformaInvoice"), {
        tanggal: formData.tanggal,
        nomorPI: finalNomorPI,
        namaCustomer: formData.namaCustomer.trim(),
        alamatCustomer: formData.alamatCustomer.trim(),
        npwp: formData.npwp.trim(),
        metodePembayaran: formData.metodePembayaran,
        produkItems: produkItems.map((item) => ({
          namaProduk: item.namaProduk,
          fot: item.fot,
          produsen: item.produsen,
          kuantitas: parseFloat(item.kuantitas),
          satuan: item.satuan,
          hargaSatuan: parseFloat(item.hargaSatuan),
          hargaPerZakDus: parseFloat(item.hargaPerZakDus) || 0,
          bobotPerUnit: item.bobotPerUnit,
          jumlahIsiBotol: item.jumlahIsiBotol,
          totalHarga: getItemTotal(item),
          includePPN: item.includePPN,
          ppnNominal: getItemPPN(item),
        })),
        uangMuka: parseFloat(formData.uangMuka) || 0,
        includePPN: produkItems.some((p) => p.includePPN),
        ppnNominal: formData.ppnNominal,
        ongkosKirim: parseFloat(formData.ongkosKirim) || 0,
        jumlahUangDibayar: jumlahBayar,
        tanggalPembayaran: formData.tanggalPembayaran || "",
        statusPelunasan: (() => {
          const jd = jumlahBayar;
          if (jd >= formData.jumlahTertagih && formData.jumlahTertagih > 0) return "Lunas";
          if (jd > 0) return "Cicilan";
          return "Belum Lunas";
        })(),
        riwayatPembayaran: riwayatPembayaran,
        cc: formData.cc.trim(),
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

      setSuccessMessage(`Proforma Invoice ${finalNomorPI} berhasil disimpan!`);
      setFormData({
        tanggal: new Date().toISOString().split("T")[0],
        nomorPI: "",
        namaCustomer: "", alamatCustomer: "", npwp: "",
        metodePembayaran: "Transfer", uangMuka: "", ppnNominal: 0,
        ongkosKirim: "", jumlahUangDibayar: "", tanggalPembayaran: new Date().toISOString().split("T")[0],
        subtotal: 0,
        jumlahTertagih: 0, terbilang: "", tanggalJatuhTempo: "",
        keterangan: "", cc: "", selectedTTD: "",
        fotoBukti: [],
      });
      setProdukItems([{ id: "1", namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "", hargaPerZakDus: "", bobotPerUnit: 50, jumlahIsiBotol: 1, includePPN: false }]);
      generateTanggalJatuhTempo();
      setTimeout(() => setSuccessMessage(""), 5000);

      const newNomor = await getUniquePINumber();
      pendingPIRef.current = newNomor;
      setPendingPI(newNomor);

    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };
const stockOptions = [
    { value: "", label: "Pilih produk..." },
    ...stockList.map((stock) => ({ value: stock.namaBarang, label: `${stock.namaBarang} (${stock.kodeBarang})` })),
  ];

  const ttdOptions = [
    { value: "", label: "Pilih tanda tangan..." },
    ...ttdList.map((ttd) => ({ value: ttd.id, label: `${ttd.nama} - ${ttd.jabatan}` })),
  ];

  const satuanOptions = [
    { value: "KG", label: "KG" },
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "LITER", label: "LITER" },
    { value: "BOTOL", label: "BOTOL" },
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
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nomor PI</label>
                <input type="text" value="Akan dibuat otomatis saat simpan" readOnly className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed italic" />
              </div>
              <div ref={customerInputRef} className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Nama Customer <span className="text-red-500">*</span></label>
                <div className="relative">
                  <input type="text" name="namaCustomer" value={formData.namaCustomer} onChange={handleCustomerNameChange} onFocus={() => setShowCustomerDropdown(true)} placeholder="Ketik nama customer..." autoComplete="off" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white ${errors.namaCustomer ? "border-red-500" : "border-gray-300"}`} />
                  {formData.namaCustomer && (
                    <button type="button" onClick={() => { setFormData((prev) => ({ ...prev, namaCustomer: "", alamatCustomer: "", npwp: "" })); setShowCustomerDropdown(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                {errors.namaCustomer && <p className="mt-1 text-sm text-red-600">{errors.namaCustomer}</p>}
                {showCustomerDropdown && customerDropdownOptions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {customerDropdownOptions.map((customer) => (
                      <button key={customer.id} type="button" onClick={() => handleSelectCustomer(customer)} className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-100 last:border-b-0">
                        <p className="text-sm font-medium text-gray-900">{customer.namaCustomer}</p>
                        <p className="text-xs text-gray-500 truncate">{customer.alamatCustomer}</p>
                      </button>
                    ))}
                  </div>
                )}
                {showCustomerDropdown && formData.namaCustomer && customerDropdownOptions.length === 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center">
                    <p className="text-sm text-gray-500">Customer baru - akan dibuatkan ID otomatis setelah submit</p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alamat Customer <span className="text-red-500">*</span></label>
                <textarea name="alamatCustomer" value={formData.alamatCustomer} onChange={handleChange} rows={3} placeholder="Masukkan alamat lengkap customer" className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none ${errors.alamatCustomer ? "border-red-500" : "border-gray-300"}`} />
                {errors.alamatCustomer && <p className="mt-1 text-sm text-red-600">{errors.alamatCustomer}</p>}
              </div>
              <Input label="NPWP (Opsional)" type="text" name="npwp" value={formData.npwp} onChange={handleChange} placeholder="Contoh: 123456789012345" />
              <div className="flex items-center gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => setIsCustomerModalOpen(true)}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-40">Harga Per Unit</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase tracking-wider w-24">PPN 11%</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-40">Total Harga</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase tracking-wider w-16">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {produkItems.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3">
                        <select 
                          value={item.namaProduk} 
                          onChange={(e) => handleProdukChange(item.id, "namaProduk", e.target.value)} 
                          onFocus={() => setFocusedInput(`${item.id}-namaProduk`)}
                          onBlur={() => setFocusedInput(null)}
                          className={`w-full px-3 py-2 border rounded-lg text-sm transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 ${errors[`produk_${index}`] ? "border-red-500" : "border-gray-300"} ${focusedInput === `${item.id}-namaProduk` ? 'shadow-lg scale-[1.05] py-3 px-4 text-base min-w-[240px] z-20 relative' : focusedInput && focusedInput.startsWith(item.id) ? 'scale-[0.97] opacity-70' : ''}`}
                        >
                          {stockOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                        </select>
                        {errors[`produk_${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`produk_${index}`]}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={item.fot} 
                          onChange={(e) => handleProdukChange(item.id, "fot", e.target.value)} 
                          onFocus={() => setFocusedInput(`${item.id}-fot`)}
                          onBlur={() => setFocusedInput(null)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 ${focusedInput === `${item.id}-fot` ? 'shadow-lg scale-[1.05] py-3 px-4 text-base min-w-[180px] z-20 relative' : focusedInput && focusedInput.startsWith(item.id) ? 'scale-[0.97] opacity-70' : ''}`}
                        >
                          <option value="">Pilih FOT...</option>
                          {fotList.map((fot) => (<option key={fot.id} value={fot.namaFOT}>{fot.namaFOT}</option>))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          value={item.produsen} 
                          readOnly 
                          placeholder="Produsen" 
                          className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-600 transition-all duration-300 ease-in-out ${focusedInput && focusedInput.startsWith(item.id) && focusedInput !== `${item.id}-produsen` ? 'scale-[0.97] opacity-70' : ''}`} 
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          inputMode="decimal" 
                          value={item.kuantitas} 
                          onChange={(e) => handleProdukChange(item.id, "kuantitas", e.target.value)} 
                          onFocus={() => setFocusedInput(`${item.id}-kuantitas`)}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="0.00" 
                          className={`w-full px-3 py-2 border rounded-lg text-sm transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 ${errors[`kuantitas_${index}`] ? "border-red-500" : "border-gray-300"} ${focusedInput === `${item.id}-kuantitas` ? 'shadow-lg scale-[1.05] py-3 px-4 text-base min-w-[140px] z-20 relative' : focusedInput && focusedInput.startsWith(item.id) ? 'scale-[0.97] opacity-70' : ''}`} 
                        />
                        {errors[`kuantitas_${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`kuantitas_${index}`]}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <select 
                          value={item.satuan} 
                          onChange={(e) => handleProdukChange(item.id, "satuan", e.target.value)} 
                          onFocus={() => setFocusedInput(`${item.id}-satuan`)}
                          onBlur={() => setFocusedInput(null)}
                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 ${focusedInput === `${item.id}-satuan` ? 'shadow-lg scale-[1.05] py-3 px-4 text-base min-w-[120px] z-20 relative' : focusedInput && focusedInput.startsWith(item.id) ? 'scale-[0.97] opacity-70' : ''}`}
                        >
                          {satuanOptions.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="text" 
                          inputMode="decimal" 
                          value={item.hargaSatuan} 
                          onChange={(e) => handleProdukChange(item.id, "hargaSatuan", e.target.value)} 
                          onFocus={() => setFocusedInput(`${item.id}-hargaSatuan`)}
                          onBlur={() => setFocusedInput(null)}
                          placeholder="0.00" 
                          className={`w-full px-3 py-2 border rounded-lg text-sm transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 ${errors[`harga_${index}`] ? "border-red-500" : "border-gray-300"} ${focusedInput === `${item.id}-hargaSatuan` ? 'shadow-lg scale-[1.05] py-3 px-4 text-base min-w-[160px] z-20 relative' : focusedInput && focusedInput.startsWith(item.id) ? 'scale-[0.97] opacity-70' : ''}`} 
                        />
                        {errors[`harga_${index}`] && <p className="mt-1 text-xs text-red-600">{errors[`harga_${index}`]}</p>}
                      </td>
                      <td className={`px-4 py-3 text-sm font-mono text-gray-700 transition-all duration-300 ease-in-out ${focusedInput && focusedInput.startsWith(item.id) && !focusedInput.endsWith('hargaPerZakDus') ? 'scale-[0.97] opacity-70' : ''}`}>
                        {item.hargaPerZakDus ? formatRupiah(parseFloat(item.hargaPerZakDus)) : "-"}
                        {(() => {
                          const stock = stockList.find((s) => s.namaBarang === item.namaProduk);
                          if (!stock || !item.hargaPerZakDus) return null;
                          if (stock.unit === "DUS" || stock.unit === "BOTOL") {
                            return <span className="text-xs text-gray-500 block">({stock.botolPerDus || 20} botol)</span>;
                          }
                          if (stock.unit === "ZAK") {
                            return <span className="text-xs text-gray-500 block">({stock.bobotPerUnit || 50} KG)</span>;
                          }
                          return null;
                        })()}
                      </td>
                      <td className={`px-4 py-3 text-center transition-all duration-300 ease-in-out ${focusedInput && focusedInput.startsWith(item.id) && !focusedInput.endsWith('includePPN') ? 'scale-[0.97] opacity-70' : ''}`}>
                        <input 
                          type="checkbox" 
                          checked={item.includePPN} 
                          onChange={(e) => handleProdukChange(item.id, "includePPN", e.target.checked)} 
                          className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer" 
                        />
                      </td>
                      <td className={`px-4 py-3 text-sm font-mono font-medium text-gray-900 transition-all duration-300 ease-in-out ${focusedInput && focusedInput.startsWith(item.id) && !focusedInput.endsWith('total') ? 'scale-[0.97] opacity-70' : ''}`}>{formatRupiah(getItemTotal(item))}</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          type="button" 
                          onClick={() => removeProdukItem(item.id)} 
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" 
                          disabled={produkItems.length === 1}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="secondary" onClick={addProdukItem}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
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
              {formData.ppnNominal > 0 && (
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-sm font-medium text-amber-700">Total PPN 11%</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jumlah Uang yang telah Dibayar (Opsional)</label>
                  <input type="text" inputMode="decimal" name="jumlahUangDibayar" value={formData.jumlahUangDibayar} onChange={handleChange} placeholder="0.00" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tanggal Pembayaran</label>
                  <input type="date" name="tanggalPembayaran" value={formData.tanggalPembayaran} onChange={handleChange} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white" />
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Foto Bukti Pembayaran (Opsional)</label>
                <input type="file" accept="image/*" multiple onChange={handleFotoChange} className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
                <p className="text-xs text-gray-500 mt-1">Maksimal per foto akan otomatis dikompres kurang dari 2MB</p>
                {formData.fotoBukti.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {formData.fotoBukti.map((foto, idx) => (
                      <div key={idx} className="relative">
                        <img src={foto} alt={`Preview ${idx + 1}`} className="h-20 w-20 object-cover rounded-lg border border-gray-200" />
                        <button type="button" onClick={() => removeFoto(idx)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600">&times;</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {parseFloat(formData.jumlahUangDibayar) > 0 && (
                <div className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-100">
                  <span className="text-sm font-medium text-teal-700">Uang Dibayar</span>
                  <span className="text-sm font-mono font-semibold text-teal-700">{formatRupiah(parseFloat(formData.jumlahUangDibayar) || 0)}</span>
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
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">CC (Opsional)</label>
                <input type="text" name="cc" value={formData.cc} onChange={handleChange} placeholder="Nama penawar produk" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white" />
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
            if (pendingPIRef.current) {
              releasePINumber(pendingPIRef.current);
              pendingPIRef.current = "";
              setPendingPI("");
            }
            setFormData({
              tanggal: new Date().toISOString().split("T")[0],
              nomorPI: "",
              namaCustomer: "", alamatCustomer: "", npwp: "",
              metodePembayaran: "Transfer", uangMuka: "", ppnNominal: 0,
              ongkosKirim: "", jumlahUangDibayar: "", tanggalPembayaran: new Date().toISOString().split("T")[0],
              subtotal: 0,
              jumlahTertagih: 0, terbilang: "", tanggalJatuhTempo: "",
              keterangan: "", cc: "", selectedTTD: "",
              fotoBukti: [],
            });
            setProdukItems([{ id: "1", namaProduk: "", fot: "", produsen: "", kuantitas: "", satuan: "KG", hargaSatuan: "", hargaPerZakDus: "", bobotPerUnit: 50, jumlahIsiBotol: 1, includePPN: false }]);
            generateTanggalJatuhTempo();
            setErrors({});
          }}>Reset Form</Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>Simpan Proforma Invoice</Button>
        </div>
      </form>
      <Modal isOpen={isCustomerModalOpen} onClose={() => { setIsCustomerModalOpen(false); setEditingCustomer(null); setCustomerSearch(""); }} title="Riwayat Customer" size="lg" footer={<Button variant="outline" onClick={() => { setIsCustomerModalOpen(false); setEditingCustomer(null); setCustomerSearch(""); }}>Tutup</Button>}>
        <div className="space-y-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Cari nama atau alamat customer..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
          </div>
          <div className="text-sm text-gray-500">Menampilkan {filteredCustomers.length} dari {customerList.length} customer</div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="bg-green-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Customer ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Nama Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Alamat Lengkap</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">NPWP</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase w-32">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-blue-700">{customer.customerId || "-"}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{editingCustomer?.id === customer.id ? <input type="text" value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /> : customer.namaCustomer}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{editingCustomer?.id === customer.id ? <input type="text" value={editCustomerAddress} onChange={(e) => setEditCustomerAddress(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /> : customer.alamatCustomer}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{editingCustomer?.id === customer.id ? <input type="text" value={editCustomerNpwp} onChange={(e) => setEditCustomerNpwp(e.target.value)} className="w-full px-2 py-1 border border-gray-300 rounded text-sm" /> : customer.npwp || "-"}</td>
                    <td className="px-4 py-3 text-center">
                      {editingCustomer?.id === customer.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={handleSaveEditCustomer} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Simpan"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                          <button onClick={() => setEditingCustomer(null)} className="p-1.5 text-gray-500 hover:bg-gray-50 rounded-lg transition-colors" title="Batal"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleSelectCustomer(customer)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Pilih"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></button>
                          <button onClick={() => handleEditCustomer(customer)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg></button>
                          <button onClick={() => handleDeleteCustomer(customer.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && (<tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">Belum ada data customer</td></tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}