"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, getDoc, serverTimestamp, runTransaction, Timestamp, where, deleteDoc } from "firebase/firestore";
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
  unit: string;
  bobotPerUnit: number;
  botolPerDus?: number;
  stokAkhirUnit: number;
  stokAkhirKG: number;
  barangMasukUnit: number;
  barangMasukKG: number;
  stokAwalUnit: number;
  stokAwalKG: number;
  barangKeluarUnit: number;
  barangKeluarKG: number;
  barangRusakUnit: number;
  barangRusakKG: number;
  barangDigantiUnit: number;
  barangDigantiKG: number;
  sisaRusakUnit: number;
  sisaRusakKG: number;
}

interface UnreplacedRusak {
  transaksiId: string;
  fot: string;
  kodeBarang: string;
  namaBarang: string;
  unitMasuk: string;
  rusakUnit: string;
  rusakJumlah: number;
  rusakKeterangan: string;
  rusakIndex: number;
  tanggalTransaksi: string;
  fotoUrls?: string[];
  sudahDiganti: number;
  sisaRusak: number;
  jumlahTidakDiganti: number;
  status: string;
  nomorBA?: string;
}

interface PenggantianRecord {
  id: string;
  tanggal: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  jumlahZAK: number;
  totalKG: number;
  fot: string;
  referensiTransaksiId: string;
  referensiRusakIndex: number;
  referensiNomorBA: string;
  nomorBA: string;
  createdBy: string;
  createdAt: any;
  fotoUrls?: string[];
  jumlahTidakDiganti: number;
  sisaSetelah: number;
}

interface TidakDigantiRecord {
  transaksiId: string;
  rusakIndex: number;
  nomorBA: string;
  nomorBATidakDiganti: string;
  tanggalTransaksi: string;
  fot: string;
  kodeBarang: string;
  namaBarang: string;
  unitMasuk: string;
  rusakUnit: string;
  rusakJumlah: number;
  jumlahTidakDiganti: number;
  jumlahDiganti: number;
  sisaRusak: number;
  rusakKeterangan: string;
  status: string;
  fotoUrls?: string[];
}

const getUniqueBANumber = async (prefix: string): Promise<string> => {
  const counterRef = doc(db, "counters", `ba_${prefix}`);
  const lockRef = doc(db, "baLocks", `lock_${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);

  await runTransaction(db, async (transaction) => {
    const lockSnap = await transaction.get(lockRef);
    if (lockSnap.exists()) throw new Error("Lock collision");
    transaction.set(lockRef, { createdAt: Timestamp.now(), expiresAt: new Timestamp(Timestamp.now().seconds + 30, 0) });
  });

  try {
    const result = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      let gaps: number[] = [];
      let lastNum = 0;
      if (counterSnap.exists()) {
        gaps = counterSnap.data().gaps || [];
        lastNum = counterSnap.data().lastNum || 0;
      }
      let num = 1;
      if (gaps.length > 0) {
        num = gaps[0];
        gaps = gaps.slice(1);
      } else {
        num = lastNum + 1;
        lastNum = num;
      }
      transaction.set(counterRef, { gaps, lastNum, updatedAt: Timestamp.now() }, { merge: true });
      return num;
    });

    await deleteDoc(lockRef);
    const padded = String(result).padStart(3, "0");
    return `BAGB-BA-${prefix.toUpperCase()}-${padded}`;
  } catch (error) {
    await deleteDoc(lockRef).catch(() => {});
    throw error;
  }
};

const releaseBANumber = async (nomorBA: string) => {
  try {
    const match = nomorBA.match(/^BAGB-BA-([A-Z]+)-(\\d{3})$/);
    if (!match) return;
    const prefix = match[1].toLowerCase();
    const num = parseInt(match[2]);
    const counterRef = doc(db, "counters", `ba_${prefix}`);
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      if (!snap.exists()) return;
      let gaps = snap.data().gaps || [];
      if (!gaps.includes(num)) {
        gaps.push(num);
        gaps.sort((a: number, b: number) => a - b);
      }
      transaction.set(counterRef, { gaps, updatedAt: Timestamp.now() }, { merge: true });
    });
  } catch (error) {
    console.error(error);
  }
};

const calculateAddUnitKG = (jumlah: number, unit: string, stock?: StockItem) => {
  let addUnit = 0;
  let addKG = 0;
  if (unit === "KG") {
    addKG = jumlah;
  } else if (unit === "BOTOL") {
    const dusPerZak = 10;
    const totalBotol = jumlah * dusPerZak * (stock?.botolPerDus || 20);
    addKG = (totalBotol * 50) / 1000;
    addUnit = jumlah;
  } else if (unit === "DUS") {
    const totalBotol = jumlah * (stock?.botolPerDus || 20);
    addKG = (totalBotol * 50) / 1000;
    addUnit = jumlah;
  } else {
    const bobotPerUnit = stock ? stock.bobotPerUnit : 50;
    addKG = jumlah * bobotPerUnit;
    addUnit = jumlah;
  }
  return { addUnit, addKG };
};

export default function PenggantiBarangRusakPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [unreplacedRusakList, setUnreplacedRusakList] = useState<UnreplacedRusak[]>([]);
  const [penggantianHistory, setPenggantianHistory] = useState<PenggantianRecord[]>([]);
  const [tidakDigantiHistory, setTidakDigantiHistory] = useState<TidakDigantiRecord[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPenggantian, setSelectedPenggantian] = useState<PenggantianRecord | null>(null);
  const [selectedTidakDiganti, setSelectedTidakDiganti] = useState<TidakDigantiRecord | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isPrintTidakDigantiOpen, setIsPrintTidakDigantiOpen] = useState(false);

  const [penggantianForm, setPenggantianForm] = useState({
    transaksiId: "",
    rusakIndex: 0,
    tanggal: new Date().toISOString().split("T")[0],
    jumlahZAK: "",
    jumlahTidakDiganti: "",
    fotoUrls: [] as string[],
    maxJumlah: 0,
    unitRusak: "ZAK",
  });

  const [editTidakDigantiForm, setEditTidakDigantiForm] = useState<{
    transaksiId: string;
    rusakIndex: number;
    jumlahTidakDiganti: string;
    rusakUnit: string;
    unitMasuk: string;
    kodeBarang: string;
    namaBarang: string;
    maxPossible: number;
    nomorBATidakDiganti: string;
  } | null>(null);

  const [editRusakForm, setEditRusakForm] = useState<{
    transaksiId: string;
    rusakIndex: number;
    jumlahRusak: string;
    keterangan: string;
    fotoUrls: string[];
    rusakUnit: string;
    unitMasuk: string;
    kodeBarang: string;
    namaBarang: string;
    oldJumlah: number;
  } | null>(null);

  const [fotoLoading, setFotoLoading] = useState(false);

  useEffect(() => {
    const preventScrollOnNumberInput = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" && (target as HTMLInputElement).type === "number") {
        e.preventDefault();
      }
    };
    document.addEventListener("wheel", preventScrollOnNumberInput, { passive: false });
    return () => document.removeEventListener("wheel", preventScrollOnNumberInput);
  }, []);

  useEffect(() => {
    fetchStockGudang();
    fetchUnreplacedRusak();
    fetchPenggantianHistory();
    fetchTidakDigantiHistory();
  }, []);

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        botolPerDus: doc.data().botolPerDus ?? undefined,
        stokAkhirUnit: doc.data().stokAkhirUnit || 0,
        stokAkhirKG: doc.data().stokAkhirKG || 0,
        barangMasukUnit: doc.data().barangMasukUnit || 0,
        barangMasukKG: doc.data().barangMasukKG || 0,
        stokAwalUnit: doc.data().stokAwalUnit || 0,
        stokAwalKG: doc.data().stokAwalKG || 0,
        barangKeluarUnit: doc.data().barangKeluarUnit || 0,
        barangKeluarKG: doc.data().barangKeluarKG || 0,
        barangRusakUnit: doc.data().barangRusakUnit || 0,
        barangRusakKG: doc.data().barangRusakKG || 0,
        barangDigantiUnit: doc.data().barangDigantiUnit || 0,
        barangDigantiKG: doc.data().barangDigantiKG || 0,
        sisaRusakUnit: doc.data().sisaRusakUnit || 0,
        sisaRusakKG: doc.data().sisaRusakKG || 0,
      } as StockItem));
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUnreplacedRusak = async () => {
    try {
      const q = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list: UnreplacedRusak[] = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.adaBarangRusak && Array.isArray(d.barangRusak)) {
          d.barangRusak.forEach((r: any, idx: number) => {
            const sudahDiganti = r.jumlahDiganti || 0;
            const jumlahTidakDiganti = r.jumlahTidakDiganti || 0;
            const sisaRusak = (r.jumlah || 0) - sudahDiganti - jumlahTidakDiganti;
            if (sisaRusak > 0) {
              list.push({
                transaksiId: docSnap.id,
                fot: d.fot || "",
                kodeBarang: d.kodeBarang || "",
                namaBarang: d.namaBarang || "",
                unitMasuk: d.unit || "ZAK",
                rusakUnit: r.unit || "ZAK",
                rusakJumlah: r.jumlah || 0,
                rusakKeterangan: r.keterangan || "",
                rusakIndex: idx,
                tanggalTransaksi: d.tanggal || "",
                fotoUrls: r.fotoUrls || [],
                sudahDiganti: sudahDiganti,
                sisaRusak: sisaRusak,
                jumlahTidakDiganti: jumlahTidakDiganti,
                status: r.status || "belum diganti",
                nomorBA: r.nomorBA || "",
              });
            }
          });
        }
      });
      setUnreplacedRusakList(list);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchPenggantianHistory = async () => {
    try {
      const q = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list: PenggantianRecord[] = [];
      for (const docSnap of snapshot.docs) {
        const d = docSnap.data();
        if (d.isPenggantianRusak !== true) continue;
        let fotoUrls: string[] = [];
        try {
          const fotoQ = query(collection(db, "penggantianFoto"), where("penggantianTransaksiId", "==", docSnap.id));
          const fotoSnap = await getDocs(fotoQ);
          fotoSnap.docs.forEach((f) => {
            const fd = f.data();
            if (fd.fotoUrls && Array.isArray(fd.fotoUrls)) {
              fotoUrls = [...fotoUrls, ...fd.fotoUrls];
            }
          });
        } catch (e) {}
        list.push({
          id: docSnap.id,
          tanggal: d.tanggal || "",
          kodeBarang: d.kodeBarang || "",
          namaBarang: d.namaBarang || "",
          unit: d.unit || "ZAK",
          jumlahZAK: d.jumlahZAK || 0,
          totalKG: d.totalKG || 0,
          fot: d.fot || "",
          referensiTransaksiId: d.referensiTransaksiId || "",
          referensiRusakIndex: d.referensiRusakIndex ?? 0,
          referensiNomorBA: d.referensiNomorBA || "",
          nomorBA: d.nomorBA || "",
          createdBy: d.createdBy || "",
          createdAt: d.createdAt,
          fotoUrls: fotoUrls.length > 0 ? fotoUrls : d.fotoUrls || [],
          jumlahTidakDiganti: d.jumlahTidakDiganti || 0,
          sisaSetelah: d.sisaSetelah ?? (d.jumlahZAK ? d.jumlahZAK - (d.jumlahTidakDiganti || 0) : 0),
        });
      }
      setPenggantianHistory(list);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchTidakDigantiHistory = async () => {
    try {
      const q = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list: TidakDigantiRecord[] = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.adaBarangRusak && Array.isArray(d.barangRusak)) {
          d.barangRusak.forEach((r: any, idx: number) => {
            const jumlahTidakDiganti = r.jumlahTidakDiganti || 0;
            if (jumlahTidakDiganti > 0) {
              list.push({
                transaksiId: docSnap.id,
                rusakIndex: idx,
                nomorBA: r.nomorBA || "",
                nomorBATidakDiganti: r.nomorBATidakDiganti || "",
                tanggalTransaksi: d.tanggal || "",
                fot: d.fot || "",
                kodeBarang: d.kodeBarang || "",
                namaBarang: d.namaBarang || "",
                unitMasuk: d.unit || "ZAK",
                rusakUnit: r.unit || "ZAK",
                rusakJumlah: r.jumlah || 0,
                jumlahTidakDiganti: jumlahTidakDiganti,
                jumlahDiganti: r.jumlahDiganti || 0,
                sisaRusak: r.sisaRusak || 0,
                rusakKeterangan: r.keterangan || "",
                status: r.status || "belum diganti",
                fotoUrls: r.fotoUrls || [],
              });
            }
          });
        }
      });
      setTidakDigantiHistory(list);
    } catch (error) {
      console.error(error);
    }
  };

  const compressImage = (file: File, maxSizeMB: number = 0.5): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDimension = 1280;
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
          let quality = 0.85;
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

  const handlePenggantianFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (penggantianForm.fotoUrls.length + files.length > 3) {
      setErrors((prev) => ({ ...prev, foto: "Maksimal 3 foto" }));
      return;
    }
    setFotoLoading(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i], 0.5);
        newPhotos.push(compressed);
      }
      setPenggantianForm((prev) => ({ ...prev, fotoUrls: [...prev.fotoUrls, ...newPhotos] }));
      setErrors((prev) => { const n = { ...prev }; delete n.foto; return n; });
    } catch (error) {
      console.error(error);
    } finally {
      setFotoLoading(false);
      e.target.value = "";
    }
  };

  const removePenggantianFoto = (idx: number) => {
    setPenggantianForm((prev) => ({ ...prev, fotoUrls: prev.fotoUrls.filter((_, i) => i !== idx) }));
  };

  const handleRusakFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (!editRusakForm) return;
    if (editRusakForm.fotoUrls.length + files.length > 3) {
      setErrors((prev) => ({ ...prev, foto: "Maksimal 3 foto" }));
      return;
    }
    setFotoLoading(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i], 0.5);
        newPhotos.push(compressed);
      }
      setEditRusakForm((prev) => prev ? { ...prev, fotoUrls: [...prev.fotoUrls, ...newPhotos] } : null);
      setErrors((prev) => { const n = { ...prev }; delete n.foto; return n; });
    } catch (error) {
      console.error(error);
    } finally {
      setFotoLoading(false);
      e.target.value = "";
    }
  };

  const removeRusakFoto = (idx: number) => {
    setEditRusakForm((prev) => prev ? { ...prev, fotoUrls: prev.fotoUrls.filter((_, i) => i !== idx) } : null);
  };

  const handleSubmitPenggantian = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const newErrors: Record<string, string> = {};
    if (!penggantianForm.transaksiId) {
      newErrors.penggantian = "Pilih barang rusak yang akan diganti";
    }
    const jumlahInput = parseFloat(penggantianForm.jumlahZAK) || 0;
    const jumlahTidakInput = parseFloat(penggantianForm.jumlahTidakDiganti) || 0;

    if (jumlahInput < 0) {
      newErrors.penggantianJumlah = "Jumlah penggantian tidak valid";
    }
    if (jumlahTidakInput < 0) {
      newErrors.penggantianTidakDiganti = "Jumlah tidak diganti tidak valid";
    }
    if (jumlahInput === 0 && jumlahTidakInput === 0) {
      newErrors.penggantianTotal = "Minimal input jumlah diganti atau tidak diganti";
    }
    if (penggantianForm.maxJumlah > 0 && jumlahInput > penggantianForm.maxJumlah) {
      newErrors.penggantianJumlah = `Jumlah penggantian tidak boleh melebihi sisa ${penggantianForm.maxJumlah}`;
    }
    if (penggantianForm.maxJumlah > 0 && jumlahTidakInput > penggantianForm.maxJumlah) {
      newErrors.penggantianTidakDiganti = `Jumlah tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}`;
    }
    if (jumlahInput + jumlahTidakInput > penggantianForm.maxJumlah) {
      newErrors.penggantianTotal = `Total diganti + tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}`;
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage("");
    let assignedNomorBA = "";
    let assignedNomorBATidak = "";

    try {
      const selectedRusak = unreplacedRusakList.find((r) => r.transaksiId === penggantianForm.transaksiId && r.rusakIndex === penggantianForm.rusakIndex);
      if (!selectedRusak) {
        setErrors((prev) => ({ ...prev, penggantian: "Data barang rusak tidak ditemukan atau sudah selesai. Silakan refresh halaman." }));
        setIsSubmitting(false);
        return;
      }
      if (selectedRusak.sisaRusak <= 0) {
        setErrors((prev) => ({ ...prev, penggantian: "Barang rusak ini sudah tidak memiliki sisa yang bisa diganti." }));
        setIsSubmitting(false);
        return;
      }

      assignedNomorBA = await getUniqueBANumber("r");
      if (jumlahTidakInput > 0) {
        assignedNomorBATidak = await getUniqueBANumber("u");
      }

      const jumlahPenggantian = parseFloat(penggantianForm.jumlahZAK) || 0;
      const jumlahTidakDiganti = parseFloat(penggantianForm.jumlahTidakDiganti) || 0;
      const stock = stockList.find((s) => s.kodeBarang === selectedRusak.kodeBarang && s.namaBarang === selectedRusak.namaBarang);
      const bobotPerUnit = stock ? stock.bobotPerUnit : 50;
      let totalKG = 0;
      let addUnit = 0;
      let addKG = 0;

      if (selectedRusak.unitMasuk === "KG") {
        totalKG = jumlahPenggantian;
        addUnit = 0;
        addKG = jumlahPenggantian;
      } else if (selectedRusak.unitMasuk === "BOTOL") {
        const dusPerZak = 10;
        const totalBotol = jumlahPenggantian * dusPerZak * (stock?.botolPerDus || 20);
        totalKG = (totalBotol * 50) / 1000;
        addUnit = jumlahPenggantian;
        addKG = totalKG;
      } else if (selectedRusak.unitMasuk === "DUS") {
        const totalBotol = jumlahPenggantian * (stock?.botolPerDus || 20);
        totalKG = (totalBotol * 50) / 1000;
        addUnit = jumlahPenggantian;
        addKG = totalKG;
      } else {
        totalKG = jumlahPenggantian * bobotPerUnit;
        addUnit = jumlahPenggantian;
        addKG = totalKG;
      }

      const sisaSetelah = selectedRusak.sisaRusak - jumlahPenggantian - jumlahTidakDiganti;

      const penggantianData: any = {
        tanggal: penggantianForm.tanggal,
        kodeBarang: selectedRusak.kodeBarang,
        namaBarang: selectedRusak.namaBarang,
        unit: selectedRusak.unitMasuk,
        jumlahZAK: jumlahPenggantian,
        totalKG: totalKG,
        fot: selectedRusak.fot,
        isPenggantianRusak: true,
        referensiTransaksiId: selectedRusak.transaksiId,
        referensiRusakIndex: selectedRusak.rusakIndex,
        referensiNomorBA: selectedRusak.nomorBA || "",
        nomorBA: assignedNomorBA,
        jumlahTidakDiganti: jumlahTidakDiganti,
        sisaSetelah: sisaSetelah > 0 ? sisaSetelah : 0,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const penggantianRef = await addDoc(collection(db, "transaksiBarangMasuk"), penggantianData);

      if (penggantianForm.fotoUrls.length > 0) {
        await addDoc(collection(db, "penggantianFoto"), {
          transaksiId: selectedRusak.transaksiId,
          rusakIndex: selectedRusak.rusakIndex,
          penggantianTransaksiId: penggantianRef.id,
          nomorBA: assignedNomorBA,
          fotoUrls: penggantianForm.fotoUrls,
          createdAt: serverTimestamp(),
        });
      }

      const transaksiRef = doc(db, "transaksiBarangMasuk", selectedRusak.transaksiId);
      const transaksiSnap = await getDoc(transaksiRef);
      if (!transaksiSnap.exists()) {
        throw new Error("Transaksi asli tidak ditemukan di database.");
      }
      const tData = transaksiSnap.data();
      const barangRusakArray = tData.barangRusak || [];
      if (!barangRusakArray[selectedRusak.rusakIndex]) {
        throw new Error("Data barang rusak tidak ditemukan dalam transaksi.");
      }
      const currentSudahDiganti = barangRusakArray[selectedRusak.rusakIndex].jumlahDiganti || 0;
      const currentTidakDiganti = barangRusakArray[selectedRusak.rusakIndex].jumlahTidakDiganti || 0;
      const newSudahDiganti = currentSudahDiganti + jumlahPenggantian;
      const newTidakDiganti = currentTidakDiganti + jumlahTidakDiganti;
      const totalRusak = barangRusakArray[selectedRusak.rusakIndex].jumlah || 0;
      const newSisa = totalRusak - newSudahDiganti - newTidakDiganti;
      let newStatus = "belum diganti";
      if (newSisa <= 0) newStatus = "selesai";
      else if (newSudahDiganti > 0) newStatus = "sebagian diganti";
      else if (newTidakDiganti > 0) newStatus = "tidak diganti";

      barangRusakArray[selectedRusak.rusakIndex] = {
        ...barangRusakArray[selectedRusak.rusakIndex],
        status: newStatus,
        jumlahDiganti: newSudahDiganti,
        jumlahTidakDiganti: newTidakDiganti,
        sisaRusak: newSisa > 0 ? newSisa : 0,
        tanggalPenggantian: penggantianForm.tanggal,
        nomorBAPenggantian: assignedNomorBA,
        nomorBATidakDiganti: assignedNomorBATidak,
      };
      await updateDoc(transaksiRef, {
        barangRusak: barangRusakArray,
        updatedAt: serverTimestamp(),
      });

      if (stock) {
        const stockRef = doc(db, "stockGudang", stock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          const currentMasukUnit = sData.barangMasukUnit || 0;
          const currentMasukKG = sData.barangMasukKG || 0;
          const currentStokUnit = sData.stokAkhirUnit || 0;
          const currentStokKG = sData.stokAkhirKG || 0;
          const currentDigantiUnit = sData.barangDigantiUnit || 0;
          const currentDigantiKG = sData.barangDigantiKG || 0;
          const currentSisaRusakUnit = sData.sisaRusakUnit || 0;
          const currentSisaRusakKG = sData.sisaRusakKG || 0;

          const tidakDigantiCalc = calculateAddUnitKG(jumlahTidakDiganti, selectedRusak.unitMasuk, stock);

          await updateDoc(stockRef, {
            barangMasukUnit: currentMasukUnit + addUnit,
            barangMasukKG: currentMasukKG + addKG,
            stokAkhirUnit: currentStokUnit + addUnit,
            stokAkhirKG: currentStokKG + addKG,
            barangDigantiUnit: currentDigantiUnit + addUnit,
            barangDigantiKG: currentDigantiKG + addKG,
            sisaRusakUnit: Math.max(0, currentSisaRusakUnit - addUnit - tidakDigantiCalc.addUnit),
            sisaRusakKG: Math.max(0, currentSisaRusakKG - addKG - tidakDigantiCalc.addKG),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        console.warn("Stock tidak ditemukan untuk kode barang:", selectedRusak.kodeBarang, selectedRusak.namaBarang);
      }

      const remainingAfter = selectedRusak.sisaRusak - jumlahPenggantian - jumlahTidakDiganti;
      let msg = `Penggantian berhasil! ${jumlahPenggantian} ${selectedRusak.rusakUnit} telah masuk ke stok. Nomor BA: ${assignedNomorBA}`;
      if (jumlahTidakDiganti > 0) msg += ` ${jumlahTidakDiganti} ${selectedRusak.rusakUnit} ditandai tidak diganti. Nomor BA Tidak Diganti: ${assignedNomorBATidak}`;
      if (remainingAfter > 0) msg += ` Sisa ${remainingAfter} ${selectedRusak.rusakUnit} masih menunggu penggantian.`;
      else msg += " Semua barang rusak selesai.";
      setSuccessMessage(msg);
      setPenggantianForm({
        transaksiId: "",
        rusakIndex: 0,
        tanggal: new Date().toISOString().split("T")[0],
        jumlahZAK: "",
        jumlahTidakDiganti: "",
        fotoUrls: [],
        maxJumlah: 0,
        unitRusak: "ZAK",
      });
      fetchStockGudang();
      fetchUnreplacedRusak();
      fetchPenggantianHistory();
      fetchTidakDigantiHistory();
      setTimeout(() => setSuccessMessage(""), 7000);
    } catch (error) {
      console.error(error);
      if (assignedNomorBA) {
        await releaseBANumber(assignedNomorBA);
      }
      if (assignedNomorBATidak) {
        await releaseBANumber(assignedNomorBATidak);
      }
      setErrors((prev) => ({ ...prev, penggantianSubmit: "Gagal menyimpan penggantian. Silakan coba lagi." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditRusak = (record: UnreplacedRusak) => {
    setEditRusakForm({
      transaksiId: record.transaksiId,
      rusakIndex: record.rusakIndex,
      jumlahRusak: String(record.rusakJumlah),
      keterangan: record.rusakKeterangan,
      fotoUrls: record.fotoUrls || [],
      rusakUnit: record.rusakUnit,
      unitMasuk: record.unitMasuk,
      kodeBarang: record.kodeBarang,
      namaBarang: record.namaBarang,
      oldJumlah: record.rusakJumlah,
    });
    setErrors({});
  };

  const handleOpenEditTidakDiganti = (record: TidakDigantiRecord) => {
    const maxPossible = record.rusakJumlah - record.jumlahDiganti;
    setEditTidakDigantiForm({
      transaksiId: record.transaksiId,
      rusakIndex: record.rusakIndex,
      jumlahTidakDiganti: String(record.jumlahTidakDiganti),
      rusakUnit: record.rusakUnit,
      unitMasuk: record.unitMasuk,
      kodeBarang: record.kodeBarang,
      namaBarang: record.namaBarang,
      maxPossible: maxPossible,
      nomorBATidakDiganti: record.nomorBATidakDiganti || "",
    });
    setErrors({});
  };

  const handleUpdateRusak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRusakForm) return;

    setErrors({});
    const newJumlah = parseFloat(editRusakForm.jumlahRusak) || 0;

    if (newJumlah < 0) {
      setErrors({ editRusak: "Jumlah rusak tidak boleh negatif" });
      return;
    }

    setIsSubmitting(true);
    try {
      const transaksiRef = doc(db, "transaksiBarangMasuk", editRusakForm.transaksiId);
      const transaksiSnap = await getDoc(transaksiRef);
      if (!transaksiSnap.exists()) {
        throw new Error("Transaksi tidak ditemukan");
      }
      const tData = transaksiSnap.data();
      const barangRusakArray = tData.barangRusak || [];
      if (!barangRusakArray[editRusakForm.rusakIndex]) {
        throw new Error("Data barang rusak tidak ditemukan");
      }

      const oldJumlah = barangRusakArray[editRusakForm.rusakIndex].jumlah || 0;
      const jumlahDiganti = barangRusakArray[editRusakForm.rusakIndex].jumlahDiganti || 0;
      const jumlahTidakDiganti = barangRusakArray[editRusakForm.rusakIndex].jumlahTidakDiganti || 0;

      if (newJumlah < jumlahDiganti + jumlahTidakDiganti) {
        setErrors({ editRusak: `Jumlah rusak tidak boleh kurang dari sudah diganti (${jumlahDiganti}) + tidak diganti (${jumlahTidakDiganti})` });
        setIsSubmitting(false);
        return;
      }

      const selisih = newJumlah - oldJumlah;
      const newSisa = newJumlah - jumlahDiganti - jumlahTidakDiganti;

      let newStatus = "belum diganti";
      if (newSisa <= 0) newStatus = "selesai";
      else if (jumlahDiganti > 0) newStatus = "sebagian diganti";
      else if (jumlahTidakDiganti > 0) newStatus = "tidak diganti";

      barangRusakArray[editRusakForm.rusakIndex] = {
        ...barangRusakArray[editRusakForm.rusakIndex],
        jumlah: newJumlah,
        keterangan: editRusakForm.keterangan,
        fotoUrls: editRusakForm.fotoUrls,
        sisaRusak: newSisa > 0 ? newSisa : 0,
        status: newStatus,
      };

      await updateDoc(transaksiRef, {
        barangRusak: barangRusakArray,
        updatedAt: serverTimestamp(),
      });

      const stock = stockList.find((s) => s.kodeBarang === editRusakForm.kodeBarang && s.namaBarang === editRusakForm.namaBarang);
      if (stock && selisih !== 0) {
        const stockRef = doc(db, "stockGudang", stock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          const currentStokUnit = sData.stokAkhirUnit || 0;
          const currentStokKG = sData.stokAkhirKG || 0;
          const currentRusakUnit = sData.barangRusakUnit || 0;
          const currentRusakKG = sData.barangRusakKG || 0;
          const currentSisaUnit = sData.sisaRusakUnit || 0;
          const currentSisaKG = sData.sisaRusakKG || 0;

          const unitMasuk = editRusakForm.unitMasuk;
          const absSelisih = Math.abs(selisih);
          let addUnit = selisih > 0 ? absSelisih : -absSelisih;
          let addKG = 0;

          if (unitMasuk === "KG") {
            addUnit = 0;
            addKG = selisih > 0 ? absSelisih : -absSelisih;
          } else if (unitMasuk === "ZAK") {
            addKG = selisih > 0 ? absSelisih * stock.bobotPerUnit : -absSelisih * stock.bobotPerUnit;
          } else if (unitMasuk === "BOTOL") {
            addUnit = selisih > 0 ? absSelisih : -absSelisih;
            addKG = 0;
          } else if (unitMasuk === "DUS") {
            addUnit = selisih > 0 ? absSelisih : -absSelisih;
            addKG = 0;
          }

          await updateDoc(stockRef, {
            stokAkhirUnit: Math.max(0, currentStokUnit - addUnit),
            stokAkhirKG: Math.max(0, currentStokKG - addKG),
            barangRusakUnit: Math.max(0, currentRusakUnit + addUnit),
            barangRusakKG: Math.max(0, currentRusakKG + addKG),
            sisaRusakUnit: Math.max(0, currentSisaUnit + addUnit),
            sisaRusakKG: Math.max(0, currentSisaKG + addKG),
            updatedAt: serverTimestamp(),
          });
        }
      }

      setSuccessMessage(`Berhasil mengupdate jumlah rusak menjadi ${newJumlah} ${editRusakForm.rusakUnit}`);
      setEditRusakForm(null);
      fetchStockGudang();
      fetchUnreplacedRusak();
      fetchPenggantianHistory();
      fetchTidakDigantiHistory();
      setTimeout(() => setSuccessMessage(""), 7000);
    } catch (error) {
      console.error(error);
      setErrors((prev) => ({ ...prev, editRusak: "Gagal mengupdate data. Silakan coba lagi." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTidakDiganti = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTidakDigantiForm) return;

    setErrors({});
    const newJumlah = parseFloat(editTidakDigantiForm.jumlahTidakDiganti) || 0;

    if (newJumlah < 0) {
      setErrors({ editTidakDiganti: "Jumlah tidak boleh negatif" });
      return;
    }
    if (newJumlah > editTidakDigantiForm.maxPossible) {
      setErrors({ editTidakDiganti: `Jumlah tidak diganti tidak boleh melebihi sisa ${editTidakDigantiForm.maxPossible} ${editTidakDigantiForm.rusakUnit}` });
      return;
    }

    setIsSubmitting(true);
    let generatedNomorBATidak = "";
    try {
      const transaksiRef = doc(db, "transaksiBarangMasuk", editTidakDigantiForm.transaksiId);
      const transaksiSnap = await getDoc(transaksiRef);
      if (!transaksiSnap.exists()) {
        throw new Error("Transaksi tidak ditemukan");
      }
      const tData = transaksiSnap.data();
      const barangRusakArray = tData.barangRusak || [];
      if (!barangRusakArray[editTidakDigantiForm.rusakIndex]) {
        throw new Error("Data barang rusak tidak ditemukan");
      }

      const oldJumlahTidakDiganti = barangRusakArray[editTidakDigantiForm.rusakIndex].jumlahTidakDiganti || 0;
      const totalRusak = barangRusakArray[editTidakDigantiForm.rusakIndex].jumlah || 0;
      const jumlahDiganti = barangRusakArray[editTidakDigantiForm.rusakIndex].jumlahDiganti || 0;
      const oldNomorBATidak = barangRusakArray[editTidakDigantiForm.rusakIndex].nomorBATidakDiganti || "";
      const selisih = newJumlah - oldJumlahTidakDiganti;
      const newSisa = totalRusak - jumlahDiganti - newJumlah;

      let newNomorBATidak = oldNomorBATidak;
      if (oldJumlahTidakDiganti === 0 && newJumlah > 0 && !oldNomorBATidak) {
        generatedNomorBATidak = await getUniqueBANumber("u");
        newNomorBATidak = generatedNomorBATidak;
      } else if (oldJumlahTidakDiganti > 0 && newJumlah === 0 && oldNomorBATidak) {
        await releaseBANumber(oldNomorBATidak);
        newNomorBATidak = "";
      }

      let newStatus = "belum diganti";
      if (newSisa <= 0) newStatus = "selesai";
      else if (jumlahDiganti > 0) newStatus = "sebagian diganti";
      else if (newJumlah > 0) newStatus = "tidak diganti";

      barangRusakArray[editTidakDigantiForm.rusakIndex] = {
        ...barangRusakArray[editTidakDigantiForm.rusakIndex],
        jumlahTidakDiganti: newJumlah,
        sisaRusak: newSisa > 0 ? newSisa : 0,
        status: newStatus,
        nomorBATidakDiganti: newNomorBATidak,
      };

      await updateDoc(transaksiRef, {
        barangRusak: barangRusakArray,
        updatedAt: serverTimestamp(),
      });

      const stock = stockList.find((s) => s.kodeBarang === editTidakDigantiForm.kodeBarang && s.namaBarang === editTidakDigantiForm.namaBarang);
      if (stock && selisih !== 0) {
        const stockRef = doc(db, "stockGudang", stock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          const currentSisaRusakUnit = sData.sisaRusakUnit || 0;
          const currentSisaRusakKG = sData.sisaRusakKG || 0;

          const selisihCalc = calculateAddUnitKG(Math.abs(selisih), editTidakDigantiForm.unitMasuk, stock);

          if (selisih > 0) {
            await updateDoc(stockRef, {
              sisaRusakUnit: Math.max(0, currentSisaRusakUnit - selisihCalc.addUnit),
              sisaRusakKG: Math.max(0, currentSisaRusakKG - selisihCalc.addKG),
              updatedAt: serverTimestamp(),
            });
          } else {
            await updateDoc(stockRef, {
              sisaRusakUnit: currentSisaRusakUnit + selisihCalc.addUnit,
              sisaRusakKG: currentSisaRusakKG + selisihCalc.addKG,
              updatedAt: serverTimestamp(),
            });
          }
        }
      }

      setSuccessMessage(`Berhasil mengupdate jumlah tidak diganti menjadi ${newJumlah} ${editTidakDigantiForm.rusakUnit}`);
      setEditTidakDigantiForm(null);
      fetchStockGudang();
      fetchUnreplacedRusak();
      fetchPenggantianHistory();
      fetchTidakDigantiHistory();
      setTimeout(() => setSuccessMessage(""), 7000);
    } catch (error) {
      console.error(error);
      if (generatedNomorBATidak) {
        await releaseBANumber(generatedNomorBATidak);
      }
      setErrors((prev) => ({ ...prev, editTidakDiganti: "Gagal mengupdate data. Silakan coba lagi." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintBAPengganti = (record: PenggantianRecord) => {
    setSelectedPenggantian(record);
    setIsPrintModalOpen(true);
    setTimeout(() => {
      const printContent = document.getElementById("print-ba-pengganti");
      if (printContent) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Berita Acara Penggantian Barang Rusak ${record.nomorBA}</title>
              <style>
                @page { size: A4; margin: 12mm; }
                @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #000; }
                .page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; display: flex; flex-direction: column; }
                .header-img { width: 100%; display: block; margin-bottom: 0; }
                .title-bar { text-align: center; background: #15803d; color: white; padding: 8px 0; margin: 8px 0 14px 0; font-weight: bold; font-size: 14px; letter-spacing: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; font-size: 10px; }
                .info-item { display: flex; gap: 4px; }
                .info-label { font-weight: 600; white-space: nowrap; }
                .info-box { border: 1px solid #000; padding: 10px; margin-bottom: 14px; }
                .info-box-title { font-size: 10px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; }
                .table-title { text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 5px 0; font-size: 11px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .data-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
                .data-table th { background: #f0fdf4; font-size: 10px; padding: 6px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .data-table td { border: 1px solid #000; padding: 6px; vertical-align: top; }
                .notes-box { border: 1px solid #000; padding: 10px; margin-bottom: 14px; font-size: 10px; }
                .notes-box p { margin-bottom: 4px; }
                .signature-row { display: flex; justify-content: space-between; margin-top: auto; padding-top: 24px; align-items: flex-end; }
                .signature-box { width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
                .signature-title { font-size: 10px; margin-bottom: 4px; min-height: 32px; line-height: 1.4; }
                .signature-img { max-height: 60px; width: auto; object-fit: contain; margin: 0 auto 4px auto; display: block; }
                .signature-name { font-size: 11px; font-weight: 700; margin-top: 0; border-top: 1px solid #000; padding-top: 4px; display: block; width: 90%; margin-left: auto; margin-right: auto; }
                .footer-img { width: 100%; display: block; margin-top: auto; padding-top: 10px; }
                .print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
                .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
                @media print { .print-bar { display: none !important; } }
                .foto-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px; }
                .foto-grid img { width: 100%; height: 200px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; }
                .foto-label { font-size: 9px; font-weight: 600; color: #333; margin-bottom: 4px; }
                .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; }
                .badge-green { background: #dcfce7; color: #15803d; }
                .badge-red { background: #fee2e2; color: #b91c1c; }
                .badge-amber { background: #fef3c7; color: #92400e; }
              </style>
            </head>
            <body>
              <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
              <div class="page">
                <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display=\\'none\\'" />
                <div class="title-bar">BERITA ACARA PENGGANTIAN BARANG RUSAK</div>
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">Nomor BA:</span> <span class="font-mono font-bold">${record.nomorBA}</span></div>
                  <div class="info-item"><span class="info-label">Tanggal:</span> <span>${new Date(record.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
                  <div class="info-item"><span class="info-label">Referensi BA Rusak:</span> <span class="font-mono">${record.referensiNomorBA || "-"}</span></div>
                  <div class="info-item"><span class="info-label">FOT:</span> <span>${record.fot || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Kode Barang:</span> <span class="font-mono">${record.kodeBarang || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Nama Barang:</span> <span>${record.namaBarang || "-"}</span></div>
                </div>
                <div class="info-box">
                  <div class="info-box-title">Ringkasan Penggantian</div>
                  <div class="info-grid">
                    <div class="info-item"><span class="info-label">Jumlah Diganti:</span> <span class="font-bold">${record.jumlahZAK.toLocaleString("id-ID")} ${record.unit}</span></div>
                    <div class="info-item"><span class="info-label">Total KG:</span> <span class="font-bold">${record.totalKG.toLocaleString("id-ID")} KG</span></div>
                    <div class="info-item"><span class="info-label">Tidak Diganti:</span> <span class="font-bold">${record.jumlahTidakDiganti.toLocaleString("id-ID")} ${record.unit}</span></div>
                    <div class="info-item"><span class="info-label">Sisa Setelah:</span> <span class="font-bold ${record.sisaSetelah > 0 ? 'text-red-600' : 'text-green-600'}">${record.sisaSetelah.toLocaleString("id-ID")} ${record.unit}</span></div>
                  </div>
                </div>
                <div class="table-title">STATUS PENGGANTIAN</div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 40px;">NO</th>
                      <th style="width: 120px;">ITEM</th>
                      <th style="width: 100px;">JUMLAH</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="text-align: center;">1</td>
                      <td style="text-align: center;">Barang Diganti</td>
                      <td style="text-align: center; font-weight: 700;">${record.jumlahZAK.toLocaleString("id-ID")} ${record.unit}</td>
                      <td style="text-align: center;"><span class="badge badge-green">SUDAH DIGANTI</span></td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">2</td>
                      <td style="text-align: center;">Tidak Diganti</td>
                      <td style="text-align: center; font-weight: 700;">${record.jumlahTidakDiganti.toLocaleString("id-ID")} ${record.unit}</td>
                      <td style="text-align: center;"><span class="badge badge-amber">TIDAK DIGANTI</span></td>
                    </tr>
                    ${record.sisaSetelah > 0 ? `
                    <tr>
                      <td style="text-align: center;">3</td>
                      <td style="text-align: center;">Sisa Rusak</td>
                      <td style="text-align: center; font-weight: 700;">${record.sisaSetelah.toLocaleString("id-ID")} ${record.unit}</td>
                      <td style="text-align: center;"><span class="badge badge-red">BELUM SELESAI</span></td>
                    </tr>
                    ` : ""}
                  </tbody>
                </table>
                ${record.fotoUrls && record.fotoUrls.length > 0 ? `
                <div class="table-title">DOKUMENTASI FOTO</div>
                <div class="foto-grid">
                  ${record.fotoUrls.map((f, i) => `<div><div class="foto-label">Foto ${i + 1}</div><img src="${f}" alt="Foto ${i + 1}" /></div>`).join("")}
                </div>
                ` : ""}
                <div class="notes-box">
                  <p style="font-weight: 700; margin-bottom: 6px;">Keterangan:</p>
                  <p>Berita acara ini merupakan dokumen penggantian barang rusak yang telah diproses sesuai prosedur perusahaan.</p>
                  <p>Barang pengganti telah dimasukkan ke dalam stok gudang pada tanggal ${new Date(record.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}.</p>
                  <p style="margin-top: 8px; font-weight: 700;">Dibuat oleh: ${record.createdBy || "-"}</p>
                </div>
                <div class="signature-row">
                  <div class="signature-box">
                    <p class="signature-title">Diverifikasi oleh,<br>PT. BUKIT AGROCHEMICAL BARU</p>
                    <div style="min-height: 60px; margin-bottom: 4px;"></div>
                    <p class="signature-name">_________________</p>
                    <p style="font-size: 9px; color: #333; margin-top: 3px;">Manager Gudang</p>
                  </div>
                  <div class="signature-box">
                    <p class="signature-title">Diserahkan oleh,<br>Petugas Gudang</p>
                    <div style="min-height: 60px; margin-bottom: 4px;"></div>
                    <p class="signature-name">${record.createdBy || "_________________"}</p>
                  </div>
                </div>
                <img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display=\\'none\\'" />
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    }, 100);
  };

  const handlePrintBATidakDiganti = (record: TidakDigantiRecord) => {
    setSelectedTidakDiganti(record);
    setIsPrintTidakDigantiOpen(true);
    setTimeout(() => {
      const printContent = document.getElementById("print-ba-tidak-diganti");
      if (printContent) {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Berita Acara Barang Rusak Tidak Dapat Diganti ${record.nomorBATidakDiganti}</title>
              <style>
                @page { size: A4; margin: 12mm; }
                @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: Arial, sans-serif; font-size: 11px; line-height: 1.5; color: #000; }
                .page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; display: flex; flex-direction: column; }
                .header-img { width: 100%; display: block; margin-bottom: 0; }
                .title-bar { text-align: center; background: #b91c1c; color: white; padding: 8px 0; margin: 8px 0 14px 0; font-weight: bold; font-size: 14px; letter-spacing: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; font-size: 10px; }
                .info-item { display: flex; gap: 4px; }
                .info-label { font-weight: 600; white-space: nowrap; }
                .info-box { border: 1px solid #000; padding: 10px; margin-bottom: 14px; }
                .info-box-title { font-size: 10px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase; border-bottom: 1px solid #000; padding-bottom: 4px; }
                .table-title { text-align: center; background: #fee2e2; border: 1px solid #000; border-bottom: none; padding: 5px 0; font-size: 11px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .data-table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
                .data-table th { background: #fef2f2; font-size: 10px; padding: 6px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                .data-table td { border: 1px solid #000; padding: 6px; vertical-align: top; }
                .notes-box { border: 1px solid #000; padding: 10px; margin-bottom: 14px; font-size: 10px; }
                .notes-box p { margin-bottom: 4px; }
                .signature-row { display: flex; justify-content: space-between; margin-top: auto; padding-top: 24px; align-items: flex-end; }
                .signature-box { width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
                .signature-title { font-size: 10px; margin-bottom: 4px; min-height: 32px; line-height: 1.4; }
                .signature-img { max-height: 60px; width: auto; object-fit: contain; margin: 0 auto 4px auto; display: block; }
                .signature-name { font-size: 11px; font-weight: 700; margin-top: 0; border-top: 1px solid #000; padding-top: 4px; display: block; width: 90%; margin-left: auto; margin-right: auto; }
                .footer-img { width: 100%; display: block; margin-top: auto; padding-top: 10px; }
                .print-btn { background: #b91c1c; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
                .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
                @media print { .print-bar { display: none !important; } }
                .foto-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px; }
                .foto-grid img { width: 100%; height: 200px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; }
                .foto-label { font-size: 9px; font-weight: 600; color: #333; margin-bottom: 4px; }
                .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 9px; font-weight: 700; }
                .badge-red { background: #fee2e2; color: #b91c1c; }
                .badge-amber { background: #fef3c7; color: #92400e; }
              </style>
            </head>
            <body>
              <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
              <div class="page">
                <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display=\\'none\\'" />
                <div class="title-bar">BERITA ACARA BARANG RUSAK TIDAK DAPAT DIGANTI</div>
                <div class="info-grid">
                  <div class="info-item"><span class="info-label">Nomor BA:</span> <span class="font-mono font-bold">${record.nomorBATidakDiganti}</span></div>
                  <div class="info-item"><span class="info-label">Tanggal:</span> <span>${new Date(record.tanggalTransaksi).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
                  <div class="info-item"><span class="info-label">Referensi BA Rusak:</span> <span class="font-mono">${record.nomorBA || "-"}</span></div>
                  <div class="info-item"><span class="info-label">FOT:</span> <span>${record.fot || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Kode Barang:</span> <span class="font-mono">${record.kodeBarang || "-"}</span></div>
                  <div class="info-item"><span class="info-label">Nama Barang:</span> <span>${record.namaBarang || "-"}</span></div>
                </div>
                <div class="info-box">
                  <div class="info-box-title">Ringkasan Barang Tidak Diganti</div>
                  <div class="info-grid">
                    <div class="info-item"><span class="info-label">Total Rusak:</span> <span class="font-bold">${record.rusakJumlah.toLocaleString("id-ID")} ${record.rusakUnit}</span></div>
                    <div class="info-item"><span class="info-label">Sudah Diganti:</span> <span class="font-bold">${record.jumlahDiganti.toLocaleString("id-ID")} ${record.rusakUnit}</span></div>
                    <div class="info-item"><span class="info-label">Tidak Diganti:</span> <span class="font-bold text-red-600">${record.jumlahTidakDiganti.toLocaleString("id-ID")} ${record.rusakUnit}</span></div>
                    <div class="info-item"><span class="info-label">Sisa Rusak:</span> <span class="font-bold">${record.sisaRusak.toLocaleString("id-ID")} ${record.rusakUnit}</span></div>
                  </div>
                </div>
                <div class="table-title">RINCIAN BARANG TIDAK DIGANTI</div>
                <table class="data-table">
                  <thead>
                    <tr>
                      <th style="width: 40px;">NO</th>
                      <th style="width: 120px;">ITEM</th>
                      <th style="width: 100px;">JUMLAH</th>
                      <th>STATUS</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="text-align: center;">1</td>
                      <td style="text-align: center;">Barang Rusak</td>
                      <td style="text-align: center; font-weight: 700;">${record.rusakJumlah.toLocaleString("id-ID")} ${record.rusakUnit}</td>
                      <td style="text-align: center;"><span class="badge badge-red">RUSAK</span></td>
                    </tr>
                    <tr>
                      <td style="text-align: center;">2</td>
                      <td style="text-align: center;">Tidak Dapat Diganti</td>
                      <td style="text-align: center; font-weight: 700;">${record.jumlahTidakDiganti.toLocaleString("id-ID")} ${record.rusakUnit}</td>
                      <td style="text-align: center;"><span class="badge badge-amber">TIDAK DIGANTI</span></td>
                    </tr>
                  </tbody>
                </table>
                ${record.fotoUrls && record.fotoUrls.length > 0 ? `
                <div class="table-title">DOKUMENTASI FOTO</div>
                <div class="foto-grid">
                  ${record.fotoUrls.map((f, i) => `<div><div class="foto-label">Foto ${i + 1}</div><img src="${f}" alt="Foto ${i + 1}" /></div>`).join("")}
                </div>
                ` : ""}
                <div class="notes-box">
                  <p style="font-weight: 700; margin-bottom: 6px;">Keterangan:</p>
                  <p>Berita acara ini merupakan dokumen barang rusak yang tidak dapat diganti sesuai prosedur perusahaan.</p>
                  <p>Barang rusak yang tidak diganti telah dicatat dan tidak akan diproses penggantian.</p>
                  <p style="margin-top: 8px; font-weight: 700;">Dibuat oleh: ${user?.nama || "-"}</p>
                </div>
                <div class="signature-row">
                  <div class="signature-box">
                    <p class="signature-title">Diverifikasi oleh,<br>PT. BUKIT AGROCHEMICAL BARU</p>
                    <div style="min-height: 60px; margin-bottom: 4px;"></div>
                    <p class="signature-name">_________________</p>
                    <p style="font-size: 9px; color: #333; margin-top: 3px;">Manager Gudang</p>
                  </div>
                  <div class="signature-box">
                    <p class="signature-title">Diserahkan oleh,<br>Petugas Gudang</p>
                    <div style="min-height: 60px; margin-bottom: 4px;"></div>
                    <p class="signature-name">${user?.nama || "_________________"}</p>
                  </div>
                </div>
                <img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display=\\'none\\'" />
              </div>
            </body>
            </html>
          `);
          printWindow.document.close();
        }
      }
    }, 100);
  };

  const unreplacedOptions = [
    { value: "", label: "Pilih barang rusak yang akan diganti..." },
    ...unreplacedRusakList.map((r) => ({
      value: `${r.transaksiId}_${r.rusakIndex}`,
      label: `${r.namaBarang} | BA: ${r.nomorBA || "-"} | Total: ${r.rusakJumlah} ${r.rusakUnit} | Sudah: ${r.sudahDiganti} ${r.rusakUnit} | Sisa: ${r.sisaRusak} ${r.rusakUnit} | ${r.rusakKeterangan} | ${r.tanggalTransaksi}`,
    })),
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Header title="Pengganti Barang Rusak" subtitle="Input penggantian barang rusak / cacat" />

      {successMessage && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-blue-700">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errors.penggantianSubmit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{errors.penggantianSubmit}</span>
        </div>
      )}

      {errors.editTidakDiganti && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{errors.editTidakDiganti}</span>
        </div>
      )}

      <Card title={`Barang Rusak Belum Diganti (${unreplacedRusakList.length})`}>
        {unreplacedRusakList.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada barang rusak yang menunggu penggantian</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-red-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Nomor BA</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Nama Barang</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Kode</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Total Rusak</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Sudah Diganti</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Tidak Diganti</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Sisa</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Keterangan</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Tanggal</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {unreplacedRusakList.map((r, idx) => (
                  <tr key={`${r.transaksiId}_${r.rusakIndex}`} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900 border">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-mono font-bold text-amber-700 border">{r.nomorBA || "-"}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-900 border">{r.namaBarang}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-600 border">{r.kodeBarang}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono border">{r.rusakJumlah.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-green-700 text-right font-mono border font-semibold">{r.sudahDiganti.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 text-right font-mono border">{r.jumlahTidakDiganti.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-red-700 text-right font-mono border font-bold">{r.sisaRusak.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 border">{r.rusakKeterangan}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 border">{r.tanggalTransaksi}</td>
                    <td className="px-3 py-2 text-sm border">
                      <button
                        onClick={() => handleOpenEditRusak(r)}
                        className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-bold hover:bg-blue-700 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Form Penggantian Barang Rusak">
        <form onSubmit={handleSubmitPenggantian} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Pilih Barang Rusak"
              value={penggantianForm.transaksiId ? `${penggantianForm.transaksiId}_${penggantianForm.rusakIndex}` : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const [tid, ridx] = val.split("_");
                  const selected = unreplacedRusakList.find((r) => r.transaksiId === tid && r.rusakIndex === parseInt(ridx));
                  setPenggantianForm((prev) => ({
                    ...prev,
                    transaksiId: tid,
                    rusakIndex: parseInt(ridx) || 0,
                    jumlahZAK: selected ? String(selected.sisaRusak) : "",
                    jumlahTidakDiganti: "",
                    maxJumlah: selected ? selected.sisaRusak : 0,
                    unitRusak: selected ? selected.rusakUnit : "ZAK",
                  }));
                  setErrors((prev) => { const n = { ...prev }; delete n.penggantianJumlah; delete n.penggantian; return n; });
                } else {
                  setPenggantianForm((prev) => ({ ...prev, transaksiId: "", rusakIndex: 0, jumlahZAK: "", maxJumlah: 0, unitRusak: "ZAK" }));
                }
              }}
              options={unreplacedOptions}
              required
            />
            {penggantianForm.maxJumlah > 0 && (
              <p className="text-xs text-amber-700 font-semibold pt-6">
                Sisa yang bisa diganti: {penggantianForm.maxJumlah} {penggantianForm.unitRusak}
              </p>
            )}
            <Input
              label="Tanggal Penggantian"
              type="date"
              value={penggantianForm.tanggal}
              onChange={(e) => setPenggantianForm((prev) => ({ ...prev, tanggal: e.target.value }))}
              required
            />
            <Input
              label={`Jumlah Diganti (max: ${penggantianForm.maxJumlah} ${penggantianForm.unitRusak})`}
              type="number"
              value={penggantianForm.jumlahZAK}
              onChange={(e) => {
                const val = e.target.value;
                const num = parseFloat(val) || 0;
                const tidakNum = parseFloat(penggantianForm.jumlahTidakDiganti) || 0;
                if (penggantianForm.maxJumlah > 0 && num > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianJumlah: `Jumlah diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah} ${penggantianForm.unitRusak}` }));
                } else if (penggantianForm.maxJumlah > 0 && num + tidakNum > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianTotal: `Total diganti + tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
                } else {
                  setErrors((prev) => { const n = { ...prev }; delete n.penggantianJumlah; delete n.penggantianTotal; return n; });
                }
                setPenggantianForm((prev) => ({ ...prev, jumlahZAK: val }));
              }}
              placeholder={`Maksimal ${penggantianForm.maxJumlah} ${penggantianForm.unitRusak}`}
              error={errors.penggantianJumlah || errors.penggantianTotal}
              required
            />
            <Input
              label={`Jumlah Tidak Diganti`}
              type="number"
              value={penggantianForm.jumlahTidakDiganti}
              onChange={(e) => {
                const val = e.target.value;
                const num = parseFloat(val) || 0;
                const digantiNum = parseFloat(penggantianForm.jumlahZAK) || 0;
                if (penggantianForm.maxJumlah > 0 && num > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianTidakDiganti: `Jumlah tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
                } else if (penggantianForm.maxJumlah > 0 && num + digantiNum > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianTotal: `Total diganti + tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
                } else {
                  setErrors((prev) => { const n = { ...prev }; delete n.penggantianTidakDiganti; delete n.penggantianTotal; return n; });
                }
                setPenggantianForm((prev) => ({ ...prev, jumlahTidakDiganti: val }));
              }}
              placeholder="0"
              error={errors.penggantianTidakDiganti || errors.penggantianTotal}
            />
          </div>

          <div className="space-y-2">
            <label className="relative cursor-pointer inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tambah Foto Penggantian (Max 3)
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePenggantianFotoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={fotoLoading || penggantianForm.fotoUrls.length >= 3}
              />
            </label>
            {errors.foto && <p className="text-sm text-red-600">{errors.foto}</p>}
            {fotoLoading && (
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Memproses...
              </span>
            )}
            {penggantianForm.fotoUrls.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {penggantianForm.fotoUrls.map((foto, idx) => (
                  <div key={idx} className="relative group">
                    <img src={foto} alt={`Penggantian ${idx + 1}`} className="w-full h-20 object-cover rounded border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removePenggantianFoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.penggantian && <p className="text-sm text-red-600">{errors.penggantian}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setPenggantianForm({
                transaksiId: "",
                rusakIndex: 0,
                tanggal: new Date().toISOString().split("T")[0],
                jumlahZAK: "",
                jumlahTidakDiganti: "",
                fotoUrls: [],
                maxJumlah: 0,
                unitRusak: "ZAK",
              });
              setErrors({});
            }}>
              Reset
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Simpan Penggantian
            </Button>
          </div>
        </form>
      </Card>

      <Card title={`Riwayat Barang Tidak Diganti (${tidakDigantiHistory.length})`}>
        {tidakDigantiHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada barang yang ditandai tidak diganti</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-amber-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">Nomor BA U</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">Nomor BA Rusak</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">Tanggal</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">Nama Barang</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">Kode</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-amber-800 uppercase border">Total Rusak</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-amber-800 uppercase border">Sudah Diganti</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-amber-800 uppercase border">Tidak Diganti</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-amber-800 uppercase border">Sisa</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-amber-800 uppercase border">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tidakDigantiHistory.map((r, idx) => (
                  <tr key={`${r.transaksiId}_${r.rusakIndex}`} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900 border">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-mono font-bold text-red-700 border">{r.nomorBATidakDiganti || "-"}</td>
                    <td className="px-3 py-2 text-sm font-mono font-bold text-amber-700 border">{r.nomorBA || "-"}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 border">{r.tanggalTransaksi}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-900 border">{r.namaBarang}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-600 border">{r.kodeBarang}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono border">{r.rusakJumlah.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-green-700 text-right font-mono border font-semibold">{r.jumlahDiganti.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-red-700 text-right font-mono border font-bold">{r.jumlahTidakDiganti.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 text-right font-mono border">{r.sisaRusak.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm border">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        r.status === "selesai" ? "bg-green-100 text-green-700" :
                        r.status === "sebagian diganti" ? "bg-blue-100 text-blue-700" :
                        r.status === "tidak diganti" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm border">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleOpenEditTidakDiganti(r)}
                          className="px-2 py-1 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700 transition-colors"
                        >
                          Edit
                        </button>
                        {r.nomorBATidakDiganti && (
                          <button
                            onClick={() => handlePrintBATidakDiganti(r)}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700 transition-colors"
                          >
                            Print BA
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editRusakForm && (
        <Card title="Edit Barang Rusak">
          <form onSubmit={handleUpdateRusak} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Barang</p>
                <p className="text-sm font-semibold">{editRusakForm.namaBarang} ({editRusakForm.kodeBarang})</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Satuan</p>
                <p className="text-sm font-semibold">{editRusakForm.rusakUnit}</p>
              </div>
              <Input
                label={`Jumlah Rusak (${editRusakForm.rusakUnit})`}
                type="number"
                value={editRusakForm.jumlahRusak}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseFloat(val) || 0;
                  if (num < 0) {
                    setErrors((prev) => ({ ...prev, editRusak: "Jumlah tidak boleh negatif" }));
                  } else {
                    setErrors((prev) => { const n = { ...prev }; delete n.editRusak; return n; });
                  }
                  setEditRusakForm((prev) => prev ? { ...prev, jumlahRusak: val } : null);
                }}
                placeholder="Jumlah rusak"
                error={errors.editRusak}
                required
              />
              <Input
                label="Keterangan"
                type="text"
                value={editRusakForm.keterangan}
                onChange={(e) => setEditRusakForm((prev) => prev ? { ...prev, keterangan: e.target.value } : null)}
                placeholder="Keterangan kerusakan"
              />
            </div>
            <div className="space-y-2">
              <label className="relative cursor-pointer inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Tambah Foto (Max 3)
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleRusakFotoUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={fotoLoading || (editRusakForm?.fotoUrls.length || 0) >= 3}
                />
              </label>
              {errors.foto && <p className="text-sm text-red-600">{errors.foto}</p>}
              {fotoLoading && (
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Memproses...
                </span>
              )}
              {editRusakForm.fotoUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {editRusakForm.fotoUrls.map((foto, idx) => (
                    <div key={idx} className="relative group">
                      <img src={foto} alt={`Rusak ${idx + 1}`} className="w-full h-20 object-cover rounded border border-gray-200" />
                      <button
                        type="button"
                        onClick={() => removeRusakFoto(idx)}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditRusakForm(null)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Card>
      )}

      {editTidakDigantiForm && (
        <Card title="Edit Jumlah Tidak Diganti">
          <form onSubmit={handleUpdateTidakDiganti} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Barang</p>
                <p className="text-sm font-semibold">{editTidakDigantiForm.namaBarang} ({editTidakDigantiForm.kodeBarang})</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Maksimal Tidak Diganti</p>
                <p className="text-sm font-semibold">{editTidakDigantiForm.maxPossible} {editTidakDigantiForm.rusakUnit}</p>
              </div>
              <Input
                label={`Jumlah Tidak Diganti (${editTidakDigantiForm.rusakUnit})`}
                type="number"
                value={editTidakDigantiForm.jumlahTidakDiganti}
                onChange={(e) => {
                  const val = e.target.value;
                  const num = parseFloat(val) || 0;
                  if (num > editTidakDigantiForm.maxPossible) {
                    setErrors((prev) => ({ ...prev, editTidakDiganti: `Tidak boleh melebihi ${editTidakDigantiForm.maxPossible} ${editTidakDigantiForm.rusakUnit}` }));
                  } else if (num < 0) {
                    setErrors((prev) => ({ ...prev, editTidakDiganti: "Jumlah tidak boleh negatif" }));
                  } else {
                    setErrors((prev) => { const n = { ...prev }; delete n.editTidakDiganti; return n; });
                  }
                  setEditTidakDigantiForm((prev) => prev ? { ...prev, jumlahTidakDiganti: val } : null);
                }}
                placeholder={`0 - ${editTidakDigantiForm.maxPossible}`}
                error={errors.editTidakDiganti}
                required
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditTidakDigantiForm(null)}>
                Batal
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
                Simpan Perubahan
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title={`Riwayat Penggantian (${penggantianHistory.length})`}>
        {penggantianHistory.length === 0 ? (
          <p className="text-sm text-gray-500">Belum ada riwayat penggantian</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-green-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase border">No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase border">Nomor BA</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase border">Tanggal</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase border">Nama Barang</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase border">Kode</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-green-800 uppercase border">Jumlah</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-green-800 uppercase border">Tidak Diganti</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-green-800 uppercase border">Sisa</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase border">Foto</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase border">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {penggantianHistory.map((p, idx) => (
                  <tr key={p.id} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900 border">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-mono font-bold text-amber-700 border">{p.nomorBA}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 border">{p.tanggal}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-900 border">{p.namaBarang}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-600 border">{p.kodeBarang}</td>
                    <td className="px-3 py-2 text-sm text-green-700 text-right font-mono border font-semibold">{p.jumlahZAK.toLocaleString("id-ID")} {p.unit}</td>
                    <td className="px-3 py-2 text-sm text-amber-700 text-right font-mono border">{p.jumlahTidakDiganti.toLocaleString("id-ID")} {p.unit}</td>
                    <td className="px-3 py-2 text-sm text-red-700 text-right font-mono border font-bold">{p.sisaSetelah.toLocaleString("id-ID")} {p.unit}</td>
                    <td className="px-3 py-2 text-sm border">
                      {p.fotoUrls && p.fotoUrls.length > 0 ? (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">{p.fotoUrls.length} Foto</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm border">
                      <button
                        onClick={() => handlePrintBAPengganti(p)}
                        className="px-2 py-1 bg-green-600 text-white rounded text-xs font-bold hover:bg-green-700 transition-colors"
                      >
                        Print BA
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div id="print-ba-pengganti" style={{ display: "none" }} />
      <div id="print-ba-tidak-diganti" style={{ display: "none" }} />
    </div>
  );
}