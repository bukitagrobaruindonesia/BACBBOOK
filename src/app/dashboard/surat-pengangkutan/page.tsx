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
  setDoc,
  where,
  getDoc,
  deleteDoc,
  runTransaction,
  Timestamp,
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
  sisaPengambilanKG?: number;
  statusPengangkutan?: string;
}

interface StockItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  fot: string;
  bobotPerUnit: number;
  botolPerDus: number;
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
  nomorPI: string;
  namaCustomer: string;
  doPartyKG: number;
  doLoadedKG: number;
  piKuantitas: number;
  piLoadedKG: number;
  doId?: string;
  piId?: string;
}

interface ExistingSurat {
  id: string;
  nomorSeri: string;
}

interface FOTData {
  id: string;
  namaFOT: string;
  alamatFOT: string;
}

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
  loadedKG?: number;
  createdBy: string;
  createdAt: any;
}

interface SuratDOItem {
  nomorSubDO: string;
  nomorPO: string;
  jenisPupuk: string;
  pengambilanZAK: number;
  bobotPerUnit: number;
}

interface SuratDODoc {
  id: string;
  items: SuratDOItem[];
}

interface DODoc {
  loadedKG?: number;
  partyKG?: number;
}

interface PIDoc {
  produkItems?: Array<{ kuantitas?: number }>;
  sisaPengambilanKG?: number;
  statusPengangkutan?: string;
}

interface StockDoc {
  stokAkhirUnit?: number;
  stokAkhirKG?: number;
  barangKeluarUnit?: number;
  barangKeluarKG?: number;
  unit?: string;
}

const getRomanMonth = (month: number) => {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[month - 1] || "I";
};

const isGudangIndukFOT = (fot: string) => {
  return fot.trim().toUpperCase().includes("GUDANG INDUK");
};

const formatParty = (kg: number) => {
  if (kg >= 1000) {
    const mt = kg / 1000;
    return mt % 1 === 0 ? `${mt.toFixed(0)} MT` : `${mt.toFixed(2)} MT`;
  }
  return `${kg.toLocaleString()} KG`;
};

const formatSisaKG = (kg: number) => {
  return `${kg.toLocaleString()} KG`;
};

const sanitizeLockDocId = (nomorSeri: string) => {
  return nomorSeri.replace(/\//g, "-");
};

const getUniqueSeriSP = async (year: number, roman: string): Promise<string> => {
  const prefix = `BAGB-SP/${year}/${roman}`;
  const poolRef = doc(db, "counters", `suratPengangkutanSP_${year}_${roman}`);
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const poolSnap = await transaction.get(poolRef);
        let lastNumber = 0;
        let gaps: number[] = [];
        if (poolSnap.exists()) {
          lastNumber = poolSnap.data().lastNumber || 0;
          gaps = poolSnap.data().gaps || [];
        }
        let candidateNum: number;
        if (gaps.length > 0) {
          gaps.sort((a, b) => a - b);
          candidateNum = gaps[0];
          gaps = gaps.filter((g) => g !== candidateNum);
        } else {
          candidateNum = lastNumber + 1;
          lastNumber = candidateNum;
        }
        const candidateSeri = `${prefix}/${String(candidateNum).padStart(4, "0")}`;
        const lockRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(candidateSeri));
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists()) {
          let searchNum = candidateNum + 1;
          let found = false;
          while (searchNum <= lastNumber + 1000 && !found) {
            const testSeri = `${prefix}/${String(searchNum).padStart(4, "0")}`;
            const testRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(testSeri));
            const testDoc = await transaction.get(testRef);
            if (!testDoc.exists()) {
              if (gaps.includes(searchNum)) {
                gaps = gaps.filter((g) => g !== searchNum);
              } else if (searchNum > lastNumber) {
                lastNumber = searchNum;
              }
              candidateNum = searchNum;
              found = true;
            }
            searchNum++;
          }
          if (!found) throw new Error("No available SP number found");
        }
        transaction.set(lockRef, { createdAt: serverTimestamp(), used: true });
        transaction.set(poolRef, { lastNumber, gaps, updatedAt: Timestamp.now() });
        return candidateSeri;
      });
      return result;
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw new Error("Failed to generate unique SP number after retries");
};

const getUniqueSeriDODikuasakan = async (year: number, roman: string): Promise<string> => {
  const prefix = `BAGB-SP-DO/${year}/${roman}`;
  const poolRef = doc(db, "counters", `suratPengangkutanDO_Dikuasakan_${year}_${roman}`);
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const poolSnap = await transaction.get(poolRef);
        let lastNumber = 0;
        let gaps: number[] = [];
        if (poolSnap.exists()) {
          lastNumber = poolSnap.data().lastNumber || 0;
          gaps = poolSnap.data().gaps || [];
        }
        let candidateNum: number;
        if (gaps.length > 0) {
          gaps.sort((a, b) => a - b);
          candidateNum = gaps[0];
          gaps = gaps.filter((g) => g !== candidateNum);
        } else {
          candidateNum = lastNumber + 1;
          lastNumber = candidateNum;
        }
        const candidateSeri = `${prefix}/${String(candidateNum).padStart(4, "0")}`;
        const lockRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(candidateSeri));
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists()) {
          let searchNum = candidateNum + 1;
          let found = false;
          while (searchNum <= lastNumber + 1000 && !found) {
            const testSeri = `${prefix}/${String(searchNum).padStart(4, "0")}`;
            const testRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(testSeri));
            const testDoc = await transaction.get(testRef);
            if (!testDoc.exists()) {
              if (gaps.includes(searchNum)) {
                gaps = gaps.filter((g) => g !== searchNum);
              } else if (searchNum > lastNumber) {
                lastNumber = searchNum;
              }
              candidateNum = searchNum;
              found = true;
            }
            searchNum++;
          }
          if (!found) throw new Error("No available DO Dikuasakan number found");
        }
        transaction.set(lockRef, { createdAt: serverTimestamp(), used: true });
        transaction.set(poolRef, { lastNumber, gaps, updatedAt: Timestamp.now() });
        return candidateSeri;
      });
      return result;
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw new Error("Failed to generate unique DO Dikuasakan number after retries");
};

const getUniqueSeriDOMandiri = async (perusahaan: string, nomorSubDO: string): Promise<string> => {
  const prefix = `BAGB-DO-${nomorSubDO}-${perusahaan}-SP`;
  const poolRef = doc(db, "counters", `suratPengangkutanDO_Mandiri_${perusahaan}_${nomorSubDO}`);
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await runTransaction(db, async (transaction) => {
        const poolSnap = await transaction.get(poolRef);
        let lastNumber = 0;
        let gaps: number[] = [];
        if (poolSnap.exists()) {
          lastNumber = poolSnap.data().lastNumber || 0;
          gaps = poolSnap.data().gaps || [];
        }
        let candidateNum: number;
        if (gaps.length > 0) {
          gaps.sort((a, b) => a - b);
          candidateNum = gaps[0];
          gaps = gaps.filter((g) => g !== candidateNum);
        } else {
          candidateNum = lastNumber + 1;
          lastNumber = candidateNum;
        }
        const candidateSeri = `${prefix}/${String(candidateNum).padStart(4, "0")}`;
        const lockRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(candidateSeri));
        const lockDoc = await transaction.get(lockRef);
        if (lockDoc.exists()) {
          let searchNum = candidateNum + 1;
          let found = false;
          while (searchNum <= lastNumber + 1000 && !found) {
            const testSeri = `${prefix}/${String(searchNum).padStart(4, "0")}`;
            const testRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(testSeri));
            const testDoc = await transaction.get(testRef);
            if (!testDoc.exists()) {
              if (gaps.includes(searchNum)) {
                gaps = gaps.filter((g) => g !== searchNum);
              } else if (searchNum > lastNumber) {
                lastNumber = searchNum;
              }
              candidateNum = searchNum;
              found = true;
            }
            searchNum++;
          }
          if (!found) throw new Error("No available DO Mandiri number found");
        }
        transaction.set(lockRef, { createdAt: serverTimestamp(), used: true });
        transaction.set(poolRef, { lastNumber, gaps, updatedAt: Timestamp.now() });
        return candidateSeri;
      });
      return result;
    } catch (error: any) {
      if (attempt === maxRetries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw new Error("Failed to generate unique DO Mandiri number after retries");
};

const releaseSeriSP = async (nomorSeri: string) => {
  try {
    const lockRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(nomorSeri));
    const lockSnap = await getDoc(lockRef);
    if (lockSnap.exists()) {
      await deleteDoc(lockRef);
    }
    const parts = nomorSeri.split("/");
    if (parts.length === 4 && parts[0] === "BAGB-SP") {
      const year = parseInt(parts[1]);
      const roman = parts[2];
      const num = parseInt(parts[3]);
      const poolRef = doc(db, "counters", `suratPengangkutanSP_${year}_${roman}`);
      await runTransaction(db, async (transaction) => {
        const poolSnap = await transaction.get(poolRef);
        if (!poolSnap.exists()) return;
        let gaps = (poolSnap.data().gaps || []) as number[];
        if (!gaps.includes(num)) {
          gaps.push(num);
          gaps.sort((a, b) => a - b);
        }
        transaction.set(poolRef, { gaps, updatedAt: Timestamp.now() }, { merge: true });
      });
    }
  } catch (error) {
    console.error(error);
  }
};

const releaseSeriDO = async (nomorSeri: string) => {
  try {
    const lockRef = doc(db, "suratPengangkutanLocks", sanitizeLockDocId(nomorSeri));
    const lockSnap = await getDoc(lockRef);
    if (lockSnap.exists()) {
      await deleteDoc(lockRef);
    }
    const parts = nomorSeri.split("/");
    if (parts.length === 4 && parts[0] === "BAGB-SP-DO") {
      const year = parseInt(parts[1]);
      const roman = parts[2];
      const num = parseInt(parts[3]);
      const poolRef = doc(db, "counters", `suratPengangkutanDO_Dikuasakan_${year}_${roman}`);
      await runTransaction(db, async (transaction) => {
        const poolSnap = await transaction.get(poolRef);
        if (!poolSnap.exists()) return;
        let gaps = (poolSnap.data().gaps || []) as number[];
        if (!gaps.includes(num)) {
          gaps.push(num);
          gaps.sort((a, b) => a - b);
        }
        transaction.set(poolRef, { gaps, updatedAt: Timestamp.now() }, { merge: true });
      });
    } else if (nomorSeri.startsWith("BAGB-DO-")) {
      const match = nomorSeri.match(/^BAGB-DO-(.+?)-(.+?)-SP\/(\d{4})$/);
      if (match) {
        const nsub = match[1];
        const perusahaan = match[2];
        const num = parseInt(match[3]);
        const poolRef = doc(db, "counters", `suratPengangkutanDO_Mandiri_${perusahaan}_${nsub}`);
        await runTransaction(db, async (transaction) => {
          const poolSnap = await transaction.get(poolRef);
          if (!poolSnap.exists()) return;
          let gaps = (poolSnap.data().gaps || []) as number[];
          if (!gaps.includes(num)) {
            gaps.push(num);
            gaps.sort((a, b) => a - b);
          }
          transaction.set(poolRef, { gaps, updatedAt: Timestamp.now() }, { merge: true });
        });
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const isDOExpired = (tanggalKadaluarsa: string) => {
  if (!tanggalKadaluarsa) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const kadaluarsa = new Date(tanggalKadaluarsa);
  kadaluarsa.setHours(0, 0, 0, 0);
  return kadaluarsa < today;
};

export default function SuratPengangkutanPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlNomorPI = searchParams.get("nomorPI");

  const [piList, setPiList] = useState<ProformaInvoice[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [existingSuratList, setExistingSuratList] = useState<ExistingSurat[]>([]);
  const [fotList, setFotList] = useState<FOTData[]>([]);
  const [doList, setDoList] = useState<DOItem[]>([]);
  const [suratDOList, setSuratDOList] = useState<SuratDODoc[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [jenisSurat, setJenisSurat] = useState<"gudangInduk" | "do" | "">("");
  const [subJenisDO, setSubJenisDO] = useState<"mandiri" | "dikuasakan" | "">("");
  const [showJenisModal, setShowJenisModal] = useState(true);
  const [showSubJenisModal, setShowSubJenisModal] = useState(false);
  const [pendingNomorSeri, setPendingNomorSeri] = useState("");

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    namaKabupaten: "Lamandau",
    nomorPolisi: "",
    driverUnit: "",
    nomorSIM: "",
    kepadaNama: "",
    kepadaPerusahaan: "",
    kepadaAlamat: "",
  });

  const [items, setItems] = useState<SuratPengangkutanItem[]>([]);
  const [piProductStatus, setPiProductStatus] = useState<Record<string, Record<string, { loaded: number; ordered: number; status: string }>>>({});
  const [piFullyLoadedMap, setPiFullyLoadedMap] = useState<Record<string, boolean>>({});
  const [piSearchMap, setPiSearchMap] = useState<Record<number, string>>({});
  const [piShowMap, setPiShowMap] = useState<Record<number, boolean>>({});
  const itemSearchRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const setFieldError = (key: string, message: string) => {
    setErrors((prev) => ({ ...prev, [key]: message }));
  };

  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  const clearFieldErrorForItem = (itemId: number) => {
    setErrors((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((key) => {
        if (key.includes(`_${itemId}`)) delete n[key];
      });
      return n;
    });
  };

  const clearAllItemErrors = (itemId: number) => {
    setErrors((prev) => {
      const n = { ...prev };
      Object.keys(n).forEach((key) => {
        if (key.includes(`_${itemId}`)) delete n[key];
      });
      return n;
    });
  };

  useEffect(() => {
    fetchProformaInvoice();
    fetchStockGudang();
    fetchExistingSurat();
    fetchFOT();
    fetchDO();
    fetchSuratDO();
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (piList.length > 0 && jenisSurat) {
      piList.forEach((pi) => {
        loadProductStatusForPI(pi);
      });
    }
  }, [piList, jenisSurat]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingNomorSeri) {
        if (jenisSurat === "gudangInduk") {
          releaseSeriSP(pendingNomorSeri);
        } else if (jenisSurat === "do") {
          releaseSeriDO(pendingNomorSeri);
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (pendingNomorSeri) {
        if (jenisSurat === "gudangInduk") {
          releaseSeriSP(pendingNomorSeri);
        } else if (jenisSurat === "do") {
          releaseSeriDO(pendingNomorSeri);
        }
      }
    };
  }, [pendingNomorSeri, jenisSurat]);

  useEffect(() => {
    if (urlNomorPI && piList.length > 0 && !showJenisModal && !showSubJenisModal) {
      if (
        jenisSurat === "gudangInduk" ||
        (jenisSurat === "do" && (subJenisDO === "mandiri" || subJenisDO === "dikuasakan"))
      ) {
        const pi = piList.find((p) => p.nomorPI === urlNomorPI);
        if (pi) {
          addItemWithPI(pi);
        }
      }
    }
  }, [urlNomorPI, piList, jenisSurat, subJenisDO, showJenisModal, showSubJenisModal]);

  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as Node;
    let clickedInsideAny = false;
    Object.keys(itemSearchRefs.current).forEach((key) => {
      const ref = itemSearchRefs.current[Number(key)];
      if (ref && ref.contains(target)) {
        clickedInsideAny = true;
      }
    });
    if (!clickedInsideAny) {
      setPiShowMap({});
    }
  };

  const fetchExistingSurat = async () => {
    try {
      const snapshot = await getDocs(collection(db, "suratPengangkutan"));
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        nomorSeri: doc.data().nomorSeri || "",
      } as ExistingSurat));
      setExistingSuratList(data);
    } catch (error) {
      console.error(error);
    }
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
    } catch (error) {
      console.error(error);
    }
  };

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

  const fetchSuratDO = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), where("jenisSurat", "==", "do"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        items: doc.data().items || [],
      } as SuratDODoc));
      setSuratDOList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const getLoadedKGForDOFromSurat = (doItem: DOItem) => {
    let total = 0;
    suratDOList.forEach((surat) => {
      surat.items.forEach((item) => {
        if (
          item.nomorSubDO === doItem.nomorSubDO &&
          item.nomorPO === doItem.nomorPO &&
          item.jenisPupuk === doItem.namaProduk
        ) {
          total += (item.pengambilanZAK || 0) * (item.bobotPerUnit || 50);
        }
      });
    });
    return total;
  };

  const getSisaDO = (doItem: DOItem) => {
    const loaded = getLoadedKGForDOFromSurat(doItem);
    return Math.max(0, (doItem.partyKG || 0) - loaded);
  };

  const getAvailableDO = (currentItemId: number) => {
    return doList.filter((doItem) => {
      if (isDOExpired(doItem.tanggalKadaluarsa)) return false;
      const sisa = getSisaDO(doItem);
      if (sisa <= 0) return false;
      const usedInOtherItem = items.find((it) => it.id !== currentItemId && it.nomorSubDO === doItem.nomorSubDO && it.nomorPO === doItem.nomorPO && it.jenisPupuk === doItem.namaProduk);
      if (usedInOtherItem) return false;
      const currentItem = items.find((it) => it.id === currentItemId);
      if (currentItem && currentItem.jenisPupuk.trim()) {
        if (doItem.namaProduk !== currentItem.jenisPupuk) return false;
      }
      if (currentItem && currentItem.fot.trim()) {
        if (doItem.fot.trim().toUpperCase() !== currentItem.fot.trim().toUpperCase()) return false;
      }
      return true;
    });
  };

  const handleSubDOSelect = (itemId: number, nomorSubDO: string) => {
    clearFieldError(`nomorSubDO_${itemId}`);
    clearFieldError(`jenisPupuk_${itemId}`);
    clearFieldError(`nomorPI_${itemId}`);

    if (!nomorSubDO) return;

    const doItem = doList.find((d) => d.nomorSubDO === nomorSubDO);
    if (!doItem) return;

    const currentItem = items.find((it) => it.id === itemId);
    if (currentItem && currentItem.fot.trim() && doItem.fot.trim().toUpperCase() !== currentItem.fot.trim().toUpperCase()) {
      setFieldError(`nomorSubDO_${itemId}`, `FOT DO (${doItem.fot}) tidak sesuai dengan FOT produk PI (${currentItem.fot})`);
      return;
    }

    if (isDOExpired(doItem.tanggalKadaluarsa)) {
      setFieldError(`nomorSubDO_${itemId}`, `DO ${doItem.nomorSubDO} sudah kadaluarsa (${doItem.tanggalKadaluarsa}). Silakan perpanjang masa kadaluarsa di Input DO.`);
      return;
    }

    const stock = getStockForProduct(doItem.namaProduk);
    const bobot = stock ? stock.bobotPerUnit : 50;
    const loadedDO = getLoadedKGForDOFromSurat(doItem);
    const sisaDO = Math.max(0, (doItem.partyKG || 0) - loadedDO);

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const piSisa = Math.max(0, item.piKuantitas - item.piLoadedKG);
        const maxZAKPI = item.bobotPerUnit > 0 ? Math.floor(piSisa / item.bobotPerUnit) : 0;
        const maxZAKDO = bobot > 0 ? Math.floor(sisaDO / bobot) : 0;
        const finalMaxZAK = Math.min(maxZAKPI, maxZAKDO);
        return {
          ...item,
          nomorSubDO: doItem.nomorSubDO,
          nomorPO: doItem.nomorPO,
          jenisPupuk: doItem.namaProduk,
          fot: doItem.fot,
          bobotPerUnit: bobot,
          doPartyKG: doItem.partyKG,
          doLoadedKG: loadedDO,
          doId: doItem.id,
          maxZAK: finalMaxZAK,
          party: formatParty(doItem.partyKG),
          sisa: formatParty(sisaDO),
          pengambilanZAK: finalMaxZAK > 0 ? String(finalMaxZAK) : "",
        };
      })
    );

    if (!formData.kepadaPerusahaan.trim()) {
      const matchedFOT = fotList.find((f) => f.namaFOT.toUpperCase() === doItem.namaPerusahaan.toUpperCase());
      setFormData((prev) => ({
        ...prev,
        kepadaPerusahaan: doItem.namaPerusahaan,
        kepadaAlamat: matchedFOT ? matchedFOT.alamatFOT : "",
      }));
    }
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
        sisaPengambilanKG: doc.data().sisaPengambilanKG,
        statusPengangkutan: doc.data().statusPengangkutan || "pending",
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
        botolPerDus: doc.data().botolPerDus || doc.data().jumlahIsiBotol || 20,
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

  const getBotolPerDus = (namaProduk: string) => {
    const stock = getStockForProduct(namaProduk);
    return stock ? stock.botolPerDus : 20;
  };

  const isDusOrBotolProduct = (namaProduk: string) => {
    const stock = getStockForProduct(namaProduk);
    return stock ? (stock.unit === "DUS" || stock.unit === "BOTOL") : false;
  };

  const getLoadedKGForPIProduct = async (nomorPI: string, namaProduk: string, fotFilter?: string) => {
    let totalLoaded = 0;
    try {
      const q1 = query(collection(db, "suratPengangkutan"), where("nomorPI", "==", nomorPI));
      const snap1 = await getDocs(q1);
      const q2 = query(collection(db, "suratPengangkutan"), where("nomorPI", "array-contains", nomorPI));
      const snap2 = await getDocs(q2);
      const allDocs = [...snap1.docs, ...snap2.docs];
      const uniqueIds = new Set<string>();
      const isDusBotol = isDusOrBotolProduct(namaProduk);
      const botolPerDus = getBotolPerDus(namaProduk);
      allDocs.forEach((d) => {
        if (uniqueIds.has(d.id)) return;
        uniqueIds.add(d.id);
        const data = d.data();
        const suratItems = data.items || [];
        suratItems.forEach((item: any) => {
          const itemPI = item.nomorPI || data.nomorPI || "";
          const piMatch = Array.isArray(itemPI) ? itemPI.includes(nomorPI) : String(itemPI) === nomorPI;
          if (!piMatch) return;
          if (
            item.jenisPupuk && (
              item.jenisPupuk.toUpperCase().includes(namaProduk.toUpperCase()) ||
              namaProduk.toUpperCase().includes(item.jenisPupuk.toUpperCase())
            )
          ) {
            if (fotFilter) {
              const itemFOT = (item.fot || "").trim().toUpperCase();
              const filterIsGI = isGudangIndukFOT(fotFilter);
              const itemIsGI = isGudangIndukFOT(itemFOT);
              if (filterIsGI !== itemIsGI) return;
            }
            if (isDusBotol) {
              const itemBobot = item.bobotPerUnit || 50;
              if (itemBobot === 1) {
                totalLoaded += (item.pengambilanZAK || 0);
              } else {
                totalLoaded += (item.pengambilanZAK || 0) * botolPerDus;
              }
            } else {
              totalLoaded += (item.pengambilanZAK || 0) * (item.bobotPerUnit || 50);
            }
          }
        });
      });
    } catch (e) { console.error(e); }
    return totalLoaded;
  };

  const piHasValidProductForJenisSurat = (pi: ProformaInvoice) => {
    if (!jenisSurat) return true;
    return pi.produkItems.some((prod) => {
      const fot = (prod.fot || "").trim();
      const isGI = isGudangIndukFOT(fot);
      if (jenisSurat === "gudangInduk") return isGI;
      if (jenisSurat === "do") {
        if (fot) return !isGI;
        return true;
      }
      return true;
    });
  };

  const isPIFullyLoaded = (pi: ProformaInvoice) => {
    const statusMap = piProductStatus[pi.nomorPI];
    if (!statusMap) return false;
    const validProducts = getValidProductsForPI(pi);
    if (validProducts.length === 0) return false;
    return validProducts.every((prod) => {
      const isDusBotol = isDusOrBotolProduct(prod.namaProduk);
      const botolPerDus = getBotolPerDus(prod.namaProduk);
      let ordered = prod.kuantitas || 0;
      if (prod.satuan === "DUS" && isDusBotol) {
        ordered = ordered * botolPerDus;
      }
      const loaded = statusMap[prod.namaProduk]?.loaded || 0;
      return loaded >= ordered;
    });
  };

  const getPIAvailableForItem = (search: string, itemId?: number) => {
    return piList.filter((pi) => {
      if (isPIFullyLoaded(pi)) return false;
      if (!piHasValidProductForJenisSurat(pi)) return false;
      const searchLower = search.toLowerCase();
      const matchSearch = pi.nomorPI.toLowerCase().includes(searchLower) || pi.namaCustomer.toLowerCase().includes(searchLower);
      if (!matchSearch) return false;
      if (itemId) {
        const currentItem = items.find((it) => it.id === itemId);
        if (currentItem && currentItem.nomorSubDO.trim()) {
          const doItem = doList.find((d) => d.nomorSubDO === currentItem.nomorSubDO);
          if (doItem) {
            const hasMatchingFOT = pi.produkItems.some((prod) => {
              const prodFOT = (prod.fot || "").trim().toUpperCase();
              return prodFOT === doItem.fot.trim().toUpperCase();
            });
            if (!hasMatchingFOT) return false;
          }
        }
      }
      return true;
    });
  };

  const getValidProductsForPI = (pi: ProformaInvoice, doFOT?: string) => {
    return pi.produkItems.filter((prod) => {
      const fot = (prod.fot || "").trim();
      const isGI = isGudangIndukFOT(fot);
      if (jenisSurat === "gudangInduk") return isGI;
      if (jenisSurat === "do") {
        if (fot) return !isGI;
        return true;
      }
      if (doFOT && fot && doFOT.trim().toUpperCase() !== fot.toUpperCase()) return false;
      return true;
    });
  };

  const isProductAlreadySelected = (currentItemId: number, nomorPI: string, namaProduk: string) => {
    return items.find((it) =>
      it.id !== currentItemId &&
      it.nomorPI === nomorPI &&
      it.jenisPupuk === namaProduk
    );
  };

  const loadProductStatusForPI = async (pi: ProformaInvoice) => {
    const validProducts = getValidProductsForPI(pi);
    const statusMap: Record<string, { loaded: number; ordered: number; status: string }> = {};
    await Promise.all(
      validProducts.map(async (prod) => {
        const prodFOT = (prod.fot || "").trim();
        const loaded = await getLoadedKGForPIProduct(pi.nomorPI, prod.namaProduk, prodFOT);
        let ordered = prod.kuantitas || 0;
        const isDusBotol = isDusOrBotolProduct(prod.namaProduk);
        const botolPerDus = getBotolPerDus(prod.namaProduk);
        if (prod.satuan === "DUS" && isDusBotol) {
          ordered = ordered * botolPerDus;
        }
        let status = "pending";
        if (loaded >= ordered) status = "complete";
        else if (loaded > 0) status = "partial";
        statusMap[prod.namaProduk] = { loaded, ordered, status };
      })
    );
    setPiProductStatus((prev) => ({ ...prev, [pi.nomorPI]: statusMap }));
    const fullyLoaded = validProducts.length > 0 && validProducts.every((prod) => statusMap[prod.namaProduk]?.status === "complete");
    setPiFullyLoadedMap((prev) => ({ ...prev, [pi.nomorPI]: fullyLoaded }));
    return statusMap;
  };

  const handlePISelectForItem = async (itemId: number, pi: ProformaInvoice) => {
    setPiShowMap((prev) => ({ ...prev, [itemId]: false }));
    setPiSearchMap((prev) => ({ ...prev, [itemId]: pi.nomorPI }));
    clearFieldError(`nomorPI_${itemId}`);
    clearFieldError(`jenisPupuk_${itemId}`);

    const statusMap = await loadProductStatusForPI(pi);
    const fullyLoaded = piFullyLoadedMap[pi.nomorPI] !== undefined ? piFullyLoadedMap[pi.nomorPI] : (getValidProductsForPI(pi).every((prod) => statusMap[prod.namaProduk]?.status === "complete"));
    if (fullyLoaded) {
      setFieldError(`nomorPI_${itemId}`, `PI ${pi.nomorPI} sudah dimuat semua, tidak dapat dipilih.`);
      return;
    }
    const validProducts = getValidProductsForPI(pi);
    const availableProducts = validProducts.filter((prod) => statusMap[prod.namaProduk]?.status !== "complete");
    const firstProd = availableProducts[0];
    let bobot = 50;
    let fot = "";
    let jenisPupuk = "";
    let piKuantitas = 0;
    let piLoaded = 0;
    let isDusBotol = false;
    let botolPerDus = 20;

    if (firstProd) {
      bobot = getBobotPerUnit(firstProd.namaProduk);
      fot = (firstProd.fot || "").trim();
      jenisPupuk = firstProd.namaProduk;
      isDusBotol = isDusOrBotolProduct(firstProd.namaProduk);
      botolPerDus = getBotolPerDus(firstProd.namaProduk);
      piKuantitas = firstProd.kuantitas || 0;
      if (firstProd.satuan === "DUS" && isDusBotol) {
        piKuantitas = piKuantitas * botolPerDus;
      }
      const firstProdFOT = (firstProd.fot || "").trim();
      piLoaded = statusMap[firstProd.namaProduk]?.loaded || await getLoadedKGForPIProduct(pi.nomorPI, firstProd.namaProduk, firstProdFOT);
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const hasDO = item.nomorSubDO.trim() !== "";
        const doSisa = hasDO ? Math.max(0, item.doPartyKG - item.doLoadedKG) : 0;
        let maxDO = 0;
        if (hasDO) {
          if (isDusBotol) {
            const itemBobot = item.bobotPerUnit || 50;
            if (itemBobot === 1) {
              maxDO = Math.floor(doSisa);
            } else {
              maxDO = Math.floor(doSisa / itemBobot) * botolPerDus;
            }
          } else {
            maxDO = item.bobotPerUnit > 0 ? Math.floor(doSisa / item.bobotPerUnit) : 0;
          }
        }
        const piSisa = Math.max(0, piKuantitas - piLoaded);
        let maxPI = 0;
        if (isDusBotol) {
          maxPI = piSisa;
        } else {
          maxPI = bobot > 0 ? Math.floor(piSisa / bobot) : 0;
        }
        const finalMax = hasDO ? Math.min(maxPI, maxDO) : maxPI;
        return {
          ...item,
          nomorPI: pi.nomorPI,
          namaCustomer: pi.namaCustomer,
          jenisPupuk: hasDO ? item.jenisPupuk : jenisPupuk,
          fot: hasDO ? item.fot : fot,
          bobotPerUnit: hasDO ? item.bobotPerUnit : (isDusBotol ? 1 : bobot),
          piKuantitas: piKuantitas,
          piLoadedKG: piLoaded,
          piId: pi.id,
          maxZAK: finalMax,
          party: hasDO ? item.party : (isDusBotol ? `${piKuantitas.toLocaleString()} BOTOL` : formatParty(piKuantitas)),
          sisa: hasDO ? formatParty(doSisa) : (isDusBotol ? `${piSisa.toLocaleString()} BOTOL` : formatSisaKG(piSisa)),
          pengambilanZAK: "",
        };
      })
    );
  };

  const handleProdukSelectForItem = async (itemId: number, pi: ProformaInvoice, prod: ProformaInvoice["produkItems"][number]) => {
    clearFieldError(`jenisPupuk_${itemId}`);

    const statusMap = piProductStatus[pi.nomorPI] || {};
    if (!prod) return;

    if (statusMap[prod.namaProduk]?.status === "complete") {
      setFieldError(`jenisPupuk_${itemId}`, `Produk ${prod.namaProduk} pada PI ${pi.nomorPI} sudah dimuat semua`);
      return;
    }

    const bobot = getBobotPerUnit(prod.namaProduk);
    const fot = (prod.fot || "").trim();
    const prodFOT = (prod.fot || "").trim();
    const piLoaded = statusMap[prod.namaProduk]?.loaded || await getLoadedKGForPIProduct(pi.nomorPI, prod.namaProduk, prodFOT);
    let piKuantitas = prod.kuantitas || 0;
    const isDusBotol = isDusOrBotolProduct(prod.namaProduk);
    const botolPerDus = getBotolPerDus(prod.namaProduk);
    if (prod.satuan === "DUS" && isDusBotol) {
      piKuantitas = piKuantitas * botolPerDus;
    }

    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const hasDO = item.nomorSubDO.trim() !== "";
        const doSisa = hasDO ? Math.max(0, item.doPartyKG - item.doLoadedKG) : 0;
        let maxDO = 0;
        if (hasDO) {
          if (isDusBotol) {
            const itemBobot = item.bobotPerUnit || 50;
            if (itemBobot === 1) {
              maxDO = Math.floor(doSisa);
            } else {
              maxDO = Math.floor(doSisa / itemBobot) * botolPerDus;
            }
          } else {
            maxDO = item.bobotPerUnit > 0 ? Math.floor(doSisa / item.bobotPerUnit) : 0;
          }
        }
        const piSisa = Math.max(0, piKuantitas - piLoaded);
        let maxPI = 0;
        if (isDusBotol) {
          maxPI = piSisa;
        } else {
          maxPI = bobot > 0 ? Math.floor(piSisa / bobot) : 0;
        }
        const finalMax = hasDO ? Math.min(maxPI, maxDO) : maxPI;
        return {
          ...item,
          jenisPupuk: hasDO ? item.jenisPupuk : prod.namaProduk,
          fot: hasDO ? item.fot : fot,
          bobotPerUnit: hasDO ? item.bobotPerUnit : (isDusBotol ? 1 : bobot),
          piKuantitas: piKuantitas,
          piLoadedKG: piLoaded,
          piId: pi.id,
          maxZAK: finalMax,
          party: hasDO ? item.party : (isDusBotol ? `${piKuantitas.toLocaleString()} BOTOL` : formatParty(piKuantitas)),
          sisa: hasDO ? formatParty(doSisa) : (isDusBotol ? `${piSisa.toLocaleString()} BOTOL` : formatSisaKG(piSisa)),
          pengambilanZAK: "",
        };
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
        nomorPI: "",
        namaCustomer: "",
        doPartyKG: 0,
        doLoadedKG: 0,
        piKuantitas: 0,
        piLoadedKG: 0,
      },
    ]);
    setPiSearchMap((prev) => ({ ...prev, [newId]: "" }));
    setPiShowMap((prev) => ({ ...prev, [newId]: false }));
  };

  const addItemWithPI = async (pi: ProformaInvoice) => {
    const validProducts = getValidProductsForPI(pi);
    const statusMap = await loadProductStatusForPI(pi);
    const availableProducts = validProducts.filter((prod) => statusMap[prod.namaProduk]?.status !== "complete");
    const firstProd = availableProducts[0];
    const newId = items.length > 0 ? Math.max(...items.map((i) => i.id)) + 1 : 1;
    const bobot = firstProd ? getBobotPerUnit(firstProd.namaProduk) : 50;
    const fot = firstProd ? (firstProd.fot || "").trim() : "";
    const isDusBotol = firstProd ? isDusOrBotolProduct(firstProd.namaProduk) : false;
    const botolPerDus = firstProd ? getBotolPerDus(firstProd.namaProduk) : 20;

    let piKuantitas = 0;
    let piLoaded = 0;

    setPiSearchMap((prev) => ({ ...prev, [newId]: pi.nomorPI }));
    setPiShowMap((prev) => ({ ...prev, [newId]: false }));

    if (firstProd) {
      piKuantitas = firstProd.kuantitas || 0;
      if (firstProd.satuan === "DUS" && isDusBotol) {
        piKuantitas = piKuantitas * botolPerDus;
      }
      const firstProdFOT = (firstProd.fot || "").trim();
      piLoaded = statusMap[firstProd.namaProduk]?.loaded || await getLoadedKGForPIProduct(pi.nomorPI, firstProd.namaProduk, firstProdFOT);
      const piSisa = Math.max(0, piKuantitas - piLoaded);
      let maxPI = 0;
      if (isDusBotol) {
        maxPI = piSisa;
      } else {
        maxPI = bobot > 0 ? Math.floor(piSisa / bobot) : 0;
      }

      setItems((prev) => [
        ...prev,
        {
          id: newId,
          nomorSubDO: "",
          nomorPO: "",
          jenisPupuk: firstProd.namaProduk,
          party: isDusBotol ? `${piKuantitas.toLocaleString()} BOTOL` : formatParty(piKuantitas),
          pengambilanZAK: "",
          sisa: isDusBotol ? `${piSisa.toLocaleString()} BOTOL` : formatSisaKG(piSisa),
          bobotPerUnit: isDusBotol ? 1 : bobot,
          maxZAK: maxPI,
          fot: fot,
          nomorPI: pi.nomorPI,
          namaCustomer: pi.namaCustomer,
          doPartyKG: 0,
          doLoadedKG: 0,
          piKuantitas: piKuantitas,
          piLoadedKG: piLoaded,
          piId: pi.id,
        },
      ]);
    } else {
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
          nomorPI: pi.nomorPI,
          namaCustomer: pi.namaCustomer,
          doPartyKG: 0,
          doLoadedKG: 0,
          piKuantitas: 0,
          piLoadedKG: 0,
          piId: pi.id,
        },
      ]);
    }
  };

  const removeItem = (id: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
    setPiSearchMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setPiShowMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    clearAllItemErrors(id);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearFieldError(name);
  };

  const handlePerusahaanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const selected = fotList.find((f) => f.namaFOT === value);
    setFormData((prev) => ({
      ...prev,
      kepadaPerusahaan: value,
      kepadaAlamat: selected ? selected.alamatFOT : "",
    }));
    clearFieldError("kepadaPerusahaan");
  };

  const handleItemChange = (id: number, field: keyof SuratPengangkutanItem, value: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "pengambilanZAK") {
          const zak = parseFloat(value) || 0;
          const hasDO = item.nomorSubDO.trim() !== "";
          const piSisa = Math.max(0, item.piKuantitas - item.piLoadedKG);
          const doSisa = hasDO ? Math.max(0, item.doPartyKG - item.doLoadedKG) : 0;
          const isDusBotol = item.bobotPerUnit === 1 && item.piKuantitas > 0 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk);
          const botolPerDus = item.jenisPupuk ? getBotolPerDus(item.jenisPupuk) : 20;
          let maxPI = 0;
          let maxDO = 0;
          if (isDusBotol) {
            maxPI = piSisa;
            if (hasDO) {
              const itemBobot = item.bobotPerUnit || 50;
              if (itemBobot === 1) {
                maxDO = Math.floor(doSisa);
              } else {
                maxDO = Math.floor(doSisa / itemBobot) * botolPerDus;
              }
            }
          } else {
            maxPI = item.bobotPerUnit > 0 ? Math.floor(piSisa / item.bobotPerUnit) : 0;
            maxDO = hasDO && item.bobotPerUnit > 0 ? Math.floor(doSisa / item.bobotPerUnit) : 0;
          }
          const finalMax = hasDO ? Math.min(maxPI, maxDO) : maxPI;
          updated.maxZAK = finalMax;
          if (finalMax > 0 && zak > finalMax) {
            updated.pengambilanZAK = String(finalMax);
            const zakFinal = finalMax;
            if (hasDO) {
              const doSisaAfter = Math.max(0, doSisa - (isDusBotol ? (zakFinal / botolPerDus) * (item.bobotPerUnit || 50) : zakFinal * item.bobotPerUnit));
              updated.sisa = formatParty(doSisaAfter);
            } else {
              const piSisaAfter = Math.max(0, piSisa - (isDusBotol ? zakFinal : zakFinal * item.bobotPerUnit));
              updated.sisa = isDusBotol ? `${piSisaAfter.toLocaleString()} BOTOL` : formatSisaKG(piSisaAfter);
            }
          } else if (finalMax === 0) {
            updated.pengambilanZAK = "";
            updated.sisa = hasDO ? formatParty(doSisa) : (isDusBotol ? `${piSisa.toLocaleString()} BOTOL` : formatSisaKG(piSisa));
          } else {
            if (hasDO) {
              const doSisaAfter = Math.max(0, doSisa - (isDusBotol ? (zak / botolPerDus) * (item.bobotPerUnit || 50) : zak * item.bobotPerUnit));
              updated.sisa = formatParty(doSisaAfter);
            } else {
              const piSisaAfter = Math.max(0, piSisa - (isDusBotol ? zak : zak * item.bobotPerUnit));
              updated.sisa = isDusBotol ? `${piSisaAfter.toLocaleString()} BOTOL` : formatSisaKG(piSisaAfter);
            }
          }
          clearFieldError(`pengambilan_${id}`);
          if (value.trim() !== "" && zak <= 0) {
            setFieldError(`pengambilan_${id}`, "Pengambilan harus lebih dari 0");
          } else if (finalMax > 0 && zak > finalMax) {
            setFieldError(`pengambilan_${id}`, isDusBotol ? `Maksimal ${finalMax} BOTOL` : `Maksimal ${finalMax} ZAK (${finalMax * item.bobotPerUnit} KG)`);
          } else if (finalMax === 0) {
            setFieldError(`pengambilan_${id}`, "Sisa PI atau DO sudah habis");
          }
        }
        return updated;
      })
    );
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.namaKabupaten.trim()) newErrors.namaKabupaten = "Nama kabupaten wajib diisi";

    const isGI = jenisSurat === "gudangInduk";
    const isMandiri = subJenisDO === "mandiri";

    if (isGI || isMandiri) {
      if (!formData.driverUnit.trim()) newErrors.driverUnit = "Driver unit wajib diisi";
      if (!formData.nomorPolisi.trim()) newErrors.nomorPolisi = "Nomor polisi wajib diisi";
    }

    if (isMandiri) {
      if (!formData.kepadaNama.trim()) newErrors.kepadaNama = "Nama penerima wajib diisi";
      if (!formData.kepadaPerusahaan.trim()) newErrors.kepadaPerusahaan = "Nama perusahaan wajib diisi";
      if (!formData.kepadaAlamat.trim()) newErrors.kepadaAlamat = "Alamat wajib diisi";
    }

    if (items.length === 0) {
      newErrors.items = "Minimal harus ada 1 item pengangkutan";
    }

    const productKeys: Record<string, number> = {};
    items.forEach((item, idx) => {
      if (!item.nomorPI.trim()) newErrors[`nomorPI_${item.id}`] = "Nomor PI wajib dipilih";
      if (!item.jenisPupuk.trim()) newErrors[`jenisPupuk_${item.id}`] = "Jenis pupuk wajib diisi";
      const prodStatus = piProductStatus[item.nomorPI]?.[item.jenisPupuk];
      if (item.jenisPupuk && prodStatus?.status === "complete") {
        newErrors[`jenisPupuk_${item.id}`] = `Produk ${item.jenisPupuk} pada PI ${item.nomorPI} sudah dimuat semua`;
      }
      if (isMandiri) {
        if (!item.nomorSubDO.trim()) {
          newErrors[`nomorSubDO_${item.id}`] = "Nomor Sub DO wajib dipilih";
        } else {
          const doItem = doList.find((d) => d.nomorSubDO === item.nomorSubDO);
          if (doItem) {
            if (isDOExpired(doItem.tanggalKadaluarsa)) {
              newErrors[`nomorSubDO_${item.id}`] = `DO ${doItem.nomorSubDO} sudah kadaluarsa (${doItem.tanggalKadaluarsa}). Silakan perpanjang masa kadaluarsa di Input DO.`;
            }
            if (item.fot.trim() && doItem.fot.trim().toUpperCase() !== item.fot.trim().toUpperCase()) {
              newErrors[`nomorSubDO_${item.id}`] = `FOT DO (${doItem.fot}) tidak sesuai dengan FOT produk PI (${item.fot})`;
            }
          }
        }
        if (!item.nomorPO.trim()) newErrors[`nomorPO_${item.id}`] = "Nomor PO wajib diisi";
        if (!item.party.trim()) newErrors[`party_${item.id}`] = "Party wajib diisi";
      }
      if (!item.pengambilanZAK.trim()) {
        newErrors[`pengambilan_${item.id}`] = "Pengambilan wajib diisi";
      } else {
        const zak = parseFloat(item.pengambilanZAK) || 0;
        if (zak <= 0) newErrors[`pengambilan_${item.id}`] = "Pengambilan harus lebih dari 0";
        const itemIsDusBotol = item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk);
        if (zak > item.maxZAK && item.maxZAK > 0) {
          newErrors[`pengambilan_${item.id}`] = itemIsDusBotol ? `Maksimal ${item.maxZAK} BOTOL` : `Maksimal ${item.maxZAK} ZAK (${item.maxZAK * item.bobotPerUnit} KG)`;
        }
        if (isMandiri && item.nomorSubDO.trim()) {
          const doItem = doList.find((d) => d.nomorSubDO === item.nomorSubDO);
          if (doItem) {
            const doSisa = Math.max(0, doItem.partyKG - getLoadedKGForDOFromSurat(doItem));
            let maxDO = 0;
            if (itemIsDusBotol) {
              const itemBobot = item.bobotPerUnit || 50;
              if (itemBobot === 1) {
                maxDO = Math.floor(doSisa);
              } else {
                const botolPerDus = item.jenisPupuk ? getBotolPerDus(item.jenisPupuk) : 20;
                maxDO = Math.floor(doSisa / itemBobot) * botolPerDus;
              }
            } else {
              maxDO = item.bobotPerUnit > 0 ? Math.floor(doSisa / item.bobotPerUnit) : 0;
            }
            if (zak > maxDO && maxDO > 0) {
              newErrors[`pengambilan_${item.id}`] = itemIsDusBotol ? `Melebihi sisa DO: maksimal ${maxDO} BOTOL` : `Melebihi sisa DO: maksimal ${maxDO} ZAK (${doSisa} KG)`;
            }
          }
        }
      }
      const fot = (item.fot || "").trim();
      const giFOT = isGudangIndukFOT(fot);
      if (jenisSurat === "gudangInduk" && !giFOT && item.jenisPupuk) {
        newErrors[`jenisPupuk_${item.id}`] = `Produk ${item.jenisPupuk} berasal dari FOT selain Gudang Induk`;
      }
      if (jenisSurat === "do" && giFOT && item.jenisPupuk) {
        newErrors[`jenisPupuk_${item.id}`] = `Produk ${item.jenisPupuk} berasal dari FOT Gudang Induk`;
      }
      const key = `${item.nomorPI.trim()}|${item.jenisPupuk.trim()}`;
      if (item.nomorPI.trim() && item.jenisPupuk.trim()) {
        if (productKeys[key] !== undefined) {
          newErrors[`jenisPupuk_${item.id}`] = `Produk ${item.jenisPupuk} dari PI ${item.nomorPI} sudah dipilih di Item ${productKeys[key] + 1}`;
        } else {
          productKeys[key] = idx;
        }
      }
    });

    if (jenisSurat === "do" && isMandiri) {
      const firstItem = items.find((it) => it.nomorSubDO.trim() !== "");
      if (!firstItem || !firstItem.nomorSubDO.trim()) {
        newErrors.nomorSubDO = "Nomor Sub DO wajib dipilih untuk generate nomor seri";
      }
      const perusahaan = formData.kepadaPerusahaan.trim();
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
    let nomorSeri = "";
    try {
      const isGI = jenisSurat === "gudangInduk";
      const isMandiri = subJenisDO === "mandiri";
      const isDikuasakan = subJenisDO === "dikuasakan";
      const now = new Date();

      const doItemsWithId = items.filter((it) => it.doId);
      const piItemsWithId = items.filter((it) => it.piId);
      const stockItemRefsForGI = isGI
        ? items.map((it) => {
            const stock = getStockForProduct(it.jenisPupuk);
            return stock ? { item: it, stock, ref: doc(db, "stockGudang", stock.id) } : null;
          }).filter((x): x is NonNullable<typeof x> => !!x)
        : [];
      const stockRefs = stockItemRefsForGI.map((x) => x.ref);

      const doRefs = doItemsWithId.map((it) => doc(db, "do", it.doId!));
      const piRefs = piItemsWithId.map((it) => doc(db, "proformaInvoice", it.piId!));

      let isMandiriCounter = false;
      let mandiriNomorSubDO = "";
      let mandiriPerusahaan = "";

      if (jenisSurat === "gudangInduk") {
        nomorSeri = await getUniqueSeriSP(now.getFullYear(), getRomanMonth(now.getMonth() + 1));
      } else if (jenisSurat === "do") {
        if (subJenisDO === "dikuasakan") {
          nomorSeri = await getUniqueSeriDODikuasakan(now.getFullYear(), getRomanMonth(now.getMonth() + 1));
        } else {
          const perusahaan = formData.kepadaPerusahaan.trim();
          const firstItem = items.find((it) => it.nomorSubDO.trim() !== "");
          const nomorSubDO = firstItem?.nomorSubDO?.trim() || "";
          if (!perusahaan || !nomorSubDO) throw new Error("Data tidak lengkap untuk generate nomor seri");
          mandiriNomorSubDO = nomorSubDO;
          mandiriPerusahaan = perusahaan;
          isMandiriCounter = true;
          nomorSeri = await getUniqueSeriDOMandiri(perusahaan, nomorSubDO);
        }
      }

      setPendingNomorSeri(nomorSeri);

      await runTransaction(db, async (transaction) => {
        const allReads: Promise<any>[] = [];
        doRefs.forEach((ref) => allReads.push(transaction.get(ref)));
        piRefs.forEach((ref) => allReads.push(transaction.get(ref)));
        stockRefs.forEach((ref) => allReads.push(transaction.get(ref)));

        const allSnaps = await Promise.all(allReads);

        const doSnaps = allSnaps.slice(0, doRefs.length);
        const piSnaps = allSnaps.slice(doRefs.length, doRefs.length + piRefs.length);
        const stockSnaps = allSnaps.slice(doRefs.length + piRefs.length);

        if (!nomorSeri) throw new Error("Gagal generate nomor seri");

        if (isMandiri) {
          doSnaps.forEach((snap, idx) => {
            const item = doItemsWithId[idx];
            if (!snap.exists()) throw new Error(`DO ${item.nomorSubDO} tidak ditemukan`);
            const doData = snap.data() as DODoc;
            const currentLoaded = item.doLoadedKG || 0;
            const addKG = (parseFloat(item.pengambilanZAK) || 0) * item.bobotPerUnit;
            const party = doData.partyKG || 0;
            if (currentLoaded + addKG > party) {
              throw new Error(`Pengambilan melebihi party DO ${item.nomorSubDO}`);
            }
          });
        }

        const piDeductions: Record<string, { ref: any; piId: string; kg: number }> = {};
        piItemsWithId.forEach((item) => {
          if (item.piId && item.nomorPI) {
            if (!piDeductions[item.nomorPI]) {
              const refIdx = piRefs.findIndex((r) => r.id === item.piId);
              piDeductions[item.nomorPI] = { ref: piRefs[refIdx], piId: item.piId, kg: 0 };
            }
            const isDusBotolItem = item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk);
        const itemBotolPerDus = item.jenisPupuk ? getBotolPerDus(item.jenisPupuk) : 20;
        if (isDusBotolItem) {
          piDeductions[item.nomorPI].kg += (parseFloat(item.pengambilanZAK) || 0);
        } else {
          piDeductions[item.nomorPI].kg += (parseFloat(item.pengambilanZAK) || 0) * item.bobotPerUnit;
        }
          }
        });
        Object.entries(piDeductions).forEach(([nomorPI, { ref }]) => {
          const snapIdx = piRefs.findIndex((r) => r.id === piDeductions[nomorPI].piId);
          const piSnap = piSnaps[snapIdx];
          if (!piSnap.exists()) throw new Error(`PI ${nomorPI} tidak ditemukan`);
          const piData = piSnap.data() as PIDoc;
          const totalOrdered = (piData.produkItems || []).reduce((sum: number, p: any) => {
          const prodIsDusBotol = isDusOrBotolProduct(p.namaProduk);
          const prodBotolPerDus = getBotolPerDus(p.namaProduk);
          let qty = p.kuantitas || 0;
          if (p.satuan === "DUS" && prodIsDusBotol) {
            qty = qty * prodBotolPerDus;
          }
          return sum + qty;
        }, 0);
          const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : totalOrdered;
          const kg = piDeductions[nomorPI].kg;
          if (currentSisa - kg < 0) {
            throw new Error(`Pengambilan melebihi sisa PI ${nomorPI}`);
          }
          const newSisa = currentSisa - kg;
          transaction.update(ref, {
            sisaPengambilanKG: newSisa,
            statusPengangkutan: newSisa <= 0 ? "complete" : "partial",
            updatedAt: serverTimestamp(),
          });
        });

        if (isGI) {
          const stockDeductions: Record<string, { ref: any; stockId: string; totalUnit: number; totalKG: number }> = {};
          stockItemRefsForGI.forEach((x) => {
            if (!stockDeductions[x.stock.id]) {
              stockDeductions[x.stock.id] = { ref: x.ref, stockId: x.stock.id, totalUnit: 0, totalKG: 0 };
            }
            const zak = parseFloat(x.item.pengambilanZAK) || 0;
            const stockUnit = x.stock.unit || "ZAK";
            const isStockDus = stockUnit === "DUS";
            const isStockBotol = stockUnit === "BOTOL";
            const isDusBotolItem = x.item.bobotPerUnit === 1 && x.item.jenisPupuk && isDusOrBotolProduct(x.item.jenisPupuk);
            const botolPerDus = x.item.jenisPupuk ? getBotolPerDus(x.item.jenisPupuk) : 20;
            let unitDeduction = zak;
            let kgDeduction = 0;
            if (isStockDus) {
              unitDeduction = isDusBotolItem ? zak / botolPerDus : zak;
              kgDeduction = 0;
            } else if (isStockBotol) {
              unitDeduction = zak;
              kgDeduction = 0;
            } else {
              kgDeduction = zak * x.item.bobotPerUnit;
            }
            stockDeductions[x.stock.id].totalUnit += unitDeduction;
            stockDeductions[x.stock.id].totalKG += kgDeduction;
          });
          Object.entries(stockDeductions).forEach(([stockId, { ref, totalUnit, totalKG }]) => {
            const snapIdx = stockRefs.findIndex((r) => r.id === stockId);
            const snap = stockSnaps[snapIdx];
            if (!snap.exists()) throw new Error(`Stok untuk produk tidak ditemukan`);
            const currentData = snap.data() as StockDoc;
            const currentStokUnit = currentData.stokAkhirUnit || 0;
            const currentStokKG = currentData.stokAkhirKG || 0;
            const stockUnit = currentData.unit || "ZAK";
            const isStockDusBotol = stockUnit === "DUS" || stockUnit === "BOTOL";
            if (isStockDusBotol) {
              if (currentStokUnit - totalUnit < 0) {
                throw new Error(`Stok gudang tidak mencukupi untuk total pengambilan`);
              }
              transaction.update(ref, {
                barangKeluarUnit: (currentData.barangKeluarUnit || 0) + totalUnit,
                barangKeluarKG: 0,
                stokAkhirUnit: currentStokUnit - totalUnit,
                stokAkhirKG: 0,
                updatedAt: serverTimestamp(),
              });
            } else {
              if (currentStokUnit - totalUnit < 0 || currentStokKG - totalKG < 0) {
                throw new Error(`Stok gudang tidak mencukupi untuk total pengambilan`);
              }
              transaction.update(ref, {
                barangKeluarUnit: (currentData.barangKeluarUnit || 0) + totalUnit,
                barangKeluarKG: (currentData.barangKeluarKG || 0) + totalKG,
                stokAkhirUnit: currentStokUnit - totalUnit,
                stokAkhirKG: currentStokKG - totalKG,
                updatedAt: serverTimestamp(),
              });
            }
          });
        }

        const totalPengambilanKG = items.reduce((sum, item) => {
          const zak = parseFloat(item.pengambilanZAK) || 0;
          const itemIsDusBotol = item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk);
          const botolPerDus = item.jenisPupuk ? getBotolPerDus(item.jenisPupuk) : 20;
          if (itemIsDusBotol) {
            return sum + (zak / botolPerDus) * (item.bobotPerUnit || 50);
          }
          return sum + zak * item.bobotPerUnit;
        }, 0);

        const suratData: any = {
          jenisSurat,
          subJenisDO: subJenisDO || null,
          tanggal: formData.tanggal,
          namaKabupaten: formData.namaKabupaten,
          items: items.map((item) => {
            const itemIsDusBotol = item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk);
            const botolPerDus = item.jenisPupuk ? getBotolPerDus(item.jenisPupuk) : 20;
            const pengambilan = parseFloat(item.pengambilanZAK) || 0;
            return {
              nomorSubDO: item.nomorSubDO,
              nomorPO: item.nomorPO,
              jenisPupuk: item.jenisPupuk,
              party: item.party,
              pengambilanZAK: pengambilan,
              bobotPerUnit: item.bobotPerUnit,
              totalKG: itemIsDusBotol ? (pengambilan / botolPerDus) * (item.bobotPerUnit || 50) : pengambilan * item.bobotPerUnit,
              sisa: item.sisa,
              fot: item.fot,
              nomorPI: item.nomorPI || null,
              namaCustomer: item.namaCustomer || null,
            };
          }),
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

        const allPIs = items.map((it) => it.nomorPI).filter((v, i, a) => a.indexOf(v) === i);
        const allCustomers = items.map((it) => it.namaCustomer).filter((v, i, a) => a.indexOf(v) === i);
        if (allPIs.length > 0) {
          suratData.nomorPI = allPIs;
          suratData.namaCustomer = allCustomers;
        }
        if (isDikuasakan) {
          const firstItem = items.find((it) => it.nomorPI.trim() !== "");
          if (firstItem) {
            suratData.kepadaNama = firstItem.namaCustomer || "";
            suratData.kepadaPerusahaan = firstItem.namaCustomer || "";
          }
        }

        const suratRef = doc(collection(db, "suratPengangkutan"));
        transaction.set(suratRef, suratData);

        const transaksiData: any = {
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

        if (allPIs.length > 0) {
          transaksiData.nomorPI = allPIs;
          transaksiData.namaCustomer = allCustomers;
        }

        const transaksiRef = doc(collection(db, "transaksiBarangKeluar"));
        transaction.set(transaksiRef, transaksiData);
      });

      setPendingNomorSeri("");
      setSuccessMessage(`Surat pengangkutan berhasil dibuat!`);
      resetForm();
      fetchExistingSurat();
      fetchStockGudang();
      fetchDO();
      fetchSuratDO();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      if (nomorSeri) {
        if (jenisSurat === "gudangInduk") {
          await releaseSeriSP(nomorSeri);
        } else if (jenisSurat === "do") {
          await releaseSeriDO(nomorSeri);
        }
      }
      setPendingNomorSeri("");
      console.error(error);
      setFieldError("submit", error.message || "Gagal menyimpan surat pengangkutan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    if (pendingNomorSeri) {
      if (jenisSurat === "gudangInduk") {
        releaseSeriSP(pendingNomorSeri);
      } else if (jenisSurat === "do") {
        releaseSeriDO(pendingNomorSeri);
      }
      setPendingNomorSeri("");
    }
    setFormData({
      tanggal: new Date().toISOString().split("T")[0],
      namaKabupaten: "Lamandau",
      nomorPolisi: "",
      driverUnit: "",
      nomorSIM: "",
      kepadaNama: "",
      kepadaPerusahaan: "",
      kepadaAlamat: "",
    });
    setItems([]);
    setPiSearchMap({});
    setPiProductStatus({});
    setPiFullyLoadedMap({});
    setPiShowMap({});
    setErrors({});
    if (urlNomorPI) {
      router.replace("/dashboard/surat-pengangkutan");
    }
  };

  const handlePrintPDF = async () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const nomorSeri = "PREVIEW-" + Date.now();
    const isGI = jenisSurat === "gudangInduk";
    const isDikuasakan = subJenisDO === "dikuasakan";
    const isMandiri = subJenisDO === "mandiri";

    const itemsHtml = items
      .map(
        (item, idx) =>
          `<tr>` +
          `<td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${idx + 1}</td>` +
          (!isGI && !isDikuasakan ? `<td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${item.nomorSubDO || "-"}</td>` : "") +
          `<td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${isGI || isDikuasakan ? (item.nomorPI || "-") : (item.nomorPO || "-")}</td>` +
          `<td style="padding:6px 8px;font-size:10px;border:1px solid #000;vertical-align:top;font-weight:600;">${item.jenisPupuk || ""}</td>` +
          (!isDikuasakan ? `<td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${item.party || "-"}</td>` : "") +
          `<td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${item.pengambilanZAK || "-"} ZAK</td>` +
          `<td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${item.sisa || "-"}</td>` +
          `</tr>`
      )
      .join("");

    const piNumbers = items.map((it) => it.nomorPI).filter((v, i, a) => a.indexOf(v) === i).join(", ");

    let recipientBox = "";
    if (jenisSurat === "gudangInduk") {
      recipientBox = `<div class="recipient-box"><p class="recipient-title">Kepada Yth :</p><p class="recipient-name">Bapak Kepala Gudang Induk</p><p class="recipient-name">PT Bukit Agrochemical Baru</p><p class="recipient-address">Desa Sungai Rangit<br>Pangkalan Lada, Kalimantan Tengah</p></div>`;
    } else if (isDikuasakan) {
      const firstItem = items.find((it) => it.nomorPI.trim() !== "");
      const customerName = firstItem?.namaCustomer || "";
      recipientBox = `<div class="recipient-box"><p class="recipient-title">Kepada Yth :</p><p class="recipient-name">${customerName}</p><p class="recipient-name">${customerName}</p></div>`;
    } else {
      recipientBox = `<div class="recipient-box"><p class="recipient-title">Kepada Yth :</p><p class="recipient-name">${formData.kepadaNama || ""}</p><p class="recipient-name">${formData.kepadaPerusahaan || ""}</p><p class="recipient-address">${(formData.kepadaAlamat || "").split("\n").join("<br>")}</p></div>`;
    }

    const unitAngkutanHtml = isGI || isMandiri
      ? `<div class="table-section"><div class="table-title">DATA UNIT ANGKUTAN</div><table class="data-table"><tbody>` +
        `<tr><td style="padding:6px 8px;font-size:10px;border:1px solid #000;font-weight:600;width:120px;">NO. POLISI :</td><td style="padding:6px 8px;font-size:10px;border:1px solid #000;">${formData.nomorPolisi}</td></tr>` +
        `<tr><td style="padding:6px 8px;font-size:10px;border:1px solid #000;font-weight:600;">DRIVER UNIT :</td><td style="padding:6px 8px;font-size:10px;border:1px solid #000;">${formData.driverUnit}</td></tr>` +
        `<tr><td style="padding:6px 8px;font-size:10px;border:1px solid #000;font-weight:600;">NOMOR SIM :</td><td style="padding:6px 8px;font-size:10px;border:1px solid #000;">${formData.nomorSIM || "-"}</td></tr>` +
        `</tbody></table></div>`
      : "";

    const html =
      `<!DOCTYPE html><html><head><title>Surat Pengangkutan ${nomorSeri}</title>` +
      `<style>` +
      `@page { size: A4; margin: 10mm 12mm 10mm 12mm; }` +
      `@media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }` +
      `* { box-sizing: border-box; margin: 0; padding: 0; }` +
      `body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #000; }` +
      `.page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; }` +
      `.header-img { width: 100%; display: block; margin-bottom: 0; }` +
      `.title-bar { text-align: center; background: #15803d; color: white; padding: 8px 0; margin: 8px 0 12px 0; font-weight: bold; font-size: 14px; letter-spacing: 2px; }` +
      `.info-section { margin-bottom: 12px; }` +
      `.info-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px; }` +
      `.info-label { font-weight: 600; }` +
      `.recipient-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; }` +
      `.recipient-title { font-size: 9px; color: #333; margin-bottom: 2px; }` +
      `.recipient-name { font-size: 11px; font-weight: 700; }` +
      `.recipient-address { font-size: 9px; color: #333; line-height: 1.5; margin-top: 2px; }` +
      `.salutation { font-size: 10px; margin-bottom: 8px; }` +
      `.salutation p { margin-bottom: 2px; }` +
      `.table-section { margin-bottom: 10px; }` +
      `.table-title { text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; }` +
      `.data-table { width: 100%; border-collapse: collapse; }` +
      `.data-table th { background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; }` +
      `.data-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: top; }` +
      `.notes-section { margin-top: 10px; font-size: 9px; }` +
      `.notes-section p { margin-bottom: 2px; }` +
      `.signature-row { display: flex; justify-content: space-between; margin-top: 20px; }` +
      `.signature-box { width: 45%; text-align: center; }` +
      `.signature-title { font-size: 9px; margin-bottom: 30px; }` +
      `.signature-img { height: 50px; object-fit: contain; margin: 0 auto; display: block; }` +
      `.signature-name { font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block; }` +
      `.footer-img { width: 100%; display: block; margin-top: 10px; }` +
      `.print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }` +
      `.print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }` +
      `@media print { .print-bar { display: none !important; } }` +
      `</style></head><body>` +
      `<div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>` +
      `<div class="page">` +
      `<img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display='none'" />` +
      `<div class="title-bar">SURAT PENGANGKUTAN</div>` +
      `<div class="info-section">` +
      `<div class="info-row"><span>${formData.namaKabupaten}, ${new Date(formData.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>` +
      `<div class="info-row"><span class="info-label">Nomor Seri : ${nomorSeri}</span></div>` +
      (piNumbers ? `<div class="info-row"><span class="info-label">Nomor PI : ${piNumbers}</span></div>` : "") +
      `</div>` +
      recipientBox +
      `<div class="salutation"><p>Dengan Hormat,</p><p>Dengan ini mohon dimuatkan pupuk dengan rincian sebagai berikut :</p></div>` +
      `<div class="table-section"><div class="table-title">DASAR PENGANGKUTAN</div>` +
      `<table class="data-table"><thead><tr>` +
      `<th style="width:30px;">NO</th>` +
      (!isGI && !isDikuasakan ? `<th style="width:100px;">NOMOR SUB DO</th>` : "") +
      `<th style="width:100px;">${isGI || isDikuasakan ? "NOMOR PI" : "NOMOR PO"}</th>` +
      `<th>JENIS PUPUK</th>` +
      (!isDikuasakan ? `<th style="width:60px;">PARTY</th>` : "") +
      `<th style="width:100px;">PENGAMBILAN<br>${items.some((it) => it.bobotPerUnit === 1 && it.jenisPupuk && isDusOrBotolProduct(it.jenisPupuk)) ? "BOTOL" : "ZAK"}</th>` +
      `<th style="width:60px;">SISA</th>` +
      `</tr></thead><tbody>${itemsHtml}</tbody></table></div>` +
      unitAngkutanHtml +
      `<div class="notes-section"><p style="font-weight:700;">Notes :</p><p>- Jika terdapat coretan / tip-ex Sub DO dianggap batal.</p><p>- Sub DO berlaku selama 3 hari dari tanggal Sub DO diterbitkan.</p><p>- Untuk konfirmasi dengan Customer Service kami, silahkan scan QRcode di atas.</p></div>` +
      `<div class="signature-row">` +
      `<div class="signature-box"><p class="signature-title">Hormat Kami,<br>PT. BUKIT AGROCHEMICAL BARU</p><img src="/Picture2.png" alt="TTD" class="signature-img" onerror="this.style.display='none'" /><p class="signature-name">HENDRA PRAMASYANTO</p></div>` +
      `<div class="signature-box"><p class="signature-title">Diangkut oleh,<br>Driver</p><div style="height:50px;"></div><p class="signature-name">${formData.driverUnit || ""}</p></div>` +
      `</div>` +
      `<img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display='none'" />` +
      `</div></body></html>`;

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

        {isMandiri && (
          <Card title="Informasi Penerima">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Kepada Yth (Nama)" type="text" name="kepadaNama" value={formData.kepadaNama} onChange={handleChange} placeholder="Contoh: Bapak Kepala Gudang" error={errors.kepadaNama} required />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Nama Perusahaan <span className="text-red-500">*</span></label>
                <select name="kepadaPerusahaan" value={formData.kepadaPerusahaan} onChange={handlePerusahaanChange} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white ${errors.kepadaPerusahaan ? "border-red-500" : "border-gray-300"}`}>
                  <option value="">Pilih perusahaan...</option>
                  {fotList.map((fot) => (<option key={fot.id} value={fot.namaFOT}>{fot.namaFOT}</option>))}
                </select>
                {errors.kepadaPerusahaan && <p className="mt-1 text-sm text-red-600">{errors.kepadaPerusahaan}</p>}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Alamat</label>
                <input type="text" name="kepadaAlamat" value={formData.kepadaAlamat} readOnly className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 text-sm" />
              </div>
            </div>
          </Card>
        )}

        <Card title="Dasar Pengangkutan">
          <div className="space-y-4">
            {errors.items && (
              <p className="text-sm text-red-600">{errors.items}</p>
            )}
            {items.map((item, idx) => {
              const searchVal = piSearchMap[item.id] || "";
              const showSearch = piShowMap[item.id] || false;
              const filteredPI = getPIAvailableForItem(searchVal, item.id);
              const selectedPI = piList.find((p) => p.nomorPI === item.nomorPI);
              const doItemForFilter = item.nomorSubDO ? doList.find((d) => d.nomorSubDO === item.nomorSubDO) : null;
              const validProducts = selectedPI ? getValidProductsForPI(selectedPI, doItemForFilter?.fot) : [];
              return (
                <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
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
                    {isMandiri && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nomor SUB DO <span className="text-red-500">*</span></label>
                          <select
                            value={item.nomorSubDO}
                            onChange={(e) => handleSubDOSelect(item.id, e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500 ${errors[`nomorSubDO_${item.id}`] || errors[`nomorSubDO_${idx}`] ? "border-red-500" : "border-gray-300"}`}
                          >
                            <option value="">Pilih DO...</option>
                            {getAvailableDO(item.id).map((doItem) => (
                              <option key={doItem.id} value={doItem.nomorSubDO}>
                                {doItem.nomorSubDO} - {doItem.nomorPO} - {doItem.namaProduk} (Sisa: {getSisaDO(doItem).toLocaleString()} KG)
                              </option>
                            ))}
                          </select>
                          {getAvailableDO(item.id).length === 0 && (
                            <p className="mt-1 text-xs text-amber-600">
                              {item.nomorPI && item.jenisPupuk
                                ? "Tidak ada DO yang tersedia dengan produk yang sesuai, atau DO sudah kadaluarsa."
                                : "Tidak ada DO yang tersedia (sudah habis, kadaluarsa, atau tidak ada sisa)."}
                            </p>
                          )}
                          {errors[`nomorSubDO_${item.id}`] && <p className="mt-1 text-sm text-red-600">{errors[`nomorSubDO_${item.id}`]}</p>}
                        </div>
                        <Input label="Nomor PO" type="text" value={item.nomorPO} readOnly />
                      </>
                    )}
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Cari Proforma Invoice</label>
                      <div
                        ref={(el) => { itemSearchRefs.current[item.id] = el; }}
                        className="relative"
                      >
                        <input
                          type="text"
                          value={searchVal}
                          onChange={(e) => {
                            setPiSearchMap((prev) => ({ ...prev, [item.id]: e.target.value }));
                            setPiShowMap((prev) => ({ ...prev, [item.id]: true }));
                          }}
                          onFocus={() => setPiShowMap((prev) => ({ ...prev, [item.id]: true }))}
                          onBlur={() => {
                            setTimeout(() => {
                              setPiShowMap((prev) => ({ ...prev, [item.id]: false }));
                            }, 200);
                          }}
                          placeholder="Ketik nomor PI atau nama customer..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white"
                        />
                        {showSearch && (
                          <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[300px] overflow-y-auto overflow-x-hidden" onMouseDown={(e) => e.preventDefault()}>
                            {filteredPI.length === 0 ? (
                              <div className="p-4 text-sm text-gray-500">{searchVal ? "Tidak ada PI yang cocok" : "Tidak ada PI yang tersedia"}</div>
                            ) : (
                              filteredPI.map((pi) => {
                                return (
                                  <button
                                    key={pi.id}
                                    type="button"
                                    onClick={() => handlePISelectForItem(item.id, pi)}
                                    className="w-full text-left px-4 py-3 hover:bg-green-50 transition-colors border-b border-gray-100 last:border-0 block"
                                  >
                                    <p className="font-semibold text-gray-800">{pi.nomorPI}</p>
                                    <p className="text-sm text-gray-500">{pi.namaCustomer} | {pi.tanggal}</p>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                      {errors[`nomorPI_${item.id}`] && <p className="mt-1 text-sm text-red-600">{errors[`nomorPI_${item.id}`]}</p>}
                      {selectedPI && (
                        <div className="mt-2 p-2 bg-green-50 rounded-lg border border-green-200 text-xs text-green-700">
                          <span className="font-semibold">{selectedPI.nomorPI}</span> — {selectedPI.namaCustomer}
                        </div>
                      )}
                    </div>
                    {selectedPI && validProducts.length > 0 && (
                      <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Pilih Produk dari PI</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                          {validProducts.filter((prod) => piProductStatus[selectedPI.nomorPI]?.[prod.namaProduk]?.status !== "complete").map((prod, pidx) => {
                            const isSelected = item.jenisPupuk === prod.namaProduk;
                            const alreadySelectedItem = isProductAlreadySelected(item.id, selectedPI.nomorPI, prod.namaProduk);
                            const isDisabled = !!alreadySelectedItem;
                            const prodIsDusBotol = isDusOrBotolProduct(prod.namaProduk);
                            const prodBotolPerDus = getBotolPerDus(prod.namaProduk);
                            let displayQty = prod.kuantitas || 0;
                            let displayUnit = prod.satuan || "KG";
                            if (prod.satuan === "DUS" && prodIsDusBotol) {
                              displayQty = displayQty * prodBotolPerDus;
                              displayUnit = "BOTOL";
                            }
                            return (
                              <button
                                key={pidx}
                                type="button"
                                onClick={() => {
                                  if (!isDisabled) handleProdukSelectForItem(item.id, selectedPI, prod);
                                }}
                                disabled={isDisabled}
                                className={`p-3 rounded-lg border text-left transition-all ${
                                  isSelected
                                    ? "bg-green-100 border-green-500 ring-1 ring-green-500"
                                    : isDisabled
                                    ? "bg-gray-100 border-gray-300 cursor-not-allowed opacity-60"
                                    : "bg-white border-gray-200 hover:border-green-300"
                                }`}
                              >
                                <p className={`font-semibold text-sm ${isDisabled ? "text-gray-500" : "text-gray-800"}`}>{prod.namaProduk}</p>
                                <p className="text-xs text-gray-500">FOT: {prod.fot || "-"}</p>
                                <p className="text-xs text-gray-500">Order: {displayQty.toLocaleString()} {displayUnit}</p>
                                {isDisabled && (
                                  <p className="text-xs text-red-500 mt-1 font-medium">Sudah dipilih di Item {items.findIndex((it) => it.id === alreadySelectedItem!.id) + 1}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {selectedPI && validProducts.length === 0 && (
                      <div className="md:col-span-3 p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-600">
                        {isGI ? "PI ini tidak memiliki produk dengan FOT Gudang Induk." : item.nomorSubDO ? "PI ini tidak memiliki produk dengan FOT yang sesuai dengan DO yang dipilih." : "PI ini tidak memiliki produk dengan FOT selain Gudang Induk."}
                      </div>
                    )}
                    <div className="md:col-span-3">
                      <Input label="Jenis Pupuk" type="text" value={item.jenisPupuk} onChange={(e) => handleItemChange(item.id, "jenisPupuk", e.target.value)} placeholder="Pilih produk dari PI atau DO" error={errors[`jenisPupuk_${item.id}`] || errors[`jenisPupuk_${idx}`]} required readOnly />
                    </div>
                    {isMandiri && (
                      <Input label="Party" type="text" value={item.party} readOnly />
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Pengambilan ({item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk) ? "BOTOL" : "ZAK"}){item.maxZAK > 0 ? ` - Max: ${item.maxZAK}` : ""}
                      </label>
                      <input
                        type="number"
                        value={item.pengambilanZAK}
                        onChange={(e) => handleItemChange(item.id, "pengambilanZAK", e.target.value)}
                        placeholder={item.maxZAK > 0 ? `Max ${item.maxZAK} ${item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk) ? "BOTOL" : "ZAK"}` : "Sisa habis"}
                        max={item.maxZAK > 0 ? item.maxZAK : undefined}
                        onWheel={(e) => { e.currentTarget.blur(); }}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white"
                      />
                      {item.bobotPerUnit > 0 && item.pengambilanZAK && item.bobotPerUnit !== 1 && (
                        <p className="mt-1 text-xs text-gray-500">
                          = {(parseFloat(item.pengambilanZAK || "0") * item.bobotPerUnit).toLocaleString()} KG (bobot: {item.bobotPerUnit} KG/ZAK)
                        </p>
                      )}
                    </div>
                    <div>
                      <Input label="Sisa" type="text" value={item.sisa} onChange={(e) => handleItemChange(item.id, "sisa", e.target.value)} placeholder="Auto-calculate" readOnly />
                      {item.bobotPerUnit > 0 && item.sisa && (
                        <p className="mt-1 text-xs text-gray-500">
                          = {(parseFloat(item.sisa || "0") * item.bobotPerUnit).toLocaleString()} KG
                        </p>
                      )}
                    </div>
                    {item.nomorSubDO && item.doPartyKG > 0 && (
                      <div className="md:col-span-3 p-3 bg-green-50 rounded-lg border border-green-200">
                        <p className="text-xs font-semibold text-green-800 mb-1">Info DO</p>
                        <div className="flex justify-between text-xs text-green-700">
                          <span>Party DO: <strong>{item.doPartyKG.toLocaleString()} KG</strong></span>
                          <span>Sudah Dimuat DO: <strong>{item.doLoadedKG.toLocaleString()} KG</strong></span>
                          <span>Sisa DO: <strong>{Math.max(0, item.doPartyKG - item.doLoadedKG).toLocaleString()} KG</strong></span>
                        </div>
                      </div>
                    )}
                    {item.nomorPI && item.piKuantitas > 0 && (
                      <div className="md:col-span-3 p-3 bg-purple-50 rounded-lg border border-purple-200">
                        <p className="text-xs font-semibold text-purple-800 mb-1">Info PI</p>
                        <div className="flex justify-between text-xs text-purple-700">
                          <span>Total PI: <strong>{item.piKuantitas.toLocaleString()} {item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk) ? "BOTOL" : "KG"}</strong></span>
                          <span>Sudah Dimuat PI: <strong>{item.piLoadedKG.toLocaleString()} {item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk) ? "BOTOL" : "KG"}</strong></span>
                          <span>Sisa PI: <strong>{Math.max(0, item.piKuantitas - item.piLoadedKG).toLocaleString()} {item.bobotPerUnit === 1 && item.jenisPupuk && isDusOrBotolProduct(item.jenisPupuk) ? "BOTOL" : "KG"}</strong></span>
                        </div>
                        {!isDusOrBotolProduct(item.jenisPupuk) && item.bobotPerUnit > 0 && (
                          <p className="mt-1 text-xs text-purple-600">
                            = {Math.floor(item.piKuantitas / item.bobotPerUnit).toLocaleString()} ZAK (bobot: {item.bobotPerUnit} KG/ZAK)
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {(errors[`pengambilan_${item.id}`] || errors[`pengambilan_${idx}`]) && (
                    <p className="mt-2 text-sm text-red-600">{errors[`pengambilan_${item.id}`] || errors[`pengambilan_${idx}`]}</p>
                  )}
                </div>
              );
            })}
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