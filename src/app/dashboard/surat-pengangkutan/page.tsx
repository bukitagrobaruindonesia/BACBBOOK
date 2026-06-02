"use client";

import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  where,
  getDoc,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

interface ProformaInvoice {
  id: string;
  nomorPI: string;
  namaCustomer: string;
  alamatCustomer?: string;
  tanggal: string;
  produkItems: Array<{
    namaProduk: string;
    fot: string;
    produsen: string;
    kuantitas: number;
    satuan: string;
  }>;
  jumlahTertagih: number;
}

interface StockItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  fot: string;
  bobotPerUnit: number;
  stokAkhirUnit: number;
  stokAkhirKG: number;
  barangKeluarUnit?: number;
  barangKeluarKG?: number;
}

interface SuratPengangkutanItem {
  id: number;
  nomorSubDO: string;
  nomorPO: string;
  jenisPupuk: string;
  party: string;
  pengambilanZAK: string;
  sisa: string;
  bobotPerUnit: number;
  maxZAK: number;
  fot: string;
  nomorPI?: string;
}

interface ExistingSurat {
  id: string;
  nomorSeri: string;
}

interface ProdukAggregate {
  namaProduk: string;
  fot: string;
  orderedKG: number;
  loadedKG: number;
  remainingKG: number;
  bobotPerUnit: number;
  stockId: string;
  stockFot: string;
  nomorPIs: string[];
}

interface PILoadInfo {
  nomorPIs: string[];
  totalOrderedKG: number;
  totalLoadedKG: number;
  remainingKG: number;
  produkList: ProdukAggregate[];
  customers: string[];
}

const getRomanMonth = (month: number) => {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[month - 1] || "I";
};

const parseNomorSeriGI = (nomorSeri: string) => {
  const parts = nomorSeri.split("/");
  if (parts.length !== 4) return null;
  const prefix = parts[0];
  const year = parseInt(parts[1]);
  const roman = parts[2];
  const urut = parseInt(parts[3]);
  if (prefix !== "BAGB-SP" || isNaN(year) || isNaN(urut)) return null;
  return { prefix, year, roman, urut };
};

export default function SuratPengangkutanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlNomorPI = searchParams.get("nomorPI");

  const [piList, setPiList] = useState<ProformaInvoice[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [existingSuratList, setExistingSuratList] = useState<ExistingSurat[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [jenisSurat, setJenisSurat] = useState<"gudangInduk" | "do" | "">("");
  const [subJenisDO, setSubJenisDO] = useState<"mandiri" | "dikuasakan" | "">("");
  const [showJenisModal, setShowJenisModal] = useState(true);
  const [showSubJenisModal, setShowSubJenisModal] = useState(false);
  const [piLoadInfo, setPiLoadInfo] = useState<PILoadInfo | null>(null);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    namaKabupaten: "Lamandau",
    nomorPI: "",
    nomorPolisi: "",
    driverUnit: "",
    nomorSIM: "",
    kepadaNama: "",
    kepadaPerusahaan: "",
    kepadaAlamat: "",
  });

  const [items, setItems] = useState<SuratPengangkutanItem[]>([]);
  const [searchPI, setSearchPI] = useState("");
  const [showPISearch, setShowPISearch] = useState(false);
  const [selectedPIs, setSelectedPIs] = useState<ProformaInvoice[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProformaInvoice();
    fetchStockGudang();
    fetchExistingSurat();
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedPIs.length > 0 && (jenisSurat === "gudangInduk" || subJenisDO === "mandiri" || subJenisDO === "dikuasakan")) {
      calculatePILoadInfo();
    } else {
      setPiLoadInfo(null);
      if (jenisSurat === "gudangInduk" || subJenisDO === "mandiri" || subJenisDO === "dikuasakan") {
        setItems([]);
      }
    }
  }, [selectedPIs, stockList, jenisSurat, subJenisDO]);

  useEffect(() => {
    if (urlNomorPI && piList.length > 0 && jenisSurat === "gudangInduk") {
      const pi = piList.find((p) => p.nomorPI === urlNomorPI);
      if (pi && !selectedPIs.find((sp) => sp.id === pi.id)) {
        handlePISelect(pi);
      }
    }
  }, [urlNomorPI, piList, jenisSurat]);

  useEffect(() => {
    if (subJenisDO === "mandiri" && items.length === 0) {
      setItems([
        {
          id: 1,
          nomorSubDO: "",
          nomorPO: "",
          jenisPupuk: "",
          party: "",
          pengambilanZAK: "",
          sisa: "",
          bobotPerUnit: 50,
          maxZAK: 0,
          fot: "",
        },
      ]);
    }
  }, [subJenisDO]);

  const handleClickOutside = (e: MouseEvent) => {
    if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
      setShowPISearch(false);
    }
  };

  const fetchExistingSurat = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        nomorSeri: doc.data().nomorSeri || "",
      } as ExistingSurat));
      setExistingSuratList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const getNextNomorSeriGI = () => {
    const now = new Date();
    const year = now.getFullYear();
    const roman = getRomanMonth(now.getMonth() + 1);
    const prefix = `BAGB-SP/${year}/${roman}`;
    const numbers: number[] = [];
    existingSuratList.forEach((s) => {
      const parsed = parseNomorSeriGI(s.nomorSeri);
      if (parsed && parsed.year === year && parsed.roman === roman) {
        numbers.push(parsed.urut);
      }
    });
    numbers.sort((a, b) => a - b);
    let nextUrut = 1;
    for (const num of numbers) {
      if (num === nextUrut) {
        nextUrut++;
      } else if (num > nextUrut) {
        break;
      }
    }
    return `${prefix}/${String(nextUrut).padStart(4, "0")}`;
  };

  const generateNomorSeriDO = () => {
    const firstItem = items.find((it) => it.nomorSubDO.trim() !== "");
    const nomorSubDO = firstItem?.nomorSubDO?.trim() || "";
    if (!nomorSubDO) return "";
    const perusahaan = subJenisDO === "mandiri"
      ? formData.kepadaPerusahaan.trim()
      : (selectedPIs[0]?.namaCustomer || "").trim();
    if (!perusahaan) return "";
    const prefix = `BAGB-DO ${nomorSubDO} -SP PT ${perusahaan} - `;
    const existing = existingSuratList.filter((s) => s.nomorSeri.startsWith(prefix));
    const numbers = existing.map((s) => {
      const lastPart = s.nomorSeri.slice(prefix.length);
      return parseInt(lastPart) || 0;
    });
    numbers.sort((a, b) => a - b);
    let nextUrut = 1;
    for (const num of numbers) {
      if (num === nextUrut) nextUrut++;
      else if (num > nextUrut) break;
    }
    return `${prefix}${String(nextUrut).padStart(4, "0")}`;
  };

  const generateNomorSeri = () => {
    if (jenisSurat === "gudangInduk") {
      return getNextNomorSeriGI();
    } else if (jenisSurat === "do") {
      return generateNomorSeriDO();
    }
    return "";
  };

  const fetchProformaInvoice = async () => {
    try {
      const q = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        nomorPI: doc.data().nomorPI || "",
        namaCustomer: doc.data().namaCustomer || "",
        alamatCustomer: doc.data().alamatCustomer || "",
        tanggal: doc.data().tanggal || "",
        produkItems: doc.data().produkItems || [],
        jumlahTertagih: doc.data().jumlahTertagih || 0,
      } as ProformaInvoice));
      setPiList(data);
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
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
        fot: doc.data().fot || "",
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        stokAkhirUnit: doc.data().stokAkhirUnit || 0,
        stokAkhirKG: doc.data().stokAkhirKG || 0,
        barangKeluarUnit: doc.data().barangKeluarUnit || 0,
        barangKeluarKG: doc.data().barangKeluarKG || 0,
      } as StockItem));
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const getStockForProduct = (namaProduk: string) => {
    return stockList.find((s) =>
      s.namaBarang.toUpperCase().includes(namaProduk.toUpperCase()) ||
      namaProduk.toUpperCase().includes(s.namaBarang.toUpperCase())
    );
  };

  const getBobotPerUnit = (namaProduk: string) => {
    const stock = getStockForProduct(namaProduk);
    return stock ? stock.bobotPerUnit : 50;
  };

  const getStockIdForProduct = (namaProduk: string) => {
    const stock = getStockForProduct(namaProduk);
    return stock ? stock.id : "";
  };

  const getStockFotForProduct = (namaProduk: string) => {
    const stock = getStockForProduct(namaProduk);
    return stock ? stock.fot : "";
  };

  const calculatePILoadInfo = async () => {
    if (selectedPIs.length === 0) {
      setPiLoadInfo(null);
      return;
    }
    try {
      const allNomorPIs = selectedPIs.map((p) => p.nomorPI);
      const q = query(
        collection(db, "suratPengangkutan"),
        where("nomorPI", "in", allNomorPIs)
      );
      const snapshot = await getDocs(q);
      let totalLoadedKG = 0;
      const produkMap: Record<string, ProdukAggregate> = {};

      selectedPIs.forEach((pi) => {
        pi.produkItems.forEach((prod) => {
          const key = prod.namaProduk;
          const bobot = getBobotPerUnit(prod.namaProduk);
          if (!produkMap[key]) {
            produkMap[key] = {
              namaProduk: prod.namaProduk,
              fot: prod.fot,
              orderedKG: 0,
              loadedKG: 0,
              remainingKG: 0,
              bobotPerUnit: bobot,
              stockId: getStockIdForProduct(prod.namaProduk),
              stockFot: getStockFotForProduct(prod.namaProduk),
              nomorPIs: [],
            };
          }
          produkMap[key].orderedKG += prod.kuantitas || 0;
          if (!produkMap[key].nomorPIs.includes(pi.nomorPI)) {
            produkMap[key].nomorPIs.push(pi.nomorPI);
          }
        });
      });

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const suratItems = data.items || [];
        suratItems.forEach((item: { jenisPupuk: string; pengambilanZAK: number | string; bobotPerUnit: number }) => {
          const zak = parseFloat(String(item.pengambilanZAK)) || 0;
          const bobot = item.bobotPerUnit || 50;
          const kg = zak * bobot;
          totalLoadedKG += kg;
          Object.keys(produkMap).forEach((key) => {
            if (item.jenisPupuk && (
              item.jenisPupuk.toUpperCase().includes(key.toUpperCase()) ||
              key.toUpperCase().includes(item.jenisPupuk.toUpperCase())
            )) {
              produkMap[key].loadedKG += kg;
            }
          });
        });
      });

      const totalOrderedKG = selectedPIs.reduce((sum, pi) => sum + pi.produkItems.reduce((s, p) => s + (p.kuantitas || 0), 0), 0);
      const produkList = Object.values(produkMap).map((p) => ({
        namaProduk: p.namaProduk,
        fot: p.fot,
        orderedKG: p.orderedKG,
        loadedKG: p.loadedKG,
        remainingKG: Math.max(0, p.orderedKG - p.loadedKG),
        bobotPerUnit: p.bobotPerUnit,
        stockId: p.stockId,
        stockFot: p.stockFot,
        nomorPIs: p.nomorPIs,
      }));

      setPiLoadInfo({
        nomorPIs: allNomorPIs,
        totalOrderedKG: totalOrderedKG,
        totalLoadedKG: totalLoadedKG,
        remainingKG: Math.max(0, totalOrderedKG - totalLoadedKG),
        produkList: produkList,
        customers: selectedPIs.map((p) => p.namaCustomer).filter((v, i, a) => a.indexOf(v) === i),
      });

      const newItems: SuratPengangkutanItem[] = [];
      let idCounter = 1;
      produkList.forEach((prod) => {
        if (prod.remainingKG > 0) {
          const maxZAK = Math.floor(prod.remainingKG / prod.bobotPerUnit);
          newItems.push({
            id: idCounter++,
            nomorSubDO: "",
            nomorPO: "",
            jenisPupuk: prod.namaProduk,
            party: "",
            pengambilanZAK: maxZAK > 0 ? String(maxZAK) : "",
            sisa: "",
            bobotPerUnit: prod.bobotPerUnit,
            maxZAK: maxZAK,
            fot: prod.fot,
            nomorPI: prod.nomorPIs.join(", "),
          });
        }
      });
      if (newItems.length === 0) {
        newItems.push({
          id: 1,
          nomorSubDO: "",
          nomorPO: "",
          jenisPupuk: "",
          party: "",
          pengambilanZAK: "",
          sisa: "",
          bobotPerUnit: 50,
          maxZAK: 0,
          fot: "",
        });
      }
      setItems(newItems);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePISelect = (pi: ProformaInvoice) => {
    if (selectedPIs.find((p) => p.id === pi.id)) return;
    const newSelected = [...selectedPIs, pi];
    setSelectedPIs(newSelected);
    setFormData((prev) => ({
      ...prev,
      nomorPI: newSelected.map((p) => p.nomorPI).join(", "),
      kepadaNama: newSelected[0]?.namaCustomer || "",
      kepadaPerusahaan: newSelected[0]?.namaCustomer || "",
      kepadaAlamat: newSelected[0]?.alamatCustomer || "",
    }));
    setSearchPI("");
    setShowPISearch(false);
  };

  const handlePIRemove = (piId: string) => {
    const newSelected = selectedPIs.filter((p) => p.id !== piId);
    setSelectedPIs(newSelected);
    setFormData((prev) => ({
      ...prev,
      nomorPI: newSelected.map((p) => p.nomorPI).join(", "),
      kepadaNama: newSelected[0]?.namaCustomer || "",
      kepadaPerusahaan: newSelected[0]?.namaCustomer || "",
      kepadaAlamat: newSelected[0]?.alamatCustomer || "",
    }));
    if (newSelected.length === 0) {
      setPiLoadInfo(null);
      setItems([]);
    }
  };

  const getPIAvailableList = () => {
    return piList.filter((pi) => {
      if (selectedPIs.find((p) => p.id === pi.id)) return false;
      const searchLower = searchPI.toLowerCase();
      const matchSearch = pi.nomorPI.toLowerCase().includes(searchLower) || pi.namaCustomer.toLowerCase().includes(searchLower);
      if (!matchSearch) return false;
      if (jenisSurat === "gudangInduk" || subJenisDO === "mandiri" || subJenisDO === "dikuasakan") {
        const totalOrdered = pi.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
        let totalLoaded = 0;
        if (piLoadInfo && piLoadInfo.nomorPIs.includes(pi.nomorPI)) {
          const piProds = piLoadInfo.produkList.filter((pl) => pl.nomorPIs.includes(pi.nomorPI));
          totalLoaded = piProds.reduce((sum, p) => sum + p.loadedKG, 0);
        }
        return totalLoaded < totalOrdered;
      }
      return true;
    });
  };

  const filteredPIList = getPIAvailableList();

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

  const handleItemChange = (id: number, field: keyof SuratPengangkutanItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "pengambilanZAK") {
          const zak = parseFloat(value) || 0;
          if (item.maxZAK > 0 && zak > item.maxZAK) {
            updated.pengambilanZAK = String(item.maxZAK);
            updated.sisa = "0";
          } else if (item.maxZAK > 0) {
            const sisaZAK = Math.max(0, item.maxZAK - zak);
            updated.sisa = String(sisaZAK);
          }
        }
        return updated;
      })
    );
  };

  const addItem = () => {
    const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    setItems((prev) => [
      ...prev,
      {
        id: newId,
        nomorSubDO: "",
        nomorPO: "",
        jenisPupuk: "",
        party: "",
        pengambilanZAK: "",
        sisa: "",
        bobotPerUnit: 50,
        maxZAK: 0,
        fot: "",
      },
    ]);
  };

  const removeItem = (id: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.namaKabupaten.trim()) newErrors.namaKabupaten = "Nama kabupaten wajib diisi";

    const isGI = jenisSurat === "gudangInduk";
    const isMandiri = subJenisDO === "mandiri";
    const isDikuasakan = subJenisDO === "dikuasakan";

    if (isGI || isMandiri) {
      if (!formData.driverUnit.trim()) newErrors.driverUnit = "Driver unit wajib diisi";
      if (!formData.nomorPolisi.trim()) newErrors.nomorPolisi = "Nomor polisi wajib diisi";
    }

    if (isGI || isDikuasakan) {
      if (selectedPIs.length === 0) newErrors.nomorPI = "Minimal 1 Nomor PI wajib dipilih";
    }

    if (isMandiri) {
      if (!formData.kepadaNama.trim()) newErrors.kepadaNama = "Nama penerima wajib diisi";
      if (!formData.kepadaPerusahaan.trim()) newErrors.kepadaPerusahaan = "Nama perusahaan wajib diisi";
      if (!formData.kepadaAlamat.trim()) newErrors.kepadaAlamat = "Alamat wajib diisi";
    }

    if (items.length === 0) {
      newErrors.items = "Minimal harus ada 1 item pengangkutan";
    }

    items.forEach((item, idx) => {
      if (!item.jenisPupuk.trim()) newErrors[`jenisPupuk_${idx}`] = "Jenis pupuk wajib diisi";
      if (isMandiri) {
        if (!item.nomorSubDO.trim()) newErrors[`nomorSubDO_${idx}`] = "Nomor Sub DO wajib diisi";
        if (!item.nomorPO.trim()) newErrors[`nomorPO_${idx}`] = "Nomor PO wajib diisi";
        if (!item.party.trim()) newErrors[`party_${idx}`] = "Party wajib diisi";
      }
      if (!item.pengambilanZAK.trim()) {
        newErrors[`pengambilan_${idx}`] = "Pengambilan wajib diisi";
      } else {
        const zak = parseFloat(item.pengambilanZAK) || 0;
        if (zak <= 0) newErrors[`pengambilan_${idx}`] = "Pengambilan harus lebih dari 0";
        if (jenisSurat === "gudangInduk" && zak > item.maxZAK && item.maxZAK > 0) {
          newErrors[`pengambilan_${idx}`] = `Maksimal ${item.maxZAK} ZAK (${item.maxZAK * item.bobotPerUnit} KG)`;
        }
      }
    });

    if (jenisSurat === "do") {
      const firstItem = items.find((it) => it.nomorSubDO.trim() !== "");
      if (!firstItem || !firstItem.nomorSubDO.trim()) {
        newErrors.nomorSubDO = "Nomor Sub DO wajib diisi untuk generate nomor seri";
      }
      const perusahaan = isMandiri ? formData.kepadaPerusahaan.trim() : (selectedPIs[0]?.namaCustomer || "").trim();
      if (!perusahaan) {
        newErrors.kepadaPerusahaan = "Nama perusahaan wajib diisi untuk generate nomor seri";
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
      const isGI = jenisSurat === "gudangInduk";
      const isMandiri = subJenisDO === "mandiri";
      const isDikuasakan = subJenisDO === "dikuasakan";

      const nomorSeri = generateNomorSeri();
      if (!nomorSeri && !isGI) {
        setErrors({ submit: "Gagal generate nomor seri. Pastikan Sub DO dan nama perusahaan terisi." });
        setIsSubmitting(false);
        return;
      }

      const totalPengambilanKG = items.reduce((sum, item) => {
        const zak = parseFloat(item.pengambilanZAK) || 0;
        return sum + zak * item.bobotPerUnit;
      }, 0);

      const suratData: Record<string, unknown> = {
        jenisSurat,
        subJenisDO: subJenisDO || null,
        tanggal: formData.tanggal,
        namaKabupaten: formData.namaKabupaten,
        items: items.map((item) => ({
          nomorSubDO: item.nomorSubDO,
          nomorPO: item.nomorPO,
          jenisPupuk: item.jenisPupuk,
          party: item.party,
          pengambilanZAK: parseFloat(item.pengambilanZAK) || 0,
          bobotPerUnit: item.bobotPerUnit,
          totalKG: (parseFloat(item.pengambilanZAK) || 0) * item.bobotPerUnit,
          sisa: item.sisa,
          fot: item.fot,
          nomorPI: item.nomorPI || null,
        })),
        totalPengambilanKG: totalPengambilanKG,
        nomorSeri: nomorSeri,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (isGI || isMandiri) {
        suratData.nomorPolisi = formData.nomorPolisi.trim();
        suratData.driverUnit = formData.driverUnit.trim();
        suratData.nomorSIM = formData.nomorSIM.trim() || null;
      }

      if (isMandiri) {
        suratData.kepadaNama = formData.kepadaNama.trim();
        suratData.kepadaPerusahaan = formData.kepadaPerusahaan.trim();
        suratData.kepadaAlamat = formData.kepadaAlamat.trim();
      }

      if (isDikuasakan && selectedPIs.length > 0) {
        suratData.nomorPI = selectedPIs.map((p) => p.nomorPI);
        suratData.namaCustomer = selectedPIs.map((p) => p.namaCustomer).filter((v, i, a) => a.indexOf(v) === i);
        suratData.kepadaNama = selectedPIs[0].namaCustomer || "";
        suratData.kepadaPerusahaan = selectedPIs[0].namaCustomer || "";
        suratData.kepadaAlamat = selectedPIs[0].alamatCustomer || "";
      }

      if (selectedPIs.length > 0) {
        suratData.nomorPI = selectedPIs.map((p) => p.nomorPI);
        suratData.namaCustomer = selectedPIs.map((p) => p.namaCustomer).filter((v, i, a) => a.indexOf(v) === i);
        for (const pi of selectedPIs) {
          const piRef = doc(db, "proformaInvoice", pi.id);
          const piSnap = await getDoc(piRef);
          const piData = piSnap.exists() ? piSnap.data() : null;
          const currentSisa = piData?.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
          let piTotalLoaded = 0;
          items.forEach((item) => {
            const itemPIs = (item.nomorPI || "").split(",").map((s) => s.trim()).filter(Boolean);
            if (itemPIs.includes(pi.nomorPI) || itemPIs.length === 0) {
              const zak = parseFloat(item.pengambilanZAK) || 0;
              piTotalLoaded += zak * item.bobotPerUnit;
            }
          });
          const newSisa = Math.max(0, currentSisa - piTotalLoaded);
          await updateDoc(piRef, {
            sisaPengambilanKG: newSisa,
            statusPengangkutan: newSisa <= 0 ? "complete" : "partial",
            updatedAt: serverTimestamp(),
          });
        }
        if (isGI) {
          for (const item of items) {
            const stockMatch = getStockForProduct(item.jenisPupuk);
            if (stockMatch) {
              const stockRef = doc(db, "stockGudang", stockMatch.id);
              const stockSnap = await getDoc(stockRef);
              if (stockSnap.exists()) {
                const currentData = stockSnap.data();
                const currentStokUnit = currentData.stokAkhirUnit || 0;
                const currentStokKG = currentData.stokAkhirKG || 0;
                const minusUnit = parseFloat(item.pengambilanZAK) || 0;
                const minusKG = minusUnit * item.bobotPerUnit;
                await updateDoc(stockRef, {
                  barangKeluarUnit: (currentData.barangKeluarUnit || 0) + minusUnit,
                  barangKeluarKG: (currentData.barangKeluarKG || 0) + minusKG,
                  stokAkhirUnit: Math.max(0, currentStokUnit - minusUnit),
                  stokAkhirKG: Math.max(0, currentStokKG - minusKG),
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        }
      }

      await addDoc(collection(db, "suratPengangkutan"), suratData);

      const transaksiData: Record<string, unknown> = {
        tanggal: formData.tanggal,
        jenis: isGI ? "suratPengangkutanGudangInduk" : "suratPengangkutanDO",
        nomorSeri: nomorSeri,
        items: suratData.items,
        totalPengambilanKG: totalPengambilanKG,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
      };

      if (isGI || isMandiri) {
        transaksiData.nomorPolisi = formData.nomorPolisi;
        transaksiData.driverUnit = formData.driverUnit;
        transaksiData.nomorSIM = formData.nomorSIM || null;
      }

      if (selectedPIs.length > 0) {
        transaksiData.nomorPI = selectedPIs.map((p) => p.nomorPI);
        transaksiData.namaCustomer = selectedPIs.map((p) => p.namaCustomer).filter((v, i, a) => a.indexOf(v) === i);
      }

      await addDoc(collection(db, "transaksiBarangKeluar"), transaksiData);
      setSuccessMessage(`Surat pengangkutan berhasil dibuat! Nomor Seri: ${nomorSeri}`);
      resetForm();
      fetchExistingSurat();
      fetchStockGudang();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan surat pengangkutan. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      tanggal: new Date().toISOString().split("T")[0],
      namaKabupaten: "Lamandau",
      nomorPI: "",
      nomorPolisi: "",
      driverUnit: "",
      nomorSIM: "",
      kepadaNama: "",
      kepadaPerusahaan: "",
      kepadaAlamat: "",
    });
    setItems([]);
    setSelectedPIs([]);
    setPiLoadInfo(null);
    setSearchPI("");
    setErrors({});
    if (urlNomorPI) {
      router.replace("/dashboard/surat-pengangkutan");
    }
  };

  const handlePrintPDF = () => {
    const nomorSeri = generateNomorSeri();
    if (!nomorSeri && jenisSurat === "do") {
      setErrors({ submit: "Gagal generate nomor seri untuk preview. Pastikan Sub DO dan nama perusahaan terisi." });
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const isGI = jenisSurat === "gudangInduk";
    const itemsHtml = items
      .map(
        (item, idx) => `
        <tr>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
          ${!isGI ? `<td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.nomorSubDO || "-"}</td>` : ""}
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${isGI ? (item.nomorPI || selectedPIs.map((p) => p.nomorPI).join(", ") || "-") : (item.nomorPO || "-")}</td>
          <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${item.jenisPupuk || ""}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.party || "-"}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.pengambilanZAK || "-"} ZAK</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.sisa || "-"}</td>
        </tr>
      `
      )
      .join("");
    const piNumbers = selectedPIs.map((p) => p.nomorPI).join(", ");
    const recipientBox = jenisSurat === "gudangInduk"
      ? `<div class="recipient-box">
              <p class="recipient-title">Kepada Yth :</p>
              <p class="recipient-name">Bapak Kepala Gudang Induk</p>
              <p class="recipient-name">PT Bukit Agrochemical Baru</p>
              <p class="recipient-address">Desa Sungai Rangit<br>Pangkalan Lada, Kalimantan Tengah</p>
            </div>`
      : `<div class="recipient-box">
              <p class="recipient-title">Kepada Yth :</p>
              <p class="recipient-name">${formData.kepadaNama || ""}</p>
              <p class="recipient-name">${formData.kepadaPerusahaan || ""}</p>
              <p class="recipient-address">${(formData.kepadaAlamat || "").replace(/\n/g, "<br>")}</p>
            </div>`;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Pengangkutan ${nomorSeri}</title>
        <style>
          @page { size: A4; margin: 10mm 12mm 10mm 12mm; }
          @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #000; }
          .page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; }
          .header-img { width: 100%; display: block; margin-bottom: 0; }
          .title-bar { text-align: center; background: #15803d; color: white; padding: 8px 0; margin: 8px 0 12px 0; font-weight: bold; font-size: 14px; letter-spacing: 2px; }
          .info-section { margin-bottom: 12px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; }
          .info-label { font-weight: 600; }
          .recipient-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; }
          .recipient-title { font-size: 9px; color: #333; margin-bottom: 2px; }
          .recipient-name { font-size: 11px; font-weight: 700; }
          .recipient-address { font-size: 9px; color: #333; line-height: 1.5; margin-top: 2px; }
          .salutation { font-size: 10px; margin-bottom: 8px; }
          .salutation p { margin-bottom: 2px; }
          .table-section { margin-bottom: 10px; }
          .table-title { text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table th { background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; }
          .data-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: top; }
          .notes-section { margin-top: 10px; font-size: 9px; }
          .notes-section p { margin-bottom: 2px; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 20px; }
          .signature-box { width: 45%; text-align: center; }
          .signature-title { font-size: 9px; margin-bottom: 30px; }
          .signature-img { height: 50px; object-fit: contain; margin: 0 auto; display: block; }
          .signature-name { font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block; }
          .footer-img { width: 100%; display: block; margin-top: 10px; }
          .print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
          .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
          @media print { .print-bar { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="page">
          <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display='none'" />
          <div class="title-bar">SURAT PENGANGKUTAN</div>
          <div class="info-section">
            <div class="info-row">
              <span>${formData.namaKabupaten}, ${new Date(formData.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nomor Seri : ${nomorSeri}</span>
            </div>
            ${piNumbers ? `<div class="info-row"><span class="info-label">Nomor PI : ${piNumbers}</span></div>` : ""}
          </div>
          ${recipientBox}
          <div class="salutation">
            <p>Dengan Hormat,</p>
            <p>Dengan ini mohon dimuatkan pupuk dengan rincian sebagai berikut :</p>
          </div>
          <div class="table-section">
            <div class="table-title">DASAR PENGANGKUTAN</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 30px;">NO</th>
                  ${!isGI ? `<th style="width: 100px;">NOMOR SUB DO</th>` : ""}
                  <th style="width: 100px;">NOMOR PO</th>
                  <th>JENIS PUPUK</th>
                  <th style="width: 60px;">PARTY</th>
                  <th style="width: 100px;">PENGAMBILAN<br>ZAK</th>
                  <th style="width: 60px;">SISA</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          ${isGI || subJenisDO === "mandiri" ? `
          <div class="table-section">
            <div class="table-title">DATA UNIT ANGKUTAN</div>
            <table class="data-table">
              <tbody>
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600; width: 120px;">NO. POLISI :</td>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${formData.nomorPolisi}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">DRIVER UNIT :</td>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${formData.driverUnit}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">NOMOR SIM :</td>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${formData.nomorSIM || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          ` : ""}
          <div class="notes-section">
            <p style="font-weight: 700;">Notes :</p>
            <p>- Jika terdapat coretan / tip-ex Sub DO dianggap batal.</p>
            <p>- Sub DO berlaku selama 3 hari dari tanggal Sub DO diterbitkan.</p>
            <p>- Untuk konfirmasi dengan Customer Service kami, silahkan scan QRcode di atas.</p>
          </div>
          <div class="signature-row">
            <div class="signature-box">
              <p class="signature-title">Hormat Kami,<br>PT. BUKIT AGROCHEMICAL BARU</p>
              <img src="/Picture2.png" alt="TTD" class="signature-img" onerror="this.style.display='none'" />
              <p class="signature-name">HENDRA PRAMASYANTO</p>
            </div>
            <div class="signature-box">
              <p class="signature-title">Diangkut oleh,<br>Driver</p>
              <div style="height: 50px;"></div>
              <p class="signature-name">${formData.driverUnit || ""}</p>
            </div>
          </div>
          <img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display='none'" />
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (showJenisModal) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Pilih Jenis Surat</h2>
            <p className="text-gray-500 mt-2">Silakan pilih jenis surat pengangkutan yang ingin dibuat</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => { setJenisSurat("gudangInduk"); setShowJenisModal(false); setShowSubJenisModal(false); }}
              className="p-6 border-2 border-green-200 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Surat Muat Gudang Induk</h3>
                  <p className="text-sm text-gray-500">Untuk permintaan pemuatan dari Gudang Induk dengan referensi Proforma Invoice</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => { setJenisSurat("do"); setShowJenisModal(false); setShowSubJenisModal(true); }}
              className="p-6 border-2 border-blue-200 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">Surat DO (Delivery Order)</h3>
                  <p className="text-sm text-gray-500">Untuk pengiriman langsung dengan opsi Mandiri atau Dikuasakan</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showSubJenisModal && jenisSurat === "do") {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Pilih Sub Jenis DO</h2>
            <p className="text-gray-500 mt-2">Silakan pilih tipe surat DO yang ingin dibuat</p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <button
              onClick={() => { setSubJenisDO("mandiri"); setShowSubJenisModal(false); }}
              className="p-6 border-2 border-indigo-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">DO Mandiri</h3>
                  <p className="text-sm text-gray-500">Sistem lengkap dengan nomor seri, dasar pengangkutan, proforma invoice, dan data unit angkutan</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => { setSubJenisDO("dikuasakan"); setShowSubJenisModal(false); }}
              className="p-6 border-2 border-orange-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition-all text-left group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                  <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-lg">DO Dikuasakan</h3>
                  <p className="text-sm text-gray-500">Dasar pengangkutan otomatis dari PI. Penerima otomatis dari data PI.</p>
                </div>
              </div>
            </button>
          </div>
          <button
            onClick={() => { setShowSubJenisModal(false); setShowJenisModal(true); setJenisSurat(""); }}
            className="mt-6 w-full py-3 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Kembali ke Pilih Jenis Surat
          </button>
        </div>
      </div>
    );
  }

  const isGI = jenisSurat === "gudangInduk";
  const isMandiri = subJenisDO === "mandiri";
  const isDikuasakan = subJenisDO === "dikuasakan";
  const showUnitAngkutan = isGI || isMandiri;
  const pageTitle = isGI ? "Gudang Induk" : isMandiri ? "DO Mandiri" : "DO Dikuasakan";

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Header
          title={`Surat Pengangkutan - ${pageTitle}`}
          subtitle="Buat surat pengangkutan untuk pemuatan barang"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setShowJenisModal(true); setJenisSurat(""); setSubJenisDO(""); resetForm(); }}
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Ganti Jenis Surat
        </Button>
      </div>

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
        <Card title="Informasi Umum">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input
              label="Tanggal"
              type="date"
              name="tanggal"
              value={formData.tanggal}
              onChange={handleChange}
              error={errors.tanggal}
              required
            />
            <Input
              label="Nama Kabupaten"
              type="text"
              name="namaKabupaten"
              value={formData.namaKabupaten}
              onChange={handleChange}
              error={errors.namaKabupaten}
              required
            />
          </div>
        </Card>

        <Card title={isDikuasakan ? "Pilih Proforma Invoice" : "Proforma Invoice"} className="overflow-visible">
          <div className="space-y-4">
            <div ref={searchRef} className="relative z-50 overflow-visible">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cari Nomor Proforma Invoice
              </label>
              <input
                type="text"
                value={searchPI}
                onChange={(e) => {
                  setSearchPI(e.target.value);
                  setShowPISearch(true);
                }}
                onFocus={() => setShowPISearch(true)}
                placeholder="Ketik nomor PI atau nama customer..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white"
              />
              {showPISearch && (
                <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto z-[9999]" onMouseDown={(e) => e.preventDefault()}>
                  {searchPI && filteredPIList.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">Tidak ada PI yang tersedia atau tidak cocok</div>
                  ) : !searchPI ? (
                    <div className="p-3 text-xs text-gray-400">Ketik minimal 1 karakter untuk mencari PI</div>
                  ) : (
                    filteredPIList.map((pi) => {
                      const totalOrdered = pi.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
                      let totalLoaded = 0;
                      if (piLoadInfo && piLoadInfo.nomorPIs.includes(pi.nomorPI)) {
                        const piProds = piLoadInfo.produkList.filter((pl) => pl.nomorPIs.includes(pi.nomorPI));
                        totalLoaded = piProds.reduce((sum, p) => sum + p.loadedKG, 0);
                      }
                      const sisa = Math.max(0, totalOrdered - totalLoaded);
                      return (
                        <button
                          key={pi.id}
                          type="button"
                          onClick={() => handlePISelect(pi)}
                          className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-100 last:border-0 block"
                        >
                          <p className="font-semibold text-gray-800">{pi.nomorPI}</p>
                          <p className="text-sm text-gray-500">{pi.namaCustomer} | {pi.tanggal}</p>
                          <p className="text-xs text-green-600 mt-1">Total: {totalOrdered.toLocaleString()} KG | Sisa: {sisa.toLocaleString()} KG</p>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
              {errors.nomorPI && <p className="mt-1 text-sm text-red-600">{errors.nomorPI}</p>}
            </div>

            {selectedPIs.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedPIs.map((pi) => (
                  <div key={pi.id} className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium border border-green-200">
                    <span>{pi.nomorPI}</span>
                    <button
                      type="button"
                      onClick={() => handlePIRemove(pi.id)}
                      className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-green-200 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isDikuasakan && selectedPIs.length > 0 && (
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-2">Data Penerima dari PI</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Nama</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedPIs[0].namaCustomer}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Perusahaan</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedPIs[0].namaCustomer}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Alamat</p>
                    <p className="text-sm font-semibold text-gray-800">{selectedPIs[0].alamatCustomer || "-"}</p>
                  </div>
                </div>
              </div>
            )}

            {isGI && piLoadInfo && (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total Dipesan</p>
                  <p className="text-xl font-bold text-blue-700 font-mono">{piLoadInfo.totalOrderedKG.toLocaleString()} KG</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Sudah Dimuat</p>
                  <p className="text-xl font-bold text-amber-700 font-mono">{piLoadInfo.totalLoadedKG.toLocaleString()} KG</p>
                </div>
                <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                  <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Sisa</p>
                  <p className="text-xl font-bold text-green-700 font-mono">{piLoadInfo.remainingKG.toLocaleString()} KG</p>
                </div>
              </div>
            )}

            {isGI && piLoadInfo && piLoadInfo.produkList.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Detail Per Produk</h4>
                <div className="space-y-2">
                  {piLoadInfo.produkList.map((prod, idx) => (
                    <div key={idx} className={`p-3 rounded-lg border ${prod.remainingKG > 0 ? "bg-yellow-50 border-yellow-200" : "bg-green-50 border-green-200"}`}>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{prod.namaProduk}</p>
                          <p className="text-xs text-gray-500">FOT: {prod.fot} | Bobot: {prod.bobotPerUnit} KG/ZAK</p>
                          <p className="text-xs text-gray-400">PI: {prod.nomorPIs.join(", ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">{prod.loadedKG.toLocaleString()} / {prod.orderedKG.toLocaleString()} KG</p>
                          <p className={`text-sm font-bold ${prod.remainingKG > 0 ? "text-yellow-700" : "text-green-700"}`}>
                            Sisa: {prod.remainingKG.toLocaleString()} KG ({Math.floor(prod.remainingKG / prod.bobotPerUnit)} ZAK)
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {isMandiri && (
          <Card title="Informasi Penerima">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Kepada Yth (Nama)" type="text" name="kepadaNama" value={formData.kepadaNama} onChange={handleChange} placeholder="Contoh: Bapak Kepala Gudang" error={errors.kepadaNama} required />
              <Input label="Nama Perusahaan" type="text" name="kepadaPerusahaan" value={formData.kepadaPerusahaan} onChange={handleChange} placeholder="Contoh: PT Bukit Agrochemical Baru" error={errors.kepadaPerusahaan} required />
              <Input label="Alamat" type="text" name="kepadaAlamat" value={formData.kepadaAlamat} onChange={handleChange} placeholder="Contoh: Desa Sungai Rangit, Pangkalan Lada" error={errors.kepadaAlamat} required className="md:col-span-2" />
            </div>
          </Card>
        )}

        <Card title="Dasar Pengangkutan">
          <div className="space-y-4">
            {errors.items && (
              <p className="text-sm text-red-600">{errors.items}</p>
            )}
            {items.map((item, idx) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Item {idx + 1}</h4>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {!isGI && (
                    <>
                      <Input label="Nomor SUB DO" type="text" value={item.nomorSubDO} onChange={(e) => handleItemChange(item.id, "nomorSubDO", e.target.value)} placeholder={isMandiri ? "Wajib" : "Opsional"} error={errors[`nomorSubDO_${idx}`]} required={isMandiri} />
                      <Input label="Nomor PO" type="text" value={item.nomorPO} onChange={(e) => handleItemChange(item.id, "nomorPO", e.target.value)} placeholder={isMandiri ? "Wajib" : "Opsional"} error={errors[`nomorPO_${idx}`]} required={isMandiri} />
                    </>
                  )}
                  <Input label="Jenis Pupuk" type="text" value={item.jenisPupuk} onChange={(e) => handleItemChange(item.id, "jenisPupuk", e.target.value)} placeholder="Otomatis dari PI" error={errors[`jenisPupuk_${idx}`]} required />
                  {!isGI && (
                    <Input label="Party" type="text" value={item.party} onChange={(e) => handleItemChange(item.id, "party", e.target.value)} placeholder={isMandiri ? "Wajib" : "Opsional"} error={errors[`party_${idx}`]} required={isMandiri} />
                  )}
                  <div>
                    <Input label={`Pengambilan (ZAK)${item.maxZAK > 0 ? ` - Max: ${item.maxZAK}` : ""}`} type="number" value={item.pengambilanZAK} onChange={(e) => handleItemChange(item.id, "pengambilanZAK", e.target.value)} placeholder={item.maxZAK > 0 ? `Max ${item.maxZAK} ZAK` : "Contoh: 100"} />
                    {item.bobotPerUnit > 0 && item.pengambilanZAK && (
                      <p className="mt-1 text-xs text-gray-500">
                        = {(parseFloat(item.pengambilanZAK || "0") * item.bobotPerUnit).toLocaleString()} KG (bobot: {item.bobotPerUnit} KG/ZAK)
                      </p>
                    )}
                  </div>
                  <div>
                    <Input label="Sisa (ZAK)" type="text" value={item.sisa} onChange={(e) => handleItemChange(item.id, "sisa", e.target.value)} placeholder="Auto-calculate" readOnly />
                    {item.bobotPerUnit > 0 && item.sisa && (
                      <p className="mt-1 text-xs text-gray-500">
                        = {(parseFloat(item.sisa || "0") * item.bobotPerUnit).toLocaleString()} KG
                      </p>
                    )}
                  </div>
                </div>
                {errors[`pengambilan_${idx}`] && (
                  <p className="mt-2 text-sm text-red-600">{errors[`pengambilan_${idx}`]}</p>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Item
            </Button>
          </div>
        </Card>

        {showUnitAngkutan && (
          <Card title="Data Unit Angkutan">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Nomor Polisi Kendaraan" type="text" name="nomorPolisi" value={formData.nomorPolisi} onChange={handleChange} placeholder="Contoh: S 9701 JH" error={errors.nomorPolisi} required />
              <Input label="Driver Unit" type="text" name="driverUnit" value={formData.driverUnit} onChange={handleChange} placeholder="Contoh: FUAD" error={errors.driverUnit} required />
              <Input label="Nomor SIM (Opsional)" type="text" name="nomorSIM" value={formData.nomorSIM} onChange={handleChange} placeholder="Contoh: 1234567890" className="md:col-span-2" />
            </div>
          </Card>
        )}

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button type="button" variant="outline" onClick={resetForm}>
            Reset Form
          </Button>
          <Button type="button" variant="secondary" onClick={handlePrintPDF}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Preview PDF
          </Button>
          <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting}>
            Simpan Surat Pengangkutan
          </Button>
        </div>
      </form>
    </div>
  );
}