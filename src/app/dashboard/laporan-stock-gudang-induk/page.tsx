"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Table from "@/app/components/ui/Table";
import { StockGudang } from "@/app/types";

interface BarangRusakRow {
  id: string;
  transaksiId: string;
  rusakIndex: number;
  fot: string;
  kodeBarang: string;
  namaBarang: string;
  namaProdusen: string;
  unitMasuk: string;
  tanggal: string;
  createdBy: string;
  unit: string;
  jumlah: number;
  keterangan: string;
  fotoUrls: string[];
  status: string;
  tanggalPenggantian: string;
  jumlahPenggantian: number;
  penggantianFotoUrls: string[];
}

export default function LaporanInputStockGudangPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockGudang[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFot, setFilterFot] = useState("");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [transaksiMasukMap, setTransaksiMasukMap] = useState<Record<string, { unit: number; kg: number }>>({});
  const [transaksiKeluarMap, setTransaksiKeluarMap] = useState<Record<string, { unit: number; kg: number }>>({});

  const [formData, setFormData] = useState({
    fot: "",
    kodeBarang: "",
    namaBarang: "",
    namaProdusen: "",
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    bobotPerUnit: "50",
    stokTersediaUnit: "",
    botolPerDus: "20",
    volumeMl: "500",
  });

  const [fotList, setFotList] = useState<string[]>([]);
  const [isNewFot, setIsNewFot] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateKodeBarang, setDuplicateKodeBarang] = useState("");

  const [barangRusakList, setBarangRusakList] = useState<BarangRusakRow[]>([]);
  const [rusakSearchQuery, setRusakSearchQuery] = useState("");
  const [rusakFilterFot, setRusakFilterFot] = useState("");
  const [rusakFilterStatus, setRusakFilterStatus] = useState("");
  const [rusakCurrentPage, setRusakCurrentPage] = useState(1);
  const [rusakItemsPerPage, setRusakItemsPerPage] = useState(10);
  const [selectedRusakFoto, setSelectedRusakFoto] = useState<{ urls: string[]; index: number } | null>(null);

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "KG", label: "KG" },
    { value: "BOTOL", label: "BOTOL" },
  ];

  const itemsPerPageOptions = [
    { value: "5", label: "5 per halaman" },
    { value: "10", label: "10 per halaman" },
    { value: "20", label: "20 per halaman" },
    { value: "50", label: "50 per halaman" },
    { value: "100", label: "100 per halaman" },
  ];

  const statusOptions = [
    { value: "", label: "Semua Status" },
    { value: "belum diganti", label: "Belum Diganti" },
    { value: "sudah diganti", label: "Sudah Diganti" },
  ];

  useEffect(() => {
    fetchStockGudang();
    fetchFotList();
    fetchBarangRusak();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterFot, itemsPerPage]);

  useEffect(() => {
    setRusakCurrentPage(1);
  }, [rusakSearchQuery, rusakFilterFot, rusakFilterStatus, rusakItemsPerPage]);

  useEffect(() => {
    fetchTransaksiFiltered();
  }, [filterTanggal, filterBulan, filterTahun, stockList]);

  useEffect(() => {
    const numberInputs = document.querySelectorAll('input[type="number"]');
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
  }, [formData]);

  const fetchTransaksiFiltered = async () => {
    if (!filterTanggal && !filterBulan && !filterTahun) {
      setTransaksiMasukMap({});
      setTransaksiKeluarMap({});
      return;
    }

    const masukMap: Record<string, { unit: number; kg: number }> = {};
    const keluarMap: Record<string, { unit: number; kg: number }> = {};

    const matchesDate = (tanggal: string) => {
      if (!tanggal) return false;
      const parts = tanggal.split("-");
      if (parts.length !== 3) return false;
      const [y, m, d] = parts;
      if (filterTahun && y !== filterTahun) return false;
      if (filterBulan && m !== filterBulan) return false;
      if (filterTanggal && d !== filterTanggal) return false;
      return true;
    };

    const addMasuk = (kodeBarang: string, fot: string, unit: string, unitVal: number, kgVal: number) => {
      const key = `${kodeBarang}|${fot}`;
      if (!masukMap[key]) masukMap[key] = { unit: 0, kg: 0 };
      if (unit === "DUS" || unit === "BOTOL") {
        masukMap[key].unit += unitVal;
      } else if (unit === "KG") {
        masukMap[key].kg += kgVal;
      } else {
        masukMap[key].unit += unitVal;
        masukMap[key].kg += kgVal;
      }
    };

    const addKeluar = (kodeBarang: string, fot: string, unit: string, unitVal: number, kgVal: number) => {
      const key = `${kodeBarang}|${fot}`;
      if (!keluarMap[key]) keluarMap[key] = { unit: 0, kg: 0 };
      if (unit === "DUS" || unit === "BOTOL") {
        keluarMap[key].unit += unitVal;
      } else if (unit === "KG") {
        keluarMap[key].kg += kgVal;
      } else {
        keluarMap[key].unit += unitVal;
        keluarMap[key].kg += kgVal;
      }
    };

    try {
      const masukSnap = await getDocs(query(collection(db, "transaksiBarangMasuk"), orderBy("tanggal", "desc")));
      masukSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (!matchesDate(d.tanggal)) return;
        addMasuk(d.kodeBarang || "", d.fot || "", d.unit || "ZAK", d.netJumlahZAK || 0, d.netTotalKG || 0);
      });

      const keluarSnap = await getDocs(query(collection(db, "transaksiBarangKeluar"), orderBy("tanggal", "desc")));
      keluarSnap.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (!matchesDate(d.tanggal)) return;
        const items = d.items || [];
        if (d.jenis === "barangKeluarBackup") {
          items.forEach((item: any) => {
            addKeluar(item.kodeBarang || "", item.fot || d.fot || "", item.unit || "ZAK", item.pengambilanUnit || 0, item.totalKG || 0);
          });
        } else {
          items.forEach((item: any) => {
            const stock = stockList.find((s) => s.namaBarang === item.jenisPupuk && (item.fot ? s.fot === item.fot : true));
            const kode = stock ? stock.kodeBarang : "";
            const fot = item.fot || "";
            const unit = stock ? stock.unit : "ZAK";
            const isDusBotol = unit === "DUS" || unit === "BOTOL";
            if (isDusBotol) {
              addKeluar(kode, fot, unit, item.pengambilanZAK || 0, 0);
            } else {
              addKeluar(kode, fot, unit, item.pengambilanZAK || 0, item.totalKG || 0);
            }
          });
        }
      });

      setTransaksiMasukMap(masukMap);
      setTransaksiKeluarMap(keluarMap);
    } catch (error) {
      console.error(error);
    }
  };

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
      const q = query(collection(db, "stockGudang"), orderBy("kodeBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as StockGudang)).sort((a, b) => {
        const numA = parseInt(a.kodeBarang.replace(/\D/g, "")) || 0;
        const numB = parseInt(b.kodeBarang.replace(/\D/g, "")) || 0;
        return numA - numB;
      });
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchBarangRusak = async () => {
    try {
      const q = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list: BarangRusakRow[] = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.adaBarangRusak && Array.isArray(d.barangRusak)) {
          d.barangRusak.forEach((r: any, idx: number) => {
            list.push({
              id: `${docSnap.id}_${idx}`,
              transaksiId: docSnap.id,
              rusakIndex: idx,
              fot: d.fot || "",
              kodeBarang: d.kodeBarang || "",
              namaBarang: d.namaBarang || "",
              namaProdusen: d.namaProdusen || "",
              unitMasuk: d.unit || "ZAK",
              tanggal: d.tanggal || "",
              createdBy: d.createdBy || "",
              unit: r.unit || "ZAK",
              jumlah: r.jumlah || 0,
              keterangan: r.keterangan || "",
              fotoUrls: r.fotoUrls || [],
              status: r.status || "belum diganti",
              tanggalPenggantian: r.tanggalPenggantian || "",
              jumlahPenggantian: r.jumlahPenggantian || 0,
              penggantianFotoUrls: r.penggantianFotoUrls || [],
            });
          });
        }
      });
      setBarangRusakList(list);
    } catch (error) {
      console.error(error);
    }
  };

  const checkDuplicateKodeBarang = async (kodeBarang: string): Promise<boolean> => {
    if (!kodeBarang.trim()) return false;

    try {
      const q = query(
        collection(db, "stockGudang"),
        where("kodeBarang", "==", kodeBarang.trim().toUpperCase())
      );
      const snapshot = await getDocs(q);

      if (isEditing && editId) {
        const duplicateDocs = snapshot.docs.filter((d) => d.id !== editId);
        return duplicateDocs.length > 0;
      }

      return !snapshot.empty;
    } catch (error) {
      console.error("Error checking duplicate:", error);
      return false;
    }
  };

  const handleKodeBarangChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }

    if (value.trim().length >= 3) {
      const isDuplicate = await checkDuplicateKodeBarang(value);
      if (isDuplicate) {
        setDuplicateKodeBarang(value.trim().toUpperCase());
        setShowDuplicateModal(true);
        setFormData((prev) => ({ ...prev, kodeBarang: "" }));
      }
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
    if (!formData.namaProdusen.trim()) newErrors.namaProdusen = "Nama produsen wajib diisi";

    const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";
    const isBotol = formData.unit === "BOTOL";
    const isDus = formData.unit === "DUS";

    if (isUnitBased && !isBotol && !isDus) {
      if (!formData.bobotPerUnit || parseFloat(formData.bobotPerUnit) <= 0)
        newErrors.bobotPerUnit = "Bobot per unit tidak valid";
    }

    if (!isEditing) {
      if (!formData.stokTersediaUnit || isNaN(parseFloat(formData.stokTersediaUnit)))
        newErrors.stokTersediaUnit = "Stok tersedia tidak valid";
    }

    if (isBotol) {
      if (!formData.botolPerDus || parseFloat(formData.botolPerDus) <= 0)
        newErrors.botolPerDus = "Jumlah botol per dus tidak valid";
      if (!formData.volumeMl || parseFloat(formData.volumeMl) <= 0)
        newErrors.volumeMl = "Volume tidak valid";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const isDuplicate = await checkDuplicateKodeBarang(formData.kodeBarang);
    if (isDuplicate) {
      setDuplicateKodeBarang(formData.kodeBarang.trim().toUpperCase());
      setShowDuplicateModal(true);
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const isBotol = formData.unit === "BOTOL";
      const isDus = formData.unit === "DUS";
      const isKG = formData.unit === "KG";
      const isZAK = formData.unit === "ZAK";
      const stokTersediaUnit = parseFloat(formData.stokTersediaUnit) || 0;
      const bobotPerUnit = isBotol || isDus ? (parseFloat(formData.botolPerDus) || 20) : (parseFloat(formData.bobotPerUnit) || 50);
      const botolPerDus = (isBotol || isDus) ? (parseFloat(formData.botolPerDus) || 20) : null;

      const hitungStokAwalKG = () => {
        if (isKG) return 0;
        if (isZAK) return stokTersediaUnit * bobotPerUnit;
        return 0;
      };

      const stokAwalKG = hitungStokAwalKG();
      const stokAkhirUnit = isKG ? 0 : stokTersediaUnit;
      const stokAkhirKG = stokAwalKG;

      if (isEditing && editId) {
        const docData: any = {
          fot: formData.fot.trim().toUpperCase(),
          kodeBarang: formData.kodeBarang.trim().toUpperCase(),
          namaBarang: formData.namaBarang.trim(),
          namaProdusen: formData.namaProdusen.trim(),
          unit: formData.unit,
          bobotPerUnit: bobotPerUnit,
          updatedAt: serverTimestamp(),
        };

        if (formData.stokTersediaUnit) {
          const newStokUnit = parseFloat(formData.stokTersediaUnit) || 0;
          const newStokKG = isKG ? 0 : newStokUnit * bobotPerUnit;
          docData.stokAkhirUnit = isKG ? 0 : newStokUnit;
          docData.stokAkhirKG = newStokKG;
        }

        if (isBotol || isDus) {
          docData.botolPerDus = botolPerDus;
          docData.volumeMl = parseFloat(formData.volumeMl) || 500;
          if (isBotol) docData.displayUnit = "ZAK";
        }

        await updateDoc(doc(db, "stockGudang", editId), docData);
        setSuccessMessage("Data stock gudang berhasil diperbarui!");
      } else {
        const docData: any = {
          fot: formData.fot.trim().toUpperCase(),
          kodeBarang: formData.kodeBarang.trim().toUpperCase(),
          namaBarang: formData.namaBarang.trim(),
          namaProdusen: formData.namaProdusen.trim(),
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

        if (isBotol || isDus) {
          docData.botolPerDus = botolPerDus;
          docData.volumeMl = parseFloat(formData.volumeMl) || 500;
          if (isBotol) docData.displayUnit = "ZAK";
        }

        await addDoc(collection(db, "stockGudang"), docData);
        setSuccessMessage("Stock gudang berhasil disimpan!");
      }

      resetForm();
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

  const handleEdit = (stock: StockGudang) => {
    setIsEditing(true);
    setEditId(stock.id);
    setFormData({
      fot: stock.fot,
      kodeBarang: stock.kodeBarang,
      namaBarang: stock.namaBarang,
      namaProdusen: stock.namaProdusen || "",
      unit: stock.unit,
      bobotPerUnit: stock.bobotPerUnit?.toString() || "50",
      stokTersediaUnit: stock.stokAkhirUnit?.toString() || "",
      botolPerDus: stock.botolPerDus?.toString() || "20",
      volumeMl: stock.volumeMl?.toString() || "500",
    });
    setIsNewFot(!fotList.includes(stock.fot));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, "stockGudang", id));
      setSuccessMessage("Data stock gudang berhasil dihapus!");
      setShowDeleteConfirm(null);
      fetchStockGudang();
      fetchFotList();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menghapus data. Silakan coba lagi." });
    }
  };

  const resetForm = () => {
    setFormData({
      fot: "",
      kodeBarang: "",
      namaBarang: "",
      namaProdusen: "",
      unit: "ZAK",
      bobotPerUnit: "50",
      stokTersediaUnit: "",
      botolPerDus: "20",
      volumeMl: "500",
    });
    setIsNewFot(false);
    setIsEditing(false);
    setEditId(null);
    setErrors({});
    setShowDuplicateModal(false);
    setDuplicateKodeBarang("");
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

  const fotOptions = [
    { value: "", label: "Pilih atau tambah FOT..." },
    ...fotList.map((f) => ({ value: f, label: f })),
    { value: "__new__", label: "+ Tambah FOT Baru" },
  ];

  const isUnitBased = formData.unit === "ZAK" || formData.unit === "DUS" || formData.unit === "BOTOL";
  const isBotol = formData.unit === "BOTOL";
  const isDus = formData.unit === "DUS";

  const filteredStockList = stockList.filter((stock) => {
    const matchesSearch =
      stock.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.kodeBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.fot.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (stock.namaProdusen || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFot = filterFot ? stock.fot === filterFot : true;
    return matchesSearch && matchesFot;
  });

  const uniqueFotList = Array.from(new Set(stockList.map((s) => s.fot))).sort();

  const totalPages = Math.ceil(filteredStockList.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = filteredStockList.slice(startIndex, endIndex);
  const startItem = filteredStockList.length > 0 ? startIndex + 1 : 0;
  const endItem = Math.min(endIndex, filteredStockList.length);

  const getDisplayUnitLabel = (unit: string) => {
    if (unit === "BOTOL" || unit === "DUS") return "BOTOL";
    return unit;
  };

  const formatDusDisplay = (row: StockGudang, unitField: number) => {
    if (row.unit === "DUS") {
      const dusCount = unitField || 0;
      const botolCount = dusCount * (row.botolPerDus || 20);
      return `${dusCount.toLocaleString("id-ID", { maximumFractionDigits: 10 })} DUS (${botolCount.toLocaleString("id-ID", { maximumFractionDigits: 10 })} botol)`;
    }
    if (row.unit === "BOTOL") {
      return `${(unitField || 0).toLocaleString("id-ID", { maximumFractionDigits: 10 })} botol`;
    }
    return `${(unitField || 0).toLocaleString("id-ID", { maximumFractionDigits: 10 })} ${row.unit}`;
  };

  const hitungStokAwalKG = (row: StockGudang) => {
    if (row.unit === "ZAK") {
      return (row.stokAwalUnit || 0) * (row.bobotPerUnit || 50);
    }
    if (row.unit === "DUS" || row.unit === "BOTOL") {
      return 0;
    }
    return row.stokAwalKG || 0;
  };

  const getBotolCount = (row: StockGudang, unitField: number) => {
    if (row.unit === "DUS" || row.unit === "BOTOL") {
      return (unitField || 0) * (row.botolPerDus || 20);
    }
    return unitField || 0;
  };

  const hitungStokAkhirKG = (row: StockGudang) => {
    if (row.unit === "DUS" || row.unit === "BOTOL") {
      return 0;
    }
    return row.stokAkhirKG || 0;
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const rusakFiltered = barangRusakList.filter((r) => {
    const matchesSearch =
      r.namaBarang.toLowerCase().includes(rusakSearchQuery.toLowerCase()) ||
      r.kodeBarang.toLowerCase().includes(rusakSearchQuery.toLowerCase()) ||
      r.fot.toLowerCase().includes(rusakSearchQuery.toLowerCase()) ||
      r.keterangan.toLowerCase().includes(rusakSearchQuery.toLowerCase());
    const matchesFot = rusakFilterFot ? r.fot === rusakFilterFot : true;
    const matchesStatus = rusakFilterStatus ? r.status === rusakFilterStatus : true;
    return matchesSearch && matchesFot && matchesStatus;
  });

  const rusakTotalPages = Math.ceil(rusakFiltered.length / rusakItemsPerPage);
  const rusakStartIndex = (rusakCurrentPage - 1) * rusakItemsPerPage;
  const rusakEndIndex = rusakStartIndex + rusakItemsPerPage;
  const rusakPaginated = rusakFiltered.slice(rusakStartIndex, rusakEndIndex);
  const rusakStartItem = rusakFiltered.length > 0 ? rusakStartIndex + 1 : 0;
  const rusakEndItem = Math.min(rusakEndIndex, rusakFiltered.length);

  const goToRusakPage = (page: number) => {
    if (page >= 1 && page <= rusakTotalPages) {
      setRusakCurrentPage(page);
    }
  };

  const renderRusakPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, rusakCurrentPage - Math.floor(maxVisible / 2));
    let end = Math.min(rusakTotalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

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
      key: "namaProdusen",
      header: "Produsen",
      width: "140px",
      render: (row: StockGudang) => (
        <span className="text-xs text-gray-600">{row.namaProdusen || "-"}</span>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: "80px",
      render: (row: StockGudang) => (
        <span
          className={`px-2 py-1 rounded-md text-xs font-bold ${
            row.unit === "ZAK"
              ? "bg-blue-100 text-blue-700"
              : row.unit === "DUS"
              ? "bg-purple-100 text-purple-700"
              : row.unit === "BOTOL"
              ? "bg-pink-100 text-pink-700"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {row.unit}
        </span>
      ),
    },
    {
      key: "konversi",
      header: "Konversi",
      width: "140px",
      render: (row: StockGudang) => {
        if (row.unit === "BOTOL" || row.unit === "DUS") {
          return (
            <div className="text-xs">
              <p className="font-mono text-pink-600">{row.botolPerDus || 20} botol/DUS</p>
              <p className="font-mono text-pink-500">{row.volumeMl || 500} ml/botol</p>
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
      key: "stokAwal",
      header: "Stok Awal",
      width: "120px",
      render: (row: StockGudang) => (
        <div className="text-xs">
          {row.unit !== "KG" && (
            <p className="font-mono text-gray-600">
              {formatDusDisplay(row, row.stokAwalUnit)}
            </p>
          )}
          {row.unit !== "DUS" && row.unit !== "BOTOL" && (
            <p className="font-mono text-gray-500">{hitungStokAwalKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
          )}
        </div>
      ),
    },
    {
      key: "barangMasuk",
      header: "Masuk",
      width: "100px",
      render: (row: StockGudang) => {
        const hasFilter = !!(filterTanggal || filterBulan || filterTahun);
        const key = `${row.kodeBarang}|${row.fot}`;
        const masuk = hasFilter ? (transaksiMasukMap[key] || { unit: 0, kg: 0 }) : { unit: row.barangMasukUnit || 0, kg: row.barangMasukKG || 0 };
        const showUnit = masuk.unit > 0;
        const showKG = masuk.kg > 0;
        return (
          <div className="text-xs">
            {row.unit !== "KG" && showUnit && (
              <p className="font-mono text-green-600">
                +{formatDusDisplay(row, masuk.unit)}
              </p>
            )}
            {row.unit !== "DUS" && row.unit !== "BOTOL" && showKG && (
              <p className="font-mono text-green-500">+{masuk.kg.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
            )}
            {hasFilter && !showUnit && !showKG && (
              <span className="text-gray-400">-</span>
            )}
          </div>
        );
      },
    },
    {
      key: "barangKeluar",
      header: "Keluar",
      width: "100px",
      render: (row: StockGudang) => {
        const hasFilter = !!(filterTanggal || filterBulan || filterTahun);
        const key = `${row.kodeBarang}|${row.fot}`;
        const keluar = hasFilter ? (transaksiKeluarMap[key] || { unit: 0, kg: 0 }) : { unit: row.barangKeluarUnit || 0, kg: row.barangKeluarKG || 0 };
        const showUnit = keluar.unit > 0;
        const showKG = keluar.kg > 0;
        return (
          <div className="text-xs">
            {row.unit !== "KG" && showUnit && (
              <p className="font-mono text-red-600">
                -{formatDusDisplay(row, keluar.unit)}
              </p>
            )}
            {row.unit !== "DUS" && row.unit !== "BOTOL" && showKG && (
              <p className="font-mono text-red-500">-{keluar.kg.toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
            )}
            {hasFilter && !showUnit && !showKG && (
              <span className="text-gray-400">-</span>
            )}
          </div>
        );
      },
    },
    {
      key: "stokAkhir",
      header: "Stok Akhir",
      width: "140px",
      render: (row: StockGudang) => (
        <div className="text-sm">
          {row.unit !== "KG" && (
            <p className="font-mono font-bold text-green-700">
              {formatDusDisplay(row, row.stokAkhirUnit)}
            </p>
          )}
          {row.unit !== "DUS" && row.unit !== "BOTOL" && (
            <p className="font-mono font-bold text-green-600">{hitungStokAkhirKG(row).toLocaleString("id-ID", { maximumFractionDigits: 10 })} KG</p>
          )}
        </div>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "120px",
      render: (row: StockGudang) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleEdit(row)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => setShowDeleteConfirm(row.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  const rusakColumns = [
    {
      key: "fot",
      header: "FOT",
      width: "80px",
      render: (row: BarangRusakRow) => (
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded text-xs">{row.fot}</span>
      ),
    },
    {
      key: "tanggal",
      header: "Tanggal",
      width: "110px",
      render: (row: BarangRusakRow) => <span className="text-xs text-gray-700">{row.tanggal}</span>,
    },
    {
      key: "kodeBarang",
      header: "Kode",
      width: "100px",
      render: (row: BarangRusakRow) => (
        <span className="font-mono font-semibold text-green-700 bg-green-50 px-2 py-1 rounded text-xs">{row.kodeBarang}</span>
      ),
    },
    {
      key: "namaBarang",
      header: "Nama Barang",
      render: (row: BarangRusakRow) => <span className="text-sm font-medium text-gray-800">{row.namaBarang}</span>,
    },
    {
      key: "jumlah",
      header: "Jumlah Rusak",
      width: "100px",
      render: (row: BarangRusakRow) => (
        <span className="font-mono font-bold text-red-700">{row.jumlah.toLocaleString("id-ID")} {row.unit}</span>
      ),
    },
    {
      key: "keterangan",
      header: "Keterangan",
      width: "140px",
      render: (row: BarangRusakRow) => <span className="text-xs text-gray-600">{row.keterangan}</span>,
    },
    {
      key: "foto",
      header: "Foto",
      width: "80px",
      render: (row: BarangRusakRow) => (
        <div>
          {(() => {
            const rf = row.fotoUrls;
            return rf.length > 0 ? (
            <button
              onClick={() => setSelectedRusakFoto({ urls: rf, index: 0 })}
              className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold hover:bg-amber-200 transition-colors"
            >
              {rf.length} Foto
            </button>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          );
          })()}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      render: (row: BarangRusakRow) => (
        <span
          className={`px-2 py-1 rounded-md text-xs font-bold ${
            row.status === "sudah diganti"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {row.status === "sudah diganti" ? "SUDAH DIGANTI" : "BELUM DIGANTI"}
        </span>
      ),
    },
    {
      key: "detailPenggantian",
      header: "Detail Penggantian",
      width: "180px",
      render: (row: BarangRusakRow) => {
        if (row.status !== "sudah diganti") {
          return <span className="text-xs text-gray-400">-</span>;
        }
        return (
          <div className="text-xs space-y-1">
            <p className="text-green-700 font-semibold">{row.jumlahPenggantian.toLocaleString("id-ID")} {row.unitMasuk} diganti</p>
            <p className="text-gray-500">Tgl: {row.tanggalPenggantian}</p>
            {(() => {
              const pgf = row.penggantianFotoUrls;
              return pgf.length > 0 && (
              <button
                onClick={() => setSelectedRusakFoto({ urls: pgf, index: 0 })}
                className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold hover:bg-blue-200 transition-colors"
              >
                {pgf.length} Foto Ganti
              </button>
            );
            })()}
          </div>
        );
      },
    },
    {
      key: "createdBy",
      header: "Oleh",
      width: "100px",
      render: (row: BarangRusakRow) => <span className="text-xs text-gray-500">{row.createdBy}</span>,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Header
        title="Laporan & Input Stock Gudang"
        subtitle="Kelola data stock barang per FOT"
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
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card
              title={isEditing ? "Edit Stock Gudang" : "Input Stock Gudang"}
              icon={
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              }
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    FOT (Tempat Gudang)
                  </label>
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
                  onChange={handleKodeBarangChange}
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

                <Input
                  label="Nama Produsen"
                  type="text"
                  name="namaProdusen"
                  value={formData.namaProdusen}
                  onChange={handleChange}
                  placeholder="Contoh: PT Petrokimia Gresik"
                  error={errors.namaProdusen}
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

                {isUnitBased && !isBotol && !isDus && (
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

                {(isBotol || isDus) && (
                  <>
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
                    <Input
                      label="Volume (ml)"
                      type="number"
                      name="volumeMl"
                      value={formData.volumeMl}
                      onChange={handleChange}
                      placeholder="Contoh: 500"
                      error={errors.volumeMl}
                      required
                    />
                  </>
                )}

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

                {formData.stokTersediaUnit && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">
                      Preview Stok
                    </p>
                    <p className="text-3xl font-bold text-amber-700 font-mono">
                      {parseFloat(formData.stokTersediaUnit).toLocaleString("id-ID", { maximumFractionDigits: 10 })} {getDisplayUnit()}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            <div className="flex items-center justify-end gap-4">
              {isEditing && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  Batal Edit
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  resetForm();
                }}
              >
                Reset Form
              </Button>
              <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
                {isEditing ? "Update Stock" : "Simpan Stock"}
              </Button>
            </div>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card
            title={`Data Stock Gudang (${filteredStockList.length} item)`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 10h16M4 14h16M4 18h16"
                />
              </svg>
            }
          >
            <div className="mb-4 flex flex-col sm:flex-row gap-3 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Input
                  type="text"
                  placeholder="Cari nama barang, kode, produsen, atau FOT..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="sm:w-40">
                <Select
                  value={filterFot}
                  onChange={(e) => setFilterFot(e.target.value)}
                  options={[
                    { value: "", label: "Semua FOT" },
                    ...uniqueFotList.map((f) => ({ value: f, label: f })),
                  ]}
                />
              </div>
              <div className="sm:w-28">
                <Select
                  value={filterTanggal}
                  onChange={(e) => setFilterTanggal(e.target.value)}
                  options={[
                    { value: "", label: "Tanggal" },
                    ...Array.from({ length: 31 }, (_, i) => {
                      const d = (i + 1).toString().padStart(2, "0");
                      return { value: d, label: d };
                    }),
                  ]}
                />
              </div>
              <div className="sm:w-36">
                <Select
                  value={filterBulan}
                  onChange={(e) => setFilterBulan(e.target.value)}
                  options={[
                    { value: "", label: "Bulan" },
                    { value: "01", label: "Januari" },
                    { value: "02", label: "Februari" },
                    { value: "03", label: "Maret" },
                    { value: "04", label: "April" },
                    { value: "05", label: "Mei" },
                    { value: "06", label: "Juni" },
                    { value: "07", label: "Juli" },
                    { value: "08", label: "Agustus" },
                    { value: "09", label: "September" },
                    { value: "10", label: "Oktober" },
                    { value: "11", label: "November" },
                    { value: "12", label: "Desember" },
                  ]}
                />
              </div>
              <div className="sm:w-28">
                <Select
                  value={filterTahun}
                  onChange={(e) => setFilterTahun(e.target.value)}
                  options={[
                    { value: "", label: "Tahun" },
                    ...Array.from({ length: 5 }, (_, i) => {
                      const year = (new Date().getFullYear() - 2 + i).toString();
                      return { value: year, label: year };
                    }),
                  ]}
                />
              </div>
              {(filterTanggal || filterBulan || filterTahun) && (
                <button
                  onClick={() => { setFilterTanggal(""); setFilterBulan(""); setFilterTahun(""); }}
                  className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                >
                  Reset Tanggal
                </button>
              )}
            </div>

            {(filterTanggal || filterBulan || filterTahun) && (
              <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Filter tanggal aktif: Menampilkan jumlah barang masuk & keluar pada periode yang dipilih
              </div>
            )}

            <Table
              columns={columns}
              data={paginatedData}
              isLoading={false}
              emptyMessage="Belum ada data stock gudang"
              keyExtractor={(row) => row.id}
            />

            {filteredStockList.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    Menampilkan {startItem}-{endItem} dari {filteredStockList.length} data
                  </span>
                  <Select
                    value={itemsPerPage.toString()}
                    onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
                    options={itemsPerPageOptions}
                    className="w-36 text-sm"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {renderPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page
                          ? "bg-green-600 text-white shadow-sm"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </Card>

          <Card
            title={`Stok Barang Rusak (${rusakFiltered.length} item)`}
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            }
          >
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <Input
                  type="text"
                  placeholder="Cari nama barang, kode, FOT, atau keterangan..."
                  value={rusakSearchQuery}
                  onChange={(e) => setRusakSearchQuery(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="sm:w-40">
                <Select
                  value={rusakFilterFot}
                  onChange={(e) => setRusakFilterFot(e.target.value)}
                  options={[
                    { value: "", label: "Semua FOT" },
                    ...uniqueFotList.map((f) => ({ value: f, label: f })),
                  ]}
                />
              </div>
              <div className="sm:w-44">
                <Select
                  value={rusakFilterStatus}
                  onChange={(e) => setRusakFilterStatus(e.target.value)}
                  options={statusOptions}
                />
              </div>
            </div>

            <Table
              columns={rusakColumns}
              data={rusakPaginated}
              isLoading={false}
              emptyMessage="Belum ada data barang rusak"
              keyExtractor={(row) => row.id}
            />

            {rusakFiltered.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">
                    Menampilkan {rusakStartItem}-{rusakEndItem} dari {rusakFiltered.length} data
                  </span>
                  <Select
                    value={rusakItemsPerPage.toString()}
                    onChange={(e) => setRusakItemsPerPage(parseInt(e.target.value))}
                    options={itemsPerPageOptions}
                    className="w-36 text-sm"
                  />
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => goToRusakPage(rusakCurrentPage - 1)}
                    disabled={rusakCurrentPage === 1}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>

                  {renderRusakPageNumbers().map((page) => (
                    <button
                      key={page}
                      onClick={() => goToRusakPage(page)}
                      className={`min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        rusakCurrentPage === page
                          ? "bg-red-600 text-white shadow-sm"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => goToRusakPage(rusakCurrentPage + 1)}
                    disabled={rusakCurrentPage === rusakTotalPages}
                    className="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 text-gray-700"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Konfirmasi Hapus</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Apakah Anda yakin ingin menghapus data stock ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowDeleteConfirm(null)}>
                Batal
              </Button>
              <Button
                type="button"
                variant="primary"
                className="bg-red-600 hover:bg-red-700"
                onClick={() => handleDelete(showDeleteConfirm)}
              >
                Hapus Data
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDuplicateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-amber-100 rounded-full">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900">Kode Barang Sudah Ada</h3>
            </div>
            <p className="text-gray-600 mb-2">
              Kode barang <span className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded">{duplicateKodeBarang}</span> sudah terdaftar di database.
            </p>
            <p className="text-gray-500 text-sm mb-6">
              Silakan gunakan kode barang yang berbeda atau edit data yang sudah ada melalui tabel di samping.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="primary"
                className="bg-amber-600 hover:bg-amber-700"
                onClick={() => setShowDuplicateModal(false)}
              >
                Mengerti
              </Button>
            </div>
          </div>
        </div>
      )}

      {selectedRusakFoto && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedRusakFoto(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedRusakFoto(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedRusakFoto.urls[selectedRusakFoto.index]}
              alt="Foto Barang Rusak"
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-sm mt-4 font-medium">
              Foto {selectedRusakFoto.index + 1} dari {selectedRusakFoto.urls.length}
            </p>
            <div className="flex gap-2 mt-3">
              {selectedRusakFoto.urls.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setSelectedRusakFoto({ ...selectedRusakFoto, index: idx }); }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${idx === selectedRusakFoto.index ? "bg-white" : "bg-white/40 hover:bg-white/60"}`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}