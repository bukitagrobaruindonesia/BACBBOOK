"use client";

import React, { useState, useEffect } from "react";
import {
  collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, getDoc, where, runTransaction, Timestamp,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Table from "@/app/components/ui/Table";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Card from "@/app/components/ui/Card";
import * as XLSX from "xlsx-js-style";

interface BarangRusakItem {
  unit: string;
  jumlah: number;
  keterangan: string;
  fotoUrls: string[];
  status: string;
  tanggalPenggantian: string;
  jumlahPenggantian: number;
  penggantianFotoUrls: string[];
}

interface UnifiedTransaksi {
  id: string;
  jenis: string;
  tanggal: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  jumlahZAK: number;
  totalKG?: number;
  fot: string;
  createdBy: string;
  createdAt?: Date;
  namaCustomer?: string;
  nomorPI?: string;
  nomorInvoice?: string;
  nomorSuratPengangkutan?: string;
  nomorSeri?: string;
  driverUnit?: string;
  nomorPolisi?: string;
  nomorSIM?: string;
  botolPerDus?: number;
  bobotPerBotol?: number;
  items?: Array<{
    nomorSubDO: string;
    nomorPO: string;
    jenisPupuk: string;
    party: string;
    pengambilanZAK: number;
    bobotPerUnit: number;
    totalKG: number;
    sisa: string;
    nomorPI?: string;
    fot?: string;
  }>;
  backupItems?: Array<{
    stockId: string;
    kodeBarang: string;
    namaBarang: string;
    unit: string;
    bobotPerUnit: number;
    botolPerDus: number;
    pengambilanUnit: number;
    totalKG: number;
    nomorPI: string;
  }>;
  totalPengambilanKG?: number;
  nomorPIList?: string[];
  nomorKontainer?: string;
  nomorDO?: string;
  fotoUrls?: string[];
  barangRusak?: BarangRusakItem[];
  adaBarangRusak?: boolean;
  sopirNopolList?: Array<{
    namaSopir: string | null;
    nopol: string | null;
    nomorSIM: string | null;
  }>;
  jenisSurat?: string;
  subJenisDO?: string;
  kepadaNama?: string;
  kepadaPerusahaan?: string;
  kepadaAlamat?: string;
  isPenggantianRusak?: boolean;
  referensiTransaksiId?: string;
  referensiRusakIndex?: number;
}

interface StockItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  bobotPerUnit: number;
  stokAkhirUnit: number;
  stokAkhirKG: number;
  barangKeluarUnit: number;
  barangKeluarKG: number;
  barangMasukUnit: number;
  barangMasukKG: number;
  unit?: string;
  botolPerDus?: number;
}

interface ProformaInvoiceItem {
  id: string;
  nomorPI: string;
  produkItems: Array<{ namaProduk: string; kuantitas: number; satuan?: string; fot?: string }>;
  sisaPengambilanKG?: number;
  statusPengangkutan?: string;
}

interface ExistingSurat {
  id: string;
  nomorSeri: string;
}

interface TTDData {
  id: string;
  nama: string;
  jabatan: string;
  ttdImage: string;
}

const getRomanMonth = (month: number) => {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[month - 1] || "I";
};

const sanitizeLockDocId = (nomorSeri: string) => {
  return nomorSeri.replace(/\//g, "-");
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

const parseNomorSeri = (nomorSeri: string) => {
  const parts = nomorSeri.split("/");
  if (parts.length !== 4) return null;
  const prefix = parts[0];
  const year = parseInt(parts[1]);
  const roman = parts[2];
  const urut = parseInt(parts[3]);
  if (prefix !== "BAGB-SP" || isNaN(year) || isNaN(urut)) return null;
  return { prefix, year, roman, urut };
};

const validateNomorSeriFormat = (value: string) => {
  const giRegex = new RegExp("^BAGB-SP/\d{4}/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)/\d{4}$");
  const doRegex = new RegExp("^BAGB-SP-DO.+-.{4}$");
  return giRegex.test(value.trim()) || doRegex.test(value.trim());
};

const isDusOrBotolProduct = (stockList: StockItem[], namaProduk: string) => {
  const stock = stockList.find((s) =>
    s.namaBarang.toUpperCase().includes(namaProduk.toUpperCase()) ||
    namaProduk.toUpperCase().includes(s.namaBarang.toUpperCase())
  );
  return stock ? (stock.unit === "DUS" || stock.unit === "BOTOL") : false;
};

const getBotolPerDus = (stockList: StockItem[], namaProduk: string) => {
  const stock = stockList.find((s) =>
    s.namaBarang.toUpperCase().includes(namaProduk.toUpperCase()) ||
    namaProduk.toUpperCase().includes(s.namaBarang.toUpperCase())
  );
  return stock ? (stock.botolPerDus || 20) : 20;
};

const formatDusDisplay = (dusCount: number, botolPerDus: number) => {
  if (dusCount <= 0) return "0 DUS";
  const totalBotol = dusCount * botolPerDus;
  return `${dusCount} DUS (${totalBotol} botol)`;
};

export default function RiwayatTransaksiPage() {
  const { user } = useAuth();
  const [data, setData] = useState<UnifiedTransaksi[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterJenis, setFilterJenis] = useState<string>("semua");
  const [filterFot, setFilterFot] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [selectedItem, setSelectedItem] = useState<UnifiedTransaksi | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fotList, setFotList] = useState<string[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [piList, setPiList] = useState<ProformaInvoiceItem[]>([]);
  const [existingSuratList, setExistingSuratList] = useState<ExistingSurat[]>([]);
  const [nomorSeriError, setNomorSeriError] = useState("");
  const [selectedFotoIndex, setSelectedFotoIndex] = useState<number | null>(null);
  const [selectedRusakFoto, setSelectedRusakFoto] = useState<{ urls: string[]; index: number } | null>(null);
  const [ttdList, setTtdList] = useState<TTDData[]>([]);

  const [editForm, setEditForm] = useState({
    tanggal: "",
    kodeBarang: "",
    namaBarang: "",
    unit: "ZAK" as "ZAK" | "DUS" | "KG" | "BOTOL",
    jumlahZAK: "",
    botolPerDus: "",
    bobotPerBotol: "",
    namaCustomer: "",
    nomorPI: "",
    nomorInvoice: "",
    nomorSuratPengangkutan: "",
    fot: "",
    sopirNopol: "",
    nomorKontainer: "",
    nomorDO: "",
  });

  const [editSuratForm, setEditSuratForm] = useState({
    tanggal: "",
    nomorSeri: "",
    nomorPolisi: "",
    driverUnit: "",
    nomorSIM: "",
    items: [] as Array<{
      nomorSubDO: string;
      nomorPO: string;
      jenisPupuk: string;
      party: string;
      pengambilanZAK: string;
      bobotPerUnit: number;
      sisa: string;
      maxZAK: number;
      fot: string;
      nomorPI: string;
    }>,
  });

  useEffect(() => {
    fetchData();
    fetchStockGudang();
    fetchProformaInvoice();
    fetchExistingSurat();
    fetchTTD();
  }, []);

  useEffect(() => {
    if (isEditModalOpen) {
      const timer = setTimeout(() => {
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
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isEditModalOpen, editForm, editSuratForm]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const masukQuery = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const masukSnapshot = await getDocs(masukQuery);
      const masukData = masukSnapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          jenis: d.isPenggantianRusak ? "penggantianRusak" : "barangMasuk",
          tanggal: d.tanggal,
          kodeBarang: d.kodeBarang || "",
          namaBarang: d.namaBarang || "",
          unit: d.unit || "ZAK",
          jumlahZAK: d.jumlahZAK || 0,
          totalKG: d.totalKG || 0,
          fot: d.fot || "",
          createdBy: d.createdBy || "",
          createdAt: d.createdAt?.toDate(),
          sopirNopolList: d.sopirNopolList || null,
          botolPerDus: d.botolPerDus,
          bobotPerBotol: d.bobotPerBotol,
          nomorKontainer: d.nomorKontainer || "",
          nomorDO: d.nomorDO || "",
          fotoUrls: d.fotoUrls || null,
          barangRusak: d.barangRusak ? d.barangRusak.map((r: any) => ({
              unit: r.unit || "",
              jumlah: r.jumlah || 0,
              keterangan: r.keterangan || "",
              fotoUrls: r.fotoUrls || [],
              status: r.status || "belum diganti",
              tanggalPenggantian: r.tanggalPenggantian || "",
              jumlahPenggantian: r.jumlahPenggantian || 0,
              penggantianFotoUrls: r.penggantianFotoUrls || [],
            })) : null,
          adaBarangRusak: d.adaBarangRusak || false,
          isPenggantianRusak: d.isPenggantianRusak || false,
          referensiTransaksiId: d.referensiTransaksiId || "",
          referensiRusakIndex: d.referensiRusakIndex,
        } as UnifiedTransaksi;
      });

      const keluarQuery = query(collection(db, "transaksiBarangKeluar"), orderBy("createdAt", "desc"));
      const keluarSnapshot = await getDocs(keluarQuery);
      const keluarData = keluarSnapshot.docs.map((doc) => {
        const d = doc.data();
        const jenis = d.jenis || "barangKeluar";
        const isSurat = jenis === "suratPengangkutanGudangInduk" || jenis === "suratPengangkutanDO";
        const isBackup = jenis === "barangKeluarBackup";

        let fotValue = d.fot || "";
        if (isSurat && d.items && d.items.length > 0) {
          const itemFots = d.items.map((it: any) => it.fot).filter((f: string) => f && f.trim());
          if (itemFots.length > 0) {
            fotValue = itemFots[0];
          }
        }

        let namaBarangValue = d.namaBarang || "";
        let kodeBarangValue = d.kodeBarang || "";
        let unitValue = d.unit || "ZAK";
        let jumlahZAKValue = d.jumlahZAK || 0;

        if (isSurat && d.items && d.items.length > 0) {
          const firstItem = d.items[0];
          namaBarangValue = firstItem.jenisPupuk || "";
          unitValue = firstItem.bobotPerUnit === 1 ? "BOTOL" : "ZAK";
        }

        if (isBackup && d.items && d.items.length > 0) {
          namaBarangValue = d.items.map((it: any) => it.namaBarang).join(", ");
          kodeBarangValue = d.items.map((it: any) => it.kodeBarang).join(", ");
          unitValue = d.items[0].unit || "ZAK";
          jumlahZAKValue = d.items.reduce((sum: number, it: any) => sum + (it.pengambilanUnit || 0), 0);
        }

        return {
          id: doc.id,
          jenis: jenis,
          tanggal: d.tanggal,
          kodeBarang: kodeBarangValue,
          namaBarang: namaBarangValue,
          unit: unitValue,
          jumlahZAK: jumlahZAKValue,
          fot: fotValue,
          createdBy: d.createdBy,
          createdAt: d.createdAt?.toDate(),
          namaCustomer: d.namaCustomer,
          nomorPI: d.nomorPI,
          nomorInvoice: d.nomorInvoice,
          nomorSuratPengangkutan: d.nomorSuratPengangkutan,
          botolPerDus: d.botolPerDus,
          bobotPerBotol: d.bobotPerBotol,
          nomorSeri: d.nomorSeri,
          items: d.items && !isBackup ? d.items.map((it: any) => ({
            nomorSubDO: it.nomorSubDO || "",
            nomorPO: it.nomorPO || "",
            jenisPupuk: it.jenisPupuk || "",
            party: it.party || "",
            pengambilanZAK: it.pengambilanZAK || 0,
            bobotPerUnit: it.bobotPerUnit || 50,
            totalKG: it.totalKG || 0,
            sisa: it.sisa || "",
            nomorPI: it.nomorPI || "",
            fot: it.fot || "",
          })) : [],
          backupItems: isBackup && d.items ? d.items.map((it: any) => ({
            stockId: it.stockId || "",
            kodeBarang: it.kodeBarang || "",
            namaBarang: it.namaBarang || "",
            unit: it.unit || "ZAK",
            bobotPerUnit: it.bobotPerUnit || 50,
            botolPerDus: it.botolPerDus || 20,
            pengambilanUnit: it.pengambilanUnit || 0,
            totalKG: it.totalKG || 0,
            nomorPI: it.nomorPI || "",
          })) : [],
          totalPengambilanKG: d.totalPengambilanKG,
          nomorPIList: Array.isArray(d.nomorPI) ? d.nomorPI : (d.nomorPI ? [d.nomorPI] : []),
          driverUnit: d.driverUnit,
          nomorPolisi: d.nomorPolisi,
          nomorSIM: d.nomorSIM,
          jenisSurat: d.jenisSurat || "gudangInduk",
          subJenisDO: d.subJenisDO || "",
          kepadaNama: d.kepadaNama || "",
          kepadaPerusahaan: d.kepadaPerusahaan || "",
          kepadaAlamat: d.kepadaAlamat || "",
          fotoUrls: d.fotoUrls || [],
        } as UnifiedTransaksi;
      });

      const allData = [...masukData, ...keluarData].sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setData(allData);
      const fotSet = new Set<string>();
      allData.forEach((item) => {
        if (item.fot && item.fot.trim()) fotSet.add(item.fot.trim().toUpperCase());
        if (item.items) {
          item.items.forEach((it) => {
            if (it.fot && it.fot.trim()) fotSet.add(it.fot.trim().toUpperCase());
          });
        }
      });
      setFotList(Array.from(fotSet).sort());
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        stokAkhirUnit: doc.data().stokAkhirUnit || 0,
        stokAkhirKG: doc.data().stokAkhirKG || 0,
        barangKeluarUnit: doc.data().barangKeluarUnit || 0,
        barangKeluarKG: doc.data().barangKeluarKG || 0,
        barangMasukUnit: doc.data().barangMasukUnit || 0,
        barangMasukKG: doc.data().barangMasukKG || 0,
        unit: doc.data().unit || "ZAK",
        botolPerDus: doc.data().botolPerDus || doc.data().jumlahIsiBotol || 20,
      } as StockItem));
      setStockList(data);
    } catch (error) { console.error(error); }
  };

  const fetchProformaInvoice = async () => {
    try {
      const q = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        nomorPI: doc.data().nomorPI || "",
        produkItems: doc.data().produkItems || [],
        sisaPengambilanKG: doc.data().sisaPengambilanKG,
        statusPengangkutan: doc.data().statusPengangkutan,
      } as ProformaInvoiceItem));
      setPiList(data);
    } catch (error) { console.error(error); }
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

  const checkNomorSeriExists = (value: string, excludeNomorSeri?: string) => {
    if (!value.trim()) { setNomorSeriError(""); return false; }
    if (!validateNomorSeriFormat(value)) {
      setNomorSeriError("Format nomor seri tidak valid. Gunakan format: BAGB-SP/2026/V/0001");
      return true;
    }
    const exists = existingSuratList.some((s) =>
      s.nomorSeri.trim().toUpperCase() === value.trim().toUpperCase() &&
      s.nomorSeri.trim().toUpperCase() !== (excludeNomorSeri || "").trim().toUpperCase()
    );
    if (exists) {
      setNomorSeriError("Nomor seri sudah ada dalam database. Silakan gunakan nomor seri lain.");
      return true;
    }
    setNomorSeriError("");
    return false;
  };

  const getStockForProduct = (namaProduk: string) => {
    return stockList.find((s) =>
      s.namaBarang.toUpperCase().includes(namaProduk.toUpperCase()) ||
      namaProduk.toUpperCase().includes(s.namaBarang.toUpperCase())
    );
  };

  const getStockExactMatch = (kodeBarang: string, namaBarang: string) => {
    return stockList.find((s) =>
      s.kodeBarang.toUpperCase() === kodeBarang.toUpperCase() &&
      s.namaBarang.toUpperCase() === namaBarang.toUpperCase()
    );
  };

  const getPIByNomor = (nomorPI: string) => {
    return piList.find((p) => p.nomorPI === nomorPI);
  };

  const filteredData = data.filter((item) => {
    const matchSearch =
      item.kodeBarang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaBarang?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.fot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.namaCustomer && item.namaCustomer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.nomorPI && item.nomorPI.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.nomorSeri && item.nomorSeri.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.driverUnit && item.driverUnit.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.nomorKontainer && item.nomorKontainer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.nomorDO && item.nomorDO.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.items && item.items.some((it) =>
        it.jenisPupuk?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.nomorSubDO?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.nomorPO?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        it.nomorPI?.toLowerCase().includes(searchTerm.toLowerCase())
      ));

    const matchJenis = filterJenis === "semua" ? true :
      filterJenis === "suratPengangkutan" ?
        (item.jenis === "suratPengangkutanGudangInduk" || item.jenis === "suratPengangkutanDO") :
        item.jenis === filterJenis;

    const matchFot = filterFot ? (() => {
      if (item.fot?.toUpperCase() === filterFot.toUpperCase()) return true;
      if (item.items?.some((it) => it.fot?.toUpperCase() === filterFot.toUpperCase())) return true;
      return false;
    })() : true;

    const matchBulanTahun = (() => {
      if (!filterBulan && !filterTahun) return true;
      const date = item.tanggal ? new Date(item.tanggal) : new Date();
      const matchBulan = filterBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === filterBulan : true;
      const matchTahun = filterTahun ? date.getFullYear().toString() === filterTahun : true;
      return matchBulan && matchTahun;
    })();
    return matchSearch && matchJenis && matchFot && matchBulanTahun;
  });

  const handleDetail = (item: UnifiedTransaksi) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
    setSelectedFotoIndex(null);
    setSelectedRusakFoto(null);
  };

  const handleEdit = (item: UnifiedTransaksi) => {
    setSelectedItem(item);
    setNomorSeriError("");
    if (item.jenis === "suratPengangkutanGudangInduk" || item.jenis === "suratPengangkutanDO") {
      setEditSuratForm({
        tanggal: item.tanggal,
        nomorSeri: item.nomorSeri || "",
        nomorPolisi: item.nomorPolisi || "",
        driverUnit: item.driverUnit || "",
        nomorSIM: item.nomorSIM || "",
        items: (item.items || []).map((it) => {
          const pengambilan = it.pengambilanZAK || 0;
          const sisa = parseFloat(it.sisa || "0") || 0;
          const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
          const bobot = isDusBotol ? 1 : (it.bobotPerUnit || 50);
          return {
            nomorSubDO: it.nomorSubDO || "",
            nomorPO: it.nomorPO || "",
            jenisPupuk: it.jenisPupuk || "",
            party: it.party || "",
            pengambilanZAK: String(pengambilan),
            bobotPerUnit: bobot,
            sisa: String(sisa),
            maxZAK: pengambilan + sisa,
            fot: it.fot || "",
            nomorPI: it.nomorPI || "",
          };
        }),
      });
    } else if (item.jenis === "barangKeluarBackup") {
      setEditSuratForm({
        tanggal: item.tanggal,
        nomorSeri: item.nomorSeri || "",
        nomorPolisi: item.nomorPolisi || "",
        driverUnit: item.driverUnit || "",
        nomorSIM: item.nomorSIM || "",
        items: (item.backupItems || []).map((it) => ({
          nomorSubDO: "",
          nomorPO: "",
          jenisPupuk: it.namaBarang || "",
          party: it.kodeBarang || "",
          pengambilanZAK: String(it.pengambilanUnit || 0),
          bobotPerUnit: it.unit === "DUS" ? 1 : (it.bobotPerUnit || 50),
          sisa: "",
          maxZAK: 0,
          fot: "",
          nomorPI: it.nomorPI || "",
        })),
      });
    } else {
      setEditForm({
        tanggal: item.tanggal,
        kodeBarang: item.kodeBarang,
        namaBarang: item.namaBarang,
        unit: item.unit as "ZAK" | "DUS" | "KG" | "BOTOL",
        jumlahZAK: item.jumlahZAK.toString(),
        botolPerDus: item.botolPerDus ? item.botolPerDus.toString() : "",
        bobotPerBotol: item.bobotPerBotol ? item.bobotPerBotol.toString() : "",
        namaCustomer: item.namaCustomer || "",
        nomorPI: item.nomorPI || "",
        nomorInvoice: item.nomorInvoice || "",
        nomorSuratPengangkutan: item.nomorSuratPengangkutan || "",
        fot: item.fot,
        sopirNopol: item.driverUnit || "",
        nomorKontainer: item.nomorKontainer || "",
        nomorDO: item.nomorDO || "",
      });
    }
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      if (selectedItem.jenis === "suratPengangkutanGudangInduk" || selectedItem.jenis === "suratPengangkutanDO") {
        await handleUpdateSuratPengangkutan();
      } else if (selectedItem.jenis === "barangKeluarBackup") {
        await handleUpdateBackup();
      } else {
        await handleUpdateRegular();
      }
      setIsEditModalOpen(false);
      fetchData();
      fetchStockGudang();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleUpdateRegular = async () => {
    let collectionName = "";
    if (selectedItem!.jenis === "barangMasuk" || selectedItem!.jenis === "penggantianRusak") collectionName = "transaksiBarangMasuk";
    else collectionName = "transaksiBarangKeluar";
    const jumlahZAK = parseFloat(editForm.jumlahZAK) || 0;
    const botolPerDus = editForm.unit === "BOTOL" ? parseFloat(editForm.botolPerDus) || 0 : null;
    const bobotPerBotol = editForm.unit === "BOTOL" ? parseFloat(editForm.bobotPerBotol) || 0 : null;
    const updateData: any = {
      tanggal: editForm.tanggal,
      kodeBarang: editForm.kodeBarang,
      namaBarang: editForm.namaBarang,
      unit: editForm.unit,
      jumlahZAK: jumlahZAK,
      fot: editForm.fot.trim().toUpperCase(),
      updatedAt: serverTimestamp(),
    };
    if (selectedItem!.jenis === "barangMasuk") {
      updateData.nomorKontainer = editForm.nomorKontainer.trim().toUpperCase();
      updateData.nomorDO = editForm.nomorDO.trim().toUpperCase() || null;
    }
    if (editForm.unit === "BOTOL") {
      updateData.botolPerDus = botolPerDus;
      updateData.bobotPerBotol = bobotPerBotol;
    }
    if (selectedItem!.jenis === "barangMasuk") {
      updateData.sopirNopol = editForm.sopirNopol.trim();
      let totalKG = 0;
      if (editForm.unit === "KG") {
        totalKG = jumlahZAK;
      } else if (editForm.unit === "BOTOL") {
        const bpd = botolPerDus || 20;
        const dusPerZak = 10;
        const totalBotol = jumlahZAK * dusPerZak * bpd;
        totalKG = (totalBotol * (bobotPerBotol || 50)) / 1000;
      } else {
        const stock = getStockExactMatch(editForm.kodeBarang, editForm.namaBarang);
        totalKG = jumlahZAK * (stock?.bobotPerUnit || 50);
      }
      updateData.totalKG = totalKG;
    } else if (selectedItem!.jenis === "barangKeluar") {
      updateData.namaCustomer = editForm.namaCustomer.trim();
      updateData.nomorPI = editForm.nomorPI.trim();
      updateData.nomorInvoice = editForm.nomorInvoice.trim();
      updateData.nomorSuratPengangkutan = editForm.nomorSuratPengangkutan.trim();
    }
    await updateDoc(doc(db, collectionName, selectedItem!.id), updateData);

    if (selectedItem!.jenis === "barangMasuk") {
      const stock = getStockExactMatch(selectedItem!.kodeBarang, selectedItem!.namaBarang);
      if (stock) {
        const stockRef = doc(db, "stockGudang", stock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          const currentMasukUnit = sData.barangMasukUnit || 0;
          const currentMasukKG = sData.barangMasukKG || 0;
          const currentStokUnit = sData.stokAkhirUnit || 0;
          const currentStokKG = sData.stokAkhirKG || 0;

          const oldUnit = selectedItem!.unit === "KG" ? 0 : selectedItem!.jumlahZAK;
          const oldKG = selectedItem!.totalKG || (selectedItem!.unit === "KG" ? selectedItem!.jumlahZAK : selectedItem!.jumlahZAK * (stock.bobotPerUnit || 50));

          const newUnit = editForm.unit === "KG" ? 0 : jumlahZAK;
          let newKG = 0;
          if (editForm.unit === "KG") {
            newKG = jumlahZAK;
          } else if (editForm.unit === "BOTOL") {
            const bpd = botolPerDus || 20;
            const dusPerZak = 10;
            const totalBotol = jumlahZAK * dusPerZak * bpd;
            newKG = (totalBotol * (bobotPerBotol || 50)) / 1000;
          } else {
            newKG = jumlahZAK * (stock.bobotPerUnit || 50);
          }

          const deltaUnit = newUnit - oldUnit;
          const deltaKG = newKG - oldKG;

          await updateDoc(stockRef, {
            barangMasukUnit: Math.max(0, currentMasukUnit + deltaUnit),
            barangMasukKG: Math.max(0, currentMasukKG + deltaKG),
            stokAkhirUnit: Math.max(0, currentStokUnit + deltaUnit),
            stokAkhirKG: Math.max(0, currentStokKG + deltaKG),
            updatedAt: serverTimestamp(),
          });
        }
      }
    }
  };

  const handleUpdateBackup = async () => {
    const newNomorSeri = editSuratForm.nomorSeri.trim();
    if (checkNomorSeriExists(newNomorSeri, selectedItem!.nomorSeri)) { throw new Error("Nomor seri sudah ada"); }

    const oldItems = selectedItem!.backupItems || [];
    const newItems = editSuratForm.items.map((it) => {
      const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
      const botolPerDus = getBotolPerDus(stockList, it.jenisPupuk);
      const pengambilan = parseFloat(it.pengambilanZAK) || 0;
      return {
        stockId: "",
        kodeBarang: it.party || "",
        namaBarang: it.jenisPupuk || "",
        unit: isDusBotol ? "DUS" : "ZAK",
        bobotPerUnit: isDusBotol ? 1 : (it.bobotPerUnit || 50),
        botolPerDus: botolPerDus,
        pengambilanUnit: pengambilan,
        totalKG: isDusBotol ? 0 : pengambilan * (it.bobotPerUnit || 50),
        nomorPI: it.nomorPI || "",
      };
    });

    const totalPengambilanKG = newItems.reduce((sum, it) => sum + it.totalKG, 0);
    const updateData: any = {
      tanggal: editSuratForm.tanggal,
      nomorSeri: newNomorSeri,
      nomorPolisi: editSuratForm.nomorPolisi.trim(),
      driverUnit: editSuratForm.driverUnit.trim(),
      nomorSIM: editSuratForm.nomorSIM.trim() || null,
      items: newItems,
      totalPengambilanKG: totalPengambilanKG,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(doc(db, "transaksiBarangKeluar", selectedItem!.id), updateData);

    const productMapOld: Record<string, number> = {};
    const productMapNew: Record<string, number> = {};
    oldItems.forEach((it) => {
      const key = it.stockId || it.namaBarang;
      if (it.unit === "DUS") {
        const botolPerDus = it.botolPerDus || 20;
        productMapOld[key] = (productMapOld[key] || 0) + (it.pengambilanUnit / botolPerDus);
      } else if (it.unit === "ZAK") {
        productMapOld[key] = (productMapOld[key] || 0) + (it.pengambilanUnit * (it.bobotPerUnit || 50));
      } else {
        productMapOld[key] = (productMapOld[key] || 0) + it.pengambilanUnit;
      }
    });
    newItems.forEach((it) => {
      const key = it.namaBarang;
      if (it.unit === "DUS") {
        const botolPerDus = it.botolPerDus || 20;
        productMapNew[key] = (productMapNew[key] || 0) + (it.pengambilanUnit / botolPerDus);
      } else if (it.unit === "ZAK") {
        productMapNew[key] = (productMapNew[key] || 0) + (it.pengambilanUnit * (it.bobotPerUnit || 50));
      } else {
        productMapNew[key] = (productMapNew[key] || 0) + it.pengambilanUnit;
      }
    });

    const allProducts = new Set([...Object.keys(productMapOld), ...Object.keys(productMapNew)]);
    for (const prod of allProducts) {
      const oldVal = productMapOld[prod] || 0;
      const newVal = productMapNew[prod] || 0;
      const delta = oldVal - newVal;
      const stock = getStockForProduct(prod);
      if (stock && delta !== 0) {
        const stockRef = doc(db, "stockGudang", stock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          const currentUnit = sData.stokAkhirUnit || 0;
          const currentKG = sData.stokAkhirKG || 0;
          const currentKeluarUnit = sData.barangKeluarUnit || 0;
          const currentKeluarKG = sData.barangKeluarKG || 0;
          const isDusBotol = stock.unit === "DUS" || stock.unit === "BOTOL";
          if (isDusBotol) {
            const botolPerDus = stock.botolPerDus || 20;
            const deltaUnit = delta / botolPerDus;
            await updateDoc(stockRef, {
              stokAkhirUnit: Math.max(0, currentUnit + deltaUnit),
              stokAkhirKG: 0,
              barangKeluarUnit: Math.max(0, currentKeluarUnit - deltaUnit),
              barangKeluarKG: 0,
              updatedAt: serverTimestamp(),
            });
          } else {
            const bobot = stock.bobotPerUnit || 50;
            const deltaUnit = delta / bobot;
            await updateDoc(stockRef, {
              stokAkhirUnit: Math.max(0, currentUnit + deltaUnit),
              stokAkhirKG: Math.max(0, currentKG + delta),
              barangKeluarUnit: Math.max(0, currentKeluarUnit - deltaUnit),
              barangKeluarKG: Math.max(0, currentKeluarKG - delta),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    }
    fetchExistingSurat();
  };

  const handleUpdateSuratPengangkutan = async () => {
    const newNomorSeri = editSuratForm.nomorSeri.trim();
    if (checkNomorSeriExists(newNomorSeri, selectedItem!.nomorSeri)) { throw new Error("Nomor seri sudah ada"); }

    const oldItems = selectedItem!.items || [];
    const newItems = editSuratForm.items.map((it) => {
      const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
      const botolPerDus = getBotolPerDus(stockList, it.jenisPupuk);
      const pengambilan = parseFloat(it.pengambilanZAK) || 0;
      const bobot = isDusBotol ? 1 : (it.bobotPerUnit || 50);
      return {
        nomorSubDO: it.nomorSubDO,
        nomorPO: it.nomorPO,
        jenisPupuk: it.jenisPupuk,
        party: it.party,
        pengambilanZAK: pengambilan,
        bobotPerUnit: bobot,
        totalKG: isDusBotol ? (pengambilan / botolPerDus) * bobot : pengambilan * bobot,
        sisa: it.sisa,
        fot: it.fot || "",
        nomorPI: it.nomorPI || null,
      };
    });
    const totalPengambilanKG = newItems.reduce((sum, it) => sum + it.totalKG, 0);
    const updateData: any = {
      tanggal: editSuratForm.tanggal,
      nomorSeri: newNomorSeri,
      nomorPolisi: editSuratForm.nomorPolisi.trim(),
      driverUnit: editSuratForm.driverUnit.trim(),
      nomorSIM: editSuratForm.nomorSIM.trim() || null,
      items: newItems,
      totalPengambilanKG: totalPengambilanKG,
      updatedAt: serverTimestamp(),
    };
    const suratQuery = query(collection(db, "suratPengangkutan"), where("nomorSeri", "==", selectedItem!.nomorSeri || ""));
    const suratSnapshot = await getDocs(suratQuery);
    if (!suratSnapshot.empty) {
      await updateDoc(doc(db, "suratPengangkutan", suratSnapshot.docs[0].id), updateData);
    }
    await updateDoc(doc(db, "transaksiBarangKeluar", selectedItem!.id), {
      ...updateData,
      nomorSeri: newNomorSeri,
    });

    if (selectedItem!.jenis === "suratPengangkutanGudangInduk" && selectedItem!.nomorPI) {
      const pi = getPIByNomor(selectedItem!.nomorPI);
      if (pi) {
        const oldTotalKG = oldItems.reduce((sum, it) => {
          const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
          const botolPerDus = getBotolPerDus(stockList, it.jenisPupuk);
          if (isDusBotol) {
            return sum + ((it.pengambilanZAK || 0) / botolPerDus) * (it.bobotPerUnit || 50);
          }
          return sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
        }, 0);
        const delta = oldTotalKG - totalPengambilanKG;
        const piRef = doc(db, "proformaInvoice", pi.id);
        const piSnap = await getDoc(piRef);
        if (piSnap.exists()) {
          const piData = piSnap.data();
          const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
          const newSisa = Math.max(0, currentSisa + delta);
          const totalOrdered = pi.produkItems.reduce((sum, p) => {
            const isDusBotol = isDusOrBotolProduct(stockList, p.namaProduk);
            const botolPerDus = getBotolPerDus(stockList, p.namaProduk);
            let qty = p.kuantitas || 0;
            if (p.satuan === "DUS" && isDusBotol) {
              qty = qty * botolPerDus;
            }
            return sum + qty;
          }, 0);
          let newStatus = "pending";
          if (newSisa <= 0) newStatus = "complete";
          else if (newSisa < totalOrdered) newStatus = "partial";
          await updateDoc(piRef, {
            sisaPengambilanKG: newSisa,
            statusPengangkutan: newStatus,
            updatedAt: serverTimestamp(),
          });
        }
      }
    }

    const productMapOld: Record<string, number> = {};
    const productMapNew: Record<string, number> = {};
    oldItems.forEach((it) => {
      const key = it.jenisPupuk;
      const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
      const botolPerDus = getBotolPerDus(stockList, it.jenisPupuk);
      if (isDusBotol) {
        productMapOld[key] = (productMapOld[key] || 0) + ((it.pengambilanZAK || 0) / botolPerDus) * (it.bobotPerUnit || 50);
      } else {
        productMapOld[key] = (productMapOld[key] || 0) + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
      }
    });
    newItems.forEach((it) => {
      const key = it.jenisPupuk;
      productMapNew[key] = (productMapNew[key] || 0) + (it.totalKG || 0);
    });
    const allProducts = new Set([...Object.keys(productMapOld), ...Object.keys(productMapNew)]);
    for (const prod of allProducts) {
      const oldKG = productMapOld[prod] || 0;
      const newKG = productMapNew[prod] || 0;
      const deltaKG = oldKG - newKG;
      const stock = getStockForProduct(prod);
      if (stock && deltaKG !== 0) {
        const stockRef = doc(db, "stockGudang", stock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          const currentUnit = sData.stokAkhirUnit || 0;
          const currentKG = sData.stokAkhirKG || 0;
          const currentKeluarUnit = sData.barangKeluarUnit || 0;
          const currentKeluarKG = sData.barangKeluarKG || 0;
          const isDusBotol = stock.unit === "DUS" || stock.unit === "BOTOL";
          if (isDusBotol) {
            const botolPerDus = stock.botolPerDus || 20;
            const deltaUnit = deltaKG / botolPerDus;
            await updateDoc(stockRef, {
              stokAkhirUnit: Math.max(0, currentUnit + deltaUnit),
              stokAkhirKG: 0,
              barangKeluarUnit: Math.max(0, currentKeluarUnit - deltaUnit),
              barangKeluarKG: 0,
              updatedAt: serverTimestamp(),
            });
          } else {
            const bobot = stock.bobotPerUnit || 50;
            const deltaUnit = deltaKG / bobot;
            await updateDoc(stockRef, {
              stokAkhirUnit: Math.max(0, currentUnit + deltaUnit),
              stokAkhirKG: Math.max(0, currentKG + deltaKG),
              barangKeluarUnit: Math.max(0, currentKeluarUnit - deltaUnit),
              barangKeluarKG: Math.max(0, currentKeluarKG - deltaKG),
              updatedAt: serverTimestamp(),
            });
          }
        }
      }
    }
    fetchExistingSurat();
  };

  const handleDelete = async (item: UnifiedTransaksi) => {
    let collectionName = "";
    if (item.jenis === "barangMasuk" || item.jenis === "penggantianRusak") collectionName = "transaksiBarangMasuk";
    else collectionName = "transaksiBarangKeluar";
    const jenisLabel = item.jenis === "barangMasuk" ? "Barang Masuk" :
      item.jenis === "penggantianRusak" ? "Penggantian Barang Rusak" :
      item.jenis === "suratPengangkutanGudangInduk" ? "Surat Pengangkutan Gudang Induk" :
      item.jenis === "suratPengangkutanDO" ? "Surat Pengangkutan DO" : "Barang Keluar";
    if (!confirm(`Apakah Anda yakin ingin menghapus data ${jenisLabel} ini?`)) return;
    try {
      if (item.jenis === "barangMasuk" || item.jenis === "penggantianRusak") {
        const stock = getStockExactMatch(item.kodeBarang, item.namaBarang);
        if (stock) {
          const stockRef = doc(db, "stockGudang", stock.id);
          const stockSnap = await getDoc(stockRef);
          if (stockSnap.exists()) {
            const sData = stockSnap.data();
            const currentMasukUnit = sData.barangMasukUnit || 0;
            const currentMasukKG = sData.barangMasukKG || 0;
            const currentStokUnit = sData.stokAkhirUnit || 0;
            const currentStokKG = sData.stokAkhirKG || 0;
            const minusUnit = item.unit === "KG" ? 0 : item.jumlahZAK;
            const minusKG = item.totalKG || (item.unit === "KG" ? item.jumlahZAK : item.jumlahZAK * (stock.bobotPerUnit || 50));
            await updateDoc(stockRef, {
              barangMasukUnit: Math.max(0, currentMasukUnit - minusUnit),
              barangMasukKG: Math.max(0, currentMasukKG - minusKG),
              stokAkhirUnit: Math.max(0, currentStokUnit - minusUnit),
              stokAkhirKG: Math.max(0, currentStokKG - minusKG),
              updatedAt: serverTimestamp(),
            });
          }
        }
        if (item.jenis === "barangMasuk" && item.adaBarangRusak && item.barangRusak) {
          const transaksiRef = doc(db, "transaksiBarangMasuk", item.id);
          const transaksiSnap = await getDoc(transaksiRef);
          if (transaksiSnap.exists()) {
            const tData = transaksiSnap.data();
            const barangRusakArray = tData.barangRusak || [];
            const hasReplaced = barangRusakArray.some((r: any) => r.status === "sudah diganti");
            if (hasReplaced) {
              alert("Tidak dapat menghapus transaksi ini karena terdapat barang rusak yang sudah diganti.");
              return;
            }
          }
        }
      }

      if (item.jenis === "barangKeluarBackup" && item.backupItems) {
        const productMap: Record<string, number> = {};
        item.backupItems.forEach((it) => {
          const key = it.stockId || it.namaBarang;
          if (it.unit === "DUS") {
            const botolPerDus = it.botolPerDus || 20;
            productMap[key] = (productMap[key] || 0) + (it.pengambilanUnit / botolPerDus);
          } else if (it.unit === "ZAK") {
            productMap[key] = (productMap[key] || 0) + (it.pengambilanUnit * (it.bobotPerUnit || 50));
          } else {
            productMap[key] = (productMap[key] || 0) + it.pengambilanUnit;
          }
        });
        for (const prod of Object.keys(productMap)) {
          const val = productMap[prod];
          const stock = getStockForProduct(prod);
          if (stock) {
            const stockRef = doc(db, "stockGudang", stock.id);
            const stockSnap = await getDoc(stockRef);
            if (stockSnap.exists()) {
              const sData = stockSnap.data();
              const currentUnit = sData.stokAkhirUnit || 0;
              const currentKG = sData.stokAkhirKG || 0;
              const currentKeluarUnit = sData.barangKeluarUnit || 0;
              const currentKeluarKG = sData.barangKeluarKG || 0;
              const isDusBotol = stock.unit === "DUS" || stock.unit === "BOTOL";
              if (isDusBotol) {
                const botolPerDus = stock.botolPerDus || 20;
                const unitVal = val / botolPerDus;
                await updateDoc(stockRef, {
                  stokAkhirUnit: currentUnit + unitVal,
                  stokAkhirKG: 0,
                  barangKeluarUnit: Math.max(0, currentKeluarUnit - unitVal),
                  barangKeluarKG: 0,
                  updatedAt: serverTimestamp(),
                });
              } else {
                const bobot = stock.bobotPerUnit || 50;
                const unitVal = val / bobot;
                await updateDoc(stockRef, {
                  stokAkhirUnit: currentUnit + unitVal,
                  stokAkhirKG: currentKG + val,
                  barangKeluarUnit: Math.max(0, currentKeluarUnit - unitVal),
                  barangKeluarKG: Math.max(0, currentKeluarKG - val),
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        }
      }

      if (item.jenis === "suratPengangkutanGudangInduk" && item.nomorPI) {
        const pi = getPIByNomor(item.nomorPI);
        if (pi) {
          const totalKG = (item.items || []).reduce((sum, it) => {
            const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
            const botolPerDus = getBotolPerDus(stockList, it.jenisPupuk);
            if (isDusBotol) {
              return sum + ((it.pengambilanZAK || 0) / botolPerDus) * (it.bobotPerUnit || 50);
            }
            return sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
          }, 0);
          const piRef = doc(db, "proformaInvoice", pi.id);
          const piSnap = await getDoc(piRef);
          if (piSnap.exists()) {
            const piData = piSnap.data();
            const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
            const newSisa = currentSisa + totalKG;
            const totalOrdered = pi.produkItems.reduce((sum, p) => {
              const isDusBotol = isDusOrBotolProduct(stockList, p.namaProduk);
              const botolPerDus = getBotolPerDus(stockList, p.namaProduk);
              let qty = p.kuantitas || 0;
              if (p.satuan === "DUS" && isDusBotol) {
                qty = qty * botolPerDus;
              }
              return sum + qty;
            }, 0);
            let newStatus = "pending";
            if (newSisa >= totalOrdered) newStatus = "pending";
            else if (newSisa > 0) newStatus = "partial";
            else newStatus = "complete";
            await updateDoc(piRef, {
              sisaPengambilanKG: newSisa,
              statusPengangkutan: newStatus,
              updatedAt: serverTimestamp(),
            });
          }
        }
        const productMap: Record<string, number> = {};
        (item.items || []).forEach((it) => {
          const key = it.jenisPupuk;
          const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
          const botolPerDus = getBotolPerDus(stockList, it.jenisPupuk);
          if (isDusBotol) {
            productMap[key] = (productMap[key] || 0) + ((it.pengambilanZAK || 0) / botolPerDus) * (it.bobotPerUnit || 50);
          } else {
            productMap[key] = (productMap[key] || 0) + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
          }
        });
        for (const prod of Object.keys(productMap)) {
          const kg = productMap[prod];
          const stock = getStockForProduct(prod);
          if (stock) {
            const stockRef = doc(db, "stockGudang", stock.id);
            const stockSnap = await getDoc(stockRef);
            if (stockSnap.exists()) {
              const sData = stockSnap.data();
              const currentUnit = sData.stokAkhirUnit || 0;
              const currentKG = sData.stokAkhirKG || 0;
              const currentKeluarUnit = sData.barangKeluarUnit || 0;
              const currentKeluarKG = sData.barangKeluarKG || 0;
              const isDusBotol = stock.unit === "DUS" || stock.unit === "BOTOL";
              if (isDusBotol) {
                const botolPerDus = stock.botolPerDus || 20;
                const unit = kg / botolPerDus;
                await updateDoc(stockRef, {
                  stokAkhirUnit: currentUnit + unit,
                  stokAkhirKG: 0,
                  barangKeluarUnit: Math.max(0, currentKeluarUnit - unit),
                  barangKeluarKG: 0,
                  updatedAt: serverTimestamp(),
                });
              } else {
                const bobot = stock.bobotPerUnit || 50;
                const unit = kg / bobot;
                await updateDoc(stockRef, {
                  stokAkhirUnit: currentUnit + unit,
                  stokAkhirKG: currentKG + kg,
                  barangKeluarUnit: Math.max(0, currentKeluarUnit - unit),
                  barangKeluarKG: Math.max(0, currentKeluarKG - kg),
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        }
      }
      if (item.jenis === "suratPengangkutanGudangInduk" || item.jenis === "suratPengangkutanDO") {
        const suratQuery = query(collection(db, "suratPengangkutan"), where("nomorSeri", "==", item.nomorSeri || ""));
        const suratSnapshot = await getDocs(suratQuery);
        if (!suratSnapshot.empty) {
          await deleteDoc(doc(db, "suratPengangkutan", suratSnapshot.docs[0].id));
        }
        if (item.nomorSeri) {
          if (item.jenis === "suratPengangkutanGudangInduk") {
            await releaseSeriSP(item.nomorSeri);
          } else {
            await releaseSeriDO(item.nomorSeri);
          }
        }
      }
      await deleteDoc(doc(db, collectionName, item.id));
      fetchData();
      fetchStockGudang();
      fetchExistingSurat();
    } catch (error) { console.error(error); }
  };

  const handleExportExcel = () => {
    const headers = [
      "No", "Jenis Transaksi", "Tanggal", "Nomor Seri", "Kode Barang", "Nama Barang",
      "Unit", "Jumlah", "Total KG", "FOT", "Nomor Kontainer", "Nomor DO",
      "Customer", "No PI", "No Invoice", "Driver Unit", "No Polisi",
      "No Surat Pengangkutan", "Total Pengambilan KG", "Ada Barang Rusak",
      "Dibuat Oleh", "Tanggal Dibuat"
    ];

    const rows = filteredData.map((item, idx) => {
      const isSurat = item.jenis === "suratPengangkutanGudangInduk" || item.jenis === "suratPengangkutanDO";
      const isBackup = item.jenis === "barangKeluarBackup";
      let jenisLabel = "";
      if (item.jenis === "barangMasuk") jenisLabel = "Barang Masuk";
      else if (item.jenis === "penggantianRusak") jenisLabel = "Penggantian Barang Rusak";
      else if (item.jenis === "suratPengangkutanGudangInduk") jenisLabel = "Surat Pengangkutan Gudang Induk";
      else if (item.jenis === "suratPengangkutanDO") jenisLabel = "Surat Pengangkutan DO";
      else if (item.jenis === "barangKeluarBackup") jenisLabel = "Barang Keluar Backup";
      else jenisLabel = "Barang Keluar";

      let jumlahDisplay = "";
      let unitDisplay = item.unit || "-";
      if (isSurat && item.items) {
        const totalBotol = item.items.reduce((sum, it) => {
          const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
          return sum + (isDusBotol ? (it.pengambilanZAK || 0) : 0);
        }, 0);
        const totalZak = item.items.reduce((sum, it) => {
          const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
          return sum + (isDusBotol ? 0 : (it.pengambilanZAK || 0));
        }, 0);
        if (totalBotol > 0) {
          jumlahDisplay = totalBotol.toLocaleString("id-ID");
          unitDisplay = "BOTOL";
        } else if (totalZak > 0) {
          jumlahDisplay = totalZak.toLocaleString("id-ID");
          unitDisplay = "ZAK";
        } else {
          jumlahDisplay = "0";
          unitDisplay = "ZAK";
        }
      } else if (isBackup && item.backupItems) {
        const totalBotol = item.backupItems.reduce((sum, it) => sum + (it.unit === "BOTOL" || it.unit === "DUS" ? it.pengambilanUnit : 0), 0);
        const totalZak = item.backupItems.reduce((sum, it) => sum + (it.unit === "ZAK" ? it.pengambilanUnit : 0), 0);
        if (totalBotol > 0) {
          jumlahDisplay = totalBotol.toLocaleString("id-ID");
          unitDisplay = "BOTOL";
        } else if (totalZak > 0) {
          jumlahDisplay = totalZak.toLocaleString("id-ID");
          unitDisplay = "ZAK";
        } else {
          jumlahDisplay = (item.jumlahZAK || 0).toLocaleString("id-ID");
        }
      } else {
        jumlahDisplay = (item.jumlahZAK || 0).toLocaleString("id-ID");
      }

      return [
        idx + 1,
        jenisLabel,
        item.tanggal,
        item.nomorSeri || "-",
        item.kodeBarang || (isBackup && item.backupItems ? item.backupItems.map((it) => it.kodeBarang).join("; ") : "-"),
        item.namaBarang || (isSurat && item.items ? item.items.map((it) => it.jenisPupuk).join("; ") : isBackup && item.backupItems ? item.backupItems.map((it) => it.namaBarang).join("; ") : "-"),
        unitDisplay,
        jumlahDisplay,
        item.totalPengambilanKG || (item.items ? item.items.reduce((sum, it) => {
          const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
          return sum + (isDusBotol ? 0 : (it.totalKG || 0));
        }, 0) : 0),
        item.fot || (item.items && item.items[0] ? item.items[0].fot : "-"),
        item.nomorKontainer || "-",
        item.nomorDO || "-",
        item.namaCustomer || (item.kepadaNama || item.kepadaPerusahaan || "-"),
        item.nomorPI || (item.nomorPIList ? item.nomorPIList.join("; ") : "-"),
        item.nomorInvoice || "-",
        item.driverUnit || "-",
        item.nomorPolisi || "-",
        item.nomorSuratPengangkutan || item.nomorSeri || "-",
        item.totalPengambilanKG || 0,
        item.adaBarangRusak ? "Ya" : "Tidak",
        item.createdBy,
        item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "-"
      ];
    });

    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    const thinBorder = {
      top: { style: "thin", color: { rgb: "D1D5DB" } },
      bottom: { style: "thin", color: { rgb: "D1D5DB" } },
      left: { style: "thin", color: { rgb: "D1D5DB" } },
      right: { style: "thin", color: { rgb: "D1D5DB" } }
    };

    const headerStyle = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: "15803D" }, bgColor: { rgb: "15803D" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: thinBorder
    };

    const evenRowStyle = {
      font: { color: { rgb: "374151" }, sz: 10, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: "F0FDF4" }, bgColor: { rgb: "F0FDF4" } },
      alignment: { vertical: "center" },
      border: thinBorder
    };

    const oddRowStyle = {
      font: { color: { rgb: "374151" }, sz: 10, name: "Calibri" },
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF" }, bgColor: { rgb: "FFFFFF" } },
      alignment: { vertical: "center" },
      border: thinBorder
    };

    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellRef]) ws[cellRef] = { v: "" };
        if (R === 0) {
          ws[cellRef].s = headerStyle;
        } else {
          ws[cellRef].s = R % 2 === 0 ? evenRowStyle : oddRowStyle;
          if (C === 0) ws[cellRef].s = { ...ws[cellRef].s, alignment: { ...ws[cellRef].s.alignment, horizontal: "center" } };
          if (C === 7 || C === 8 || C === 18) ws[cellRef].s = { ...ws[cellRef].s, alignment: { ...ws[cellRef].s.alignment, horizontal: "right" } };
        }
      }
    }

    ws["!cols"] = headers.map((h, i) => {
      let maxLen = h.length;
      rows.forEach((row) => {
        const val = row[i]?.toString() || "";
        if (val.length > maxLen) maxLen = val.length;
      });
      return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
    });

    ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Riwayat Transaksi");
    XLSX.writeFile(wb, `Riwayat_Transaksi_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handlePrintSuratPDF = (item: UnifiedTransaksi) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const isGI = item.jenis === "suratPengangkutanGudangInduk";
    const isMandiri = item.jenis === "suratPengangkutanDO" && item.subJenisDO === "mandiri";
    const isDikuasakan = item.jenis === "suratPengangkutanDO" && item.subJenisDO === "dikuasakan";
    const piDisplay = item.nomorPIList && item.nomorPIList.length > 0
      ? item.nomorPIList.join(", ")
      : item.nomorPI || "";

    const itemsHtml = (item.items || [])
      .map(
        (it, idx) => {
          const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
          const unitLabel = isDusBotol ? "BOTOL" : "ZAK";
          return `
        <tr>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
          ${isMandiri ? `<td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorSubDO || "-"}</td>` : ""}
          ${isGI || isDikuasakan ? `<td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorPI || piDisplay || "-"}</td>` : ""}
          ${isMandiri || isDikuasakan ? `<td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorPO || "-"}</td>` : ""}
          <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.jenisPupuk || ""}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.party || "-"}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.pengambilanZAK || "-"} ${unitLabel}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.sisa || "-"}</td>
        </tr>
      `;
        }
      )
      .join("");

    let recipientBox = "";
    if (isGI) {
      recipientBox = `<div class="recipient-box"><p class="recipient-title">Kepada Yth :</p><p class="recipient-name">Bapak Kepala Gudang Induk</p><p class="recipient-name">PT Bukit Agrochemical Baru</p><p class="recipient-address">Desa Sungai Rangit<br>Pangkalan Lada, Kalimantan Tengah</p></div>`;
    } else if (isDikuasakan) {
      recipientBox = `<div class="recipient-box"><p class="recipient-title">Kepada Yth :</p><p class="recipient-name">${item.namaCustomer || ""}</p><p class="recipient-name">${item.namaCustomer || ""}</p></div>`;
    } else {
      recipientBox = `<div class="recipient-box"><p class="recipient-title">Kepada Yth :</p><p class="recipient-name">${item.kepadaNama || item.namaCustomer || ""}</p><p class="recipient-name">${item.kepadaPerusahaan || item.namaCustomer || ""}</p><p class="recipient-address">${(item.kepadaAlamat || "").replace(/\n/g, "<br>")}</p></div>`;
    }

    const html = `
      <!DOCTYPE html><html><head><title>Surat Pengangkutan ${item.nomorSeri || ""}</title>
      <style>
        @page { size: A4; margin: 10mm 12mm 10mm 12mm; }
        @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #000; }
        .page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; display: flex; flex-direction: column; }
        .header-img { width: 100%; display: block; margin-bottom: 0; }
        .title-bar { text-align: center; background: #15803d; color: white; padding: 8px 0; margin: 8px 0 12px 0; font-weight: bold; font-size: 14px; letter-spacing: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
        .table-title { text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .data-table { width: 100%; border-collapse: collapse; }
        .data-table th { background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .data-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: top; }
        .notes-section { margin-top: 10px; font-size: 9px; }
        .notes-section p { margin-bottom: 2px; }
        .signature-row { display: flex; justify-content: space-between; margin-top: auto; padding-top: 20px; align-items: flex-end; }
        .signature-box { width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
        .signature-title { font-size: 9px; margin-bottom: 4px; min-height: 28px; line-height: 1.4; }
        .signature-img { max-height: 60px; width: auto; object-fit: contain; margin: 0 auto 4px auto; display: block; }
        .signature-name { font-size: 10px; font-weight: 700; margin-top: 0; border-top: 1px solid #000; padding-top: 3px; display: block; width: 90%; margin-left: auto; margin-right: auto; }
        .footer-img { width: 100%; display: block; margin-top: auto; padding-top: 10px; }
        .print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
        .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
        @media print { .print-bar { display: none !important; } }
      </style></head><body>
        <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
        <div class="page">
          <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display='none'" />
          <div class="title-bar">SURAT PENGANGKUTAN</div>
          <div class="info-section">
            <div class="info-row"><span>Lamandau, ${new Date(item.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
            <div class="info-row"><span class="info-label">Nomor Seri : ${item.nomorSeri || "-"}</span></div>
            ${!isGI ? `<div class="info-row"><span class="info-label">Nomor PI : ${piDisplay}</span></div>` : ""}
          </div>${recipientBox}
          <div class="salutation"><p>Dengan Hormat,</p><p>Dengan ini mohon dimuatkan pupuk dengan rincian sebagai berikut :</p></div>
          <div class="table-section"><div class="table-title">DASAR PENGANGKUTAN</div>
            <table class="data-table"><thead><tr><th style="width: 30px;">NO</th>${isMandiri ? `<th style="width: 100px;">NOMOR SUB DO</th>` : ""}${isGI || isDikuasakan ? `<th style="width: 100px;">NOMOR PI</th>` : ""}${isMandiri || isDikuasakan ? `<th style="width: 100px;">NOMOR PO</th>` : ""}<th>JENIS PUPUK</th><th style="width: 60px;">PARTY</th><th style="width: 100px;">PENGAMBILAN<br>${item.items && item.items.some((it) => it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk)) ? "BOTOL" : "ZAK"}</th><th style="width: 60px;">SISA</th></tr></thead><tbody>${itemsHtml}</tbody></table></div>
          <div class="table-section"><div class="table-title">DATA UNIT ANGKUTAN</div>
            <table class="data-table"><tbody><tr><td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600; width: 120px;">NO. POLISI :</td><td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${item.nomorPolisi || "-"}</td></tr><tr><td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">DRIVER UNIT :</td><td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${item.driverUnit || "-"}</td></tr><tr><td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">NOMOR SIM :</td><td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${item.nomorSIM || "-"}</td></tr></tbody></table></div>
          <div class="notes-section"><p style="font-weight: 700;">Notes :</p><p>- Jika terdapat coretan / tip-ex Sub DO dianggap batal.</p><p>- Sub DO berlaku selama 3 hari dari tanggal Sub DO diterbitkan.</p><p>- Untuk konfirmasi dengan Customer Service kami, silahkan scan QRcode di atas.</p></div>
          <div class="signature-row"><div class="signature-box"><p class="signature-title">Hormat Kami,<br>PT. BUKIT AGROCHEMICAL BARU</p><div style="min-height: 60px; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center;"><img src="/Picture2.png" alt="TTD" class="signature-img" onerror="this.style.display='none'" /></div><p class="signature-name">HENDRA PRAMASYANTO</p></div><div class="signature-box"><p class="signature-title">Diangkut oleh,<br>Driver</p><div style="min-height: 60px; margin-bottom: 4px;"></div><p class="signature-name">${item.driverUnit || ""}</p></div></div>
          <img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display='none'" />
        </div></body></html>`;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintBeritaAcara = (item: UnifiedTransaksi) => {
    if (!item.barangRusak || item.barangRusak.length === 0) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const ttd = ttdList.length > 0 ? ttdList[0] : null;

    const rusakRows = item.barangRusak.map((r, idx) => {
      const fotoHtml = r.fotoUrls && r.fotoUrls.length > 0
        ? `<div style="margin-top: 6px;"><p style="font-size: 9px; font-weight: 600; margin-bottom: 4px;">FOTO DOKUMENTASI:</p><div style="display: flex; flex-wrap: wrap; gap: 6px;">${r.fotoUrls.map((f, i) => `<img src="${f}" alt="Foto ${i + 1}" style="width: 80px; height: 80px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px;" />`).join("")}</div></div>`
        : "";
      const penggantianHtml = r.status === "sudah diganti"
        ? `<div style="margin-top: 6px; padding: 6px; background: #f0fdf4; border: 1px solid #16a34a; border-radius: 4px;"><p style="font-size: 9px; font-weight: 700; color: #16a34a;">SUDAH DIGANTI</p><p style="font-size: 9px; color: #333;">Tanggal: ${r.tanggalPenggantian || "-"}</p><p style="font-size: 9px; color: #333;">Jumlah Penggantian: ${(r.jumlahPenggantian || 0).toLocaleString("id-ID")} ${item.unit || "ZAK"}</p>${r.penggantianFotoUrls && r.penggantianFotoUrls.length > 0 ? `<div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px;">${r.penggantianFotoUrls.map((f, i) => `<img src="${f}" alt="Foto Ganti ${i + 1}" style="width: 80px; height: 80px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px;" />`).join("")}</div>` : ""}</div>`
        : "";
      return `
      <tr>
        <td style="text-align: center; padding: 8px; border: 1px solid #000; font-size: 11px;">${idx + 1}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #000; font-size: 11px; font-weight: 600;">${r.unit}</td>
        <td style="text-align: center; padding: 8px; border: 1px solid #000; font-size: 11px;">${r.jumlah.toLocaleString("id-ID")}</td>
        <td style="padding: 8px; border: 1px solid #000; font-size: 11px;">
          <p>${r.keterangan}</p>
          ${fotoHtml}
          ${penggantianHtml}
        </td>
      </tr>
    `;
    }).join("");

    const sopirInfo = item.sopirNopolList && item.sopirNopolList.length > 0
      ? item.sopirNopolList.filter(s => s.namaSopir || s.nopol).map((s, i) =>
          `<p style="font-size: 10px; margin-bottom: 2px;">${i + 1}. ${s.namaSopir || "-"} | ${s.nopol || "-"} | SIM: ${s.nomorSIM || "-"}</p>`
        ).join("")
      : "-";

    const html = `
      <!DOCTYPE html><html><head><title>Berita Acara Barang Rusak</title>
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
      </style></head><body>
        <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
        <div class="page">
          <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display='none'" />
          <div class="title-bar">BERITA ACARA BARANG RUSAK</div>

          <div class="info-grid">
            <div class="info-item"><span class="info-label">Tanggal:</span> <span>${new Date(item.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
            <div class="info-item"><span class="info-label">FOT:</span> <span>${item.fot || "-"}</span></div>
            <div class="info-item"><span class="info-label">Kode Barang:</span> <span>${item.kodeBarang || "-"}</span></div>
            <div class="info-item"><span class="info-label">Nomor Kontainer:</span> <span>${item.nomorKontainer || "-"}</span></div>
            <div class="info-item"><span class="info-label">Nama Barang:</span> <span>${item.namaBarang || "-"}</span></div>
            <div class="info-item"><span class="info-label">Nomor DO:</span> <span>${item.nomorDO || "-"}</span></div>
          </div>

          <div class="info-box">
            <div class="info-box-title">Informasi Sopir & Kendaraan</div>
            ${sopirInfo}
          </div>

          <div class="table-title">RINCIAN BARANG RUSAK / CACAT</div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 40px;">NO</th>
                <th style="width: 100px;">SATUAN</th>
                <th style="width: 100px;">JUMLAH</th>
                <th>KETERANGAN & DOKUMENTASI</th>
              </tr>
            </thead>
            <tbody>
              ${rusakRows}
            </tbody>
          </table>

          <div class="notes-box">
            <p style="font-weight: 700; margin-bottom: 6px;">Keterangan:</p>
            <p>Barang rusak tersebut ditemukan pada saat proses penerimaan barang masuk ke gudang. Barang yang rusak telah dicatat dan akan diproses sesuai prosedur perusahaan.</p>
            <p style="margin-top: 8px; font-weight: 700;">Dibuat oleh: ${item.createdBy || "-"}</p>
          </div>

          <div class="signature-row">
            <div class="signature-box">
              <p class="signature-title">Diverifikasi oleh,<br>PT. BUKIT AGROCHEMICAL BARU</p>
              <div style="min-height: 60px; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center;">
                ${ttd ? `<img src="${ttd.ttdImage}" alt="TTD" class="signature-img" onerror="this.style.display='none'" />` : `<div style="min-height: 60px;"></div>`}
              </div>
              <p class="signature-name">${ttd ? ttd.nama : "_________________"}</p>
              ${ttd ? `<p style="font-size: 9px; color: #333; margin-top: 3px;">${ttd.jabatan}</p>` : ""}
            </div>
            <div class="signature-box">
              <p class="signature-title">Diserahkan oleh,<br>Sopir / Driver</p>
              <div style="min-height: 60px; margin-bottom: 4px;"></div>
              <p class="signature-name">${item.sopirNopolList && item.sopirNopolList[0]?.namaSopir ? item.sopirNopolList[0].namaSopir : ""}</p>
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

  const jenisOptions = [
    { value: "semua", label: "Semua Transaksi" },
    { value: "barangMasuk", label: "Barang Masuk" },
    { value: "barangKeluar", label: "Barang Keluar" },
    { value: "barangKeluarBackup", label: "Barang Keluar Backup" },
    { value: "suratPengangkutan", label: "Surat Pengangkutan" },
    { value: "penggantianRusak", label: "Penggantian Barang Rusak" },
  ];

  const bulanOptions = [
    { value: "", label: "Semua Bulan" },
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
  ];

  const tahunOptions = [
    { value: "", label: "Semua Tahun" },
    ...Array.from({ length: 5 }, (_, i) => {
      const year = (new Date().getFullYear() - 2 + i).toString();
      return { value: year, label: year };
    }),
  ];

  const fotOptions = [
    { value: "", label: "Semua FOT" },
    ...fotList.map((f) => ({ value: f, label: f })),
  ];

  const unitOptions = [
    { value: "ZAK", label: "ZAK" },
    { value: "DUS", label: "DUS" },
    { value: "KG", label: "KG" },
    { value: "BOTOL", label: "BOTOL" },
  ];

  const getJenisBadgeClass = (jenis: string) => {
    if (jenis === "barangMasuk") return "bg-blue-100 text-blue-700";
    if (jenis === "penggantianRusak") return "bg-teal-100 text-teal-700";
    if (jenis === "suratPengangkutanGudangInduk") return "bg-green-100 text-green-700";
    if (jenis === "suratPengangkutanDO") return "bg-purple-100 text-purple-700";
    if (jenis === "barangKeluarBackup") return "bg-stone-100 text-stone-700";
    return "bg-orange-100 text-orange-700";
  };

  const getJenisLabel = (jenis: string) => {
    if (jenis === "barangMasuk") return "MASUK";
    if (jenis === "penggantianRusak") return "PENGGANTIAN";
    if (jenis === "suratPengangkutanGudangInduk") return "GUDANG INDUK";
    if (jenis === "suratPengangkutanDO") return "DO";
    if (jenis === "barangKeluarBackup") return "BACKUP";
    return "KELUAR";
  };

  const getTotalKGForSurat = (item: UnifiedTransaksi) => {
    if (item.totalPengambilanKG) return item.totalPengambilanKG;
    if (item.items) return item.items.reduce((sum, it) => {
      const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
      return sum + (isDusBotol ? 0 : (it.totalKG || 0));
    }, 0);
    return 0;
  };

  const getSuratJumlahDisplay = (item: UnifiedTransaksi) => {
    if (!item.items || item.items.length === 0) return "-";
    const totalBotol = item.items.reduce((sum, it) => {
      const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
      return sum + (isDusBotol ? (it.pengambilanZAK || 0) : 0);
    }, 0);
    const totalZak = item.items.reduce((sum, it) => {
      const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
      return sum + (isDusBotol ? 0 : (it.pengambilanZAK || 0));
    }, 0);
    if (totalBotol > 0) return `${totalBotol.toLocaleString("id-ID")} BOTOL`;
    if (totalZak > 0) return `${totalZak.toLocaleString("id-ID")} ZAK`;
    return "-";
  };

  const getSuratUnitDisplay = (item: UnifiedTransaksi) => {
    if (!item.items || item.items.length === 0) return "ZAK";
    const hasBotol = item.items.some((it) => it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk));
    if (hasBotol) return "BOTOL";
    return "ZAK";
  };

  const getSuratFOTDisplay = (item: UnifiedTransaksi) => {
    if (item.fot && item.fot.trim()) return item.fot;
    if (item.items && item.items.length > 0) {
      const fots = item.items.map((it) => it.fot).filter((f) => f && f.trim());
      if (fots.length > 0) return fots[0];
    }
    return "-";
  };

  const getSuratNamaBarangDisplay = (item: UnifiedTransaksi) => {
    if (item.namaBarang && item.namaBarang.trim()) return item.namaBarang;
    if (item.items && item.items.length > 0) {
      return item.items.map((it) => it.jenisPupuk).filter((n) => n && n.trim()).join(", ");
    }
    return "-";
  };

  const columns = [
    {
      key: "jenis",
      header: "Jenis",
      width: "120px",
      render: (row: UnifiedTransaksi) => (
        <span className={`px-2 py-1 rounded-md text-xs font-bold ${getJenisBadgeClass(row.jenis)}`}>
          {getJenisLabel(row.jenis)}
        </span>
      ),
    },
    {
      key: "tanggal",
      header: "Tanggal",
      width: "120px",
      render: (row: UnifiedTransaksi) => <span className="font-medium text-gray-800">{row.tanggal}</span>,
    },
    {
      key: "nomorSeri",
      header: "Nomor Seri / Kontainer",
      width: "200px",
      render: (row: UnifiedTransaksi) => (
        <div className="space-y-1">
          {row.nomorSeri ? (
            <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded text-xs block">{row.nomorSeri}</span>
          ) : (
            <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded text-xs block">{row.kodeBarang || "-"}</span>
          )}
          {(row.jenis === "barangMasuk" || row.jenis === "penggantianRusak") && row.nomorKontainer && (
            <span className="font-mono text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded block">{row.nomorKontainer}</span>
          )}
        </div>
      ),
    },
    {
      key: "nomorPI",
      header: "Nomor PI",
      width: "150px",
      render: (row: UnifiedTransaksi) => {
        const piDisplay = row.nomorPI || (row.nomorPIList && row.nomorPIList.length > 0 ? row.nomorPIList.join(", ") : "-");
        return (
          <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded text-xs">{piDisplay}</span>
        );
      },
    },
    {
      key: "namaBarang",
      header: "Nama Barang / Info",
      render: (row: UnifiedTransaksi) => (
        <div className="text-sm">
          {row.jenis === "suratPengangkutanGudangInduk" || row.jenis === "suratPengangkutanDO" ? (
            <div className="space-y-1">
              {(row.items || []).map((it, idx) => {
                const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
                const unitLabel = isDusBotol ? "BOTOL" : "ZAK";
                return (
                  <p key={idx} className="font-semibold text-gray-800">
                    {it.jenisPupuk} <span className="text-xs font-normal text-gray-500">({it.pengambilanZAK || 0} {unitLabel})</span>
                  </p>
                );
              })}
              {row.nomorPIList && row.nomorPIList.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">PI: {row.nomorPIList.join(", ")}</p>
              )}
              {(() => {
                const totalBotol = (row.items || []).reduce((sum, it) => {
                  const isDusBotol = it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk);
                  return sum + (isDusBotol ? (it.pengambilanZAK || 0) : 0);
                }, 0);
                const totalKg = getTotalKGForSurat(row);
                if (totalBotol > 0) return <p className="text-xs text-gray-500 font-medium">Total: {totalBotol.toLocaleString("id-ID")} BOTOL</p>;
                if (totalKg > 0) return <p className="text-xs text-gray-500 font-medium">Total: {totalKg.toLocaleString("id-ID")} KG</p>;
                return null;
              })()}
            </div>
          ) : row.jenis === "barangKeluarBackup" ? (
            <div className="space-y-1">
              {(row.backupItems || []).map((it, idx) => (
                <p key={idx} className="font-semibold text-gray-800">
                  {it.namaBarang} <span className="text-xs font-normal text-gray-500">({it.pengambilanUnit.toLocaleString("id-ID")} {it.unit})</span>
                </p>
              ))}
              <p className="text-xs text-gray-500">{row.nomorSeri}</p>
            </div>
          ) : (
            <span className="font-semibold text-gray-800">{row.namaBarang}</span>
          )}
        </div>
      ),
    },
    {
      key: "unit",
      header: "Unit",
      width: "80px",
      render: (row: UnifiedTransaksi) => {
        const isSurat = row.jenis === "suratPengangkutanGudangInduk" || row.jenis === "suratPengangkutanDO";
        const displayUnit = isSurat ? getSuratUnitDisplay(row) : (row.unit || "-");
        return (
          <span className={`px-2 py-1 rounded-md text-xs font-bold ${
            displayUnit === "ZAK" ? "bg-blue-100 text-blue-700" :
            displayUnit === "DUS" ? "bg-purple-100 text-purple-700" :
            displayUnit === "BOTOL" ? "bg-pink-100 text-pink-700" :
            "bg-gray-100 text-gray-700"
          }`}>
            {displayUnit}
          </span>
        );
      },
    },
    {
      key: "jumlah",
      header: "Jumlah",
      width: "120px",
      render: (row: UnifiedTransaksi) => {
        const isSurat = row.jenis === "suratPengangkutanGudangInduk" || row.jenis === "suratPengangkutanDO";
        return (
          <span className="font-mono font-bold text-gray-700">
            {isSurat
              ? getSuratJumlahDisplay(row)
              : `${row.jumlahZAK.toLocaleString()} ${row.unit === "KG" ? "KG" : "ZAK"}`
            }
          </span>
        );
      },
    },
    {
      key: "fot",
      header: "FOT",
      width: "100px",
      render: (row: UnifiedTransaksi) => {
        const fotDisplay = getSuratFOTDisplay(row);
        return (
          <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">{fotDisplay}</span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      width: "100px",
      render: (row: UnifiedTransaksi) => (
        <div className="flex flex-col gap-1">
          {row.adaBarangRusak && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">RUSAK</span>
          )}
          {row.fotoUrls && row.fotoUrls.length > 0 && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-100 text-amber-700">{row.fotoUrls.length} FOTO</span>
          )}
          {row.nomorDO && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600">DO</span>
          )}
          {row.isPenggantianRusak && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-700">GANTI</span>
          )}
          {row.jenis === "barangKeluarBackup" && (
            <span className="px-2 py-0.5 rounded text-xs font-bold bg-stone-100 text-stone-700">BACKUP</span>
          )}
        </div>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "180px",
      render: (row: UnifiedTransaksi) => (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleDetail(row); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Detail">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          {(row.jenis === "suratPengangkutanGudangInduk" || row.jenis === "suratPengangkutanDO") && (
            <button onClick={(e) => { e.stopPropagation(); handlePrintSuratPDF(row); }} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Print PDF">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
            </button>
          )}
          {row.jenis === "barangMasuk" && row.adaBarangRusak && (
            <button onClick={(e) => { e.stopPropagation(); handlePrintBeritaAcara(row); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Print Berita Acara Rusak">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  const getTotalMasuk = () => filteredData.filter((d) => d.jenis === "barangMasuk").length;
  const getTotalKeluar = () => filteredData.filter((d) => d.jenis === "barangKeluar").length;
  const getTotalSurat = () => filteredData.filter((d) => d.jenis === "suratPengangkutanGudangInduk" || d.jenis === "suratPengangkutanDO").length;
  const getTotalPenggantian = () => filteredData.filter((d) => d.jenis === "penggantianRusak").length;
  const isBotol = editForm.unit === "BOTOL";
  const isSuratEdit = selectedItem?.jenis === "suratPengangkutanGudangInduk" || selectedItem?.jenis === "suratPengangkutanDO";
  const isBackupEdit = selectedItem?.jenis === "barangKeluarBackup";

  const handleSuratItemChange = (idx: number, field: string, value: string) => {
    setEditSuratForm((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[idx], [field]: value };
      if (field === "pengambilanZAK") {
        const zak = parseFloat(value) || 0;
        const maxZAK = item.maxZAK || 0;
        if (maxZAK > 0) {
          if (zak >= maxZAK) { item.pengambilanZAK = String(maxZAK); item.sisa = "0"; }
          else { item.sisa = String(Math.max(0, maxZAK - zak)); }
        }
      }
      newItems[idx] = item;
      return { ...prev, items: newItems };
    });
  };

  const addSuratItem = () => {
    setEditSuratForm((prev) => ({
      ...prev,
      items: [...prev.items, { nomorSubDO: "", nomorPO: "", jenisPupuk: "", party: "", pengambilanZAK: "", bobotPerUnit: 50, sisa: "", maxZAK: 0, fot: "", nomorPI: "" }],
    }));
  };

  const removeSuratItem = (idx: number) => {
    setEditSuratForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleNomorSeriChangeEdit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEditSuratForm((prev) => ({ ...prev, nomorSeri: value }));
    checkNomorSeriExists(value, selectedItem?.nomorSeri);
  };

  return (
    <div className="space-y-6">
      <Header title="Riwayat Transaksi" subtitle="Lihat dan kelola riwayat transaksi barang masuk, keluar, dan surat pengangkutan" />

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Cari kode, nama barang, FOT, customer, nomor seri, kontainer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportExcel}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Select label="Filter Jenis Transaksi" value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)} options={jenisOptions} />
          <Select label="Filter FOT" value={filterFot} onChange={(e) => setFilterFot(e.target.value)} options={fotOptions} />
          <Select label="Filter Bulan" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} options={bulanOptions} />
          <Select label="Filter Tahun" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} options={tahunOptions} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total Transaksi</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{filteredData.length}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Barang Masuk</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{getTotalMasuk()}</p>
          </div>
          <div className="p-4 bg-teal-50 rounded-xl border border-teal-100">
            <p className="text-xs text-teal-600 uppercase tracking-wide font-semibold">Penggantian</p>
            <p className="text-2xl font-bold text-teal-700 mt-1">{getTotalPenggantian()}</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
            <p className="text-xs text-orange-600 uppercase tracking-wide font-semibold">Barang Keluar</p>
            <p className="text-2xl font-bold text-orange-700 mt-1">{getTotalKeluar()}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold">Surat Pengangkutan</p>
            <p className="text-2xl font-bold text-purple-700 mt-1">{getTotalSurat()}</p>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredData.length} dari {data.length} data
          {filterJenis !== "semua" && ` | Jenis: ${jenisOptions.find((j) => j.value === filterJenis)?.label}`}
          {filterFot && ` | FOT: ${filterFot}`}
          {filterBulan && ` | Bulan: ${bulanOptions.find((b) => b.value === filterBulan)?.label}`}
          {filterTahun && ` | Tahun: ${filterTahun}`}
        </div>

        <Table columns={columns} data={filteredData} isLoading={isLoading} emptyMessage="Belum ada data transaksi" keyExtractor={(row) => `${row.jenis}_${row.id}`} onRowClick={handleDetail} />
      </Card>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detail Transaksi" size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
          {(selectedItem?.jenis === "suratPengangkutanGudangInduk" || selectedItem?.jenis === "suratPengangkutanDO") && (
            <Button variant="primary" onClick={() => selectedItem && handlePrintSuratPDF(selectedItem)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print PDF
            </Button>
          )}
          {selectedItem?.jenis === "barangMasuk" && selectedItem?.adaBarangRusak && (
            <Button variant="danger" onClick={() => selectedItem && handlePrintBeritaAcara(selectedItem)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Print Berita Acara
            </Button>
          )}
        </div>
      }>
        {selectedItem && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getJenisBadgeClass(selectedItem.jenis)}`}>
                {selectedItem.jenis === "barangMasuk" ? "TRANSAKSI BARANG MASUK" :
                 selectedItem.jenis === "penggantianRusak" ? "PENGGANTIAN BARANG RUSAK" :
                 selectedItem.jenis === "suratPengangkutanGudangInduk" ? "SURAT PENGANGKUTAN GUDANG INDUK" :
                 selectedItem.jenis === "suratPengangkutanDO" ? "SURAT PENGANGKUTAN DO" :
                 selectedItem.jenis === "barangKeluarBackup" ? "BARANG KELUAR BACKUP" :
                 "TRANSAKSI BARANG KELUAR"}
              </span>
              <span className="text-sm text-gray-500">{selectedItem.tanggal}</span>
            </div>

            {selectedItem.nomorSeri && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nomor Seri</p>
                <p className="text-lg font-bold text-green-700 font-mono">{selectedItem.nomorSeri}</p>
              </div>
            )}

            {selectedItem.jenis === "barangKeluarBackup" && selectedItem.fotoUrls && selectedItem.fotoUrls.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Dokumentasi Foto ({selectedItem.fotoUrls.length})</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {selectedItem.fotoUrls.map((foto, idx) => (
                    <div key={idx} className="relative cursor-pointer group" onClick={() => setSelectedFotoIndex(idx)}>
                      <img
                        src={foto}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-gray-200 group-hover:border-indigo-400 transition-colors"
                      />
                      <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedItem.isPenggantianRusak && (
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-200">
                <p className="text-xs text-teal-600 uppercase tracking-wide font-semibold">Referensi Penggantian</p>
                <p className="text-sm text-teal-700">Transaksi ID: <span className="font-mono">{selectedItem.referensiTransaksiId}</span></p>
                <p className="text-sm text-teal-700">Index Rusak: {selectedItem.referensiRusakIndex}</p>
              </div>
            )}

            {(selectedItem.jenis === "barangMasuk" || selectedItem.jenis === "penggantianRusak") && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                    <p className="text-xs text-indigo-600 uppercase tracking-wide font-semibold">Nomor Kontainer</p>
                    <p className="text-lg font-bold text-indigo-700 font-mono">{selectedItem.nomorKontainer || "-"}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Nomor DO</p>
                    <p className="text-lg font-bold text-gray-700 font-mono">{selectedItem.nomorDO || "-"}</p>
                  </div>
                </div>

                {selectedItem.fotoUrls && selectedItem.fotoUrls.length > 0 && (
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">Dokumentasi Foto ({selectedItem.fotoUrls.length})</p>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {selectedItem.fotoUrls.map((foto, idx) => (
                        <div key={idx} className="relative cursor-pointer group" onClick={() => setSelectedFotoIndex(idx)}>
                          <img
                            src={foto}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200 group-hover:border-indigo-400 transition-colors"
                          />
                          <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.adaBarangRusak && selectedItem.barangRusak && selectedItem.barangRusak.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-xl border border-red-200">
                    <p className="text-xs text-red-600 uppercase tracking-wide font-semibold mb-3">Barang Rusak / Cacat</p>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                        <thead>
                          <tr className="bg-red-100">
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">No</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Satuan</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Jumlah</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Keterangan</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Status</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Foto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedItem.barangRusak.map((r, idx) => (
                            <tr key={idx} className="border-b">
                              <td className="px-3 py-2 text-sm text-gray-900 border">{idx + 1}</td>
                              <td className="px-3 py-2 text-sm font-semibold text-gray-900 border">{r.unit}</td>
                              <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono border">{r.jumlah.toLocaleString("id-ID")}</td>
                              <td className="px-3 py-2 text-sm text-gray-700 border">{r.keterangan}</td>
                              <td className="px-3 py-2 text-sm border">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${r.status === "sudah diganti" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                  {r.status === "sudah diganti" ? "SUDAH DIGANTI" : "BELUM DIGANTI"}
                                </span>
                                {r.status === "sudah diganti" && (
                                  <div className="mt-1 text-xs text-gray-500">
                                    <p>Tgl: {r.tanggalPenggantian}</p>
                                    <p>Jml: {r.jumlahPenggantian?.toLocaleString("id-ID")} {selectedItem.unit}</p>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-sm border">
                                {(() => {
                                  const rf = r.fotoUrls;
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
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedItem.sopirNopolList && selectedItem.sopirNopolList.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-2">Sopir & Kendaraan</p>
                    <div className="space-y-2">
                      {selectedItem.sopirNopolList.filter(s => s.namaSopir || s.nopol).map((s, idx) => (
                        <div key={idx} className="text-sm text-blue-800">
                          <span className="font-semibold">{idx + 1}.</span> {s.namaSopir || "-"} | {s.nopol || "-"} | SIM: {s.nomorSIM || "-"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {selectedItem.jenis === "suratPengangkutanGudangInduk" || selectedItem.jenis === "suratPengangkutanDO" ? (
              <>
                {selectedItem.nomorPIList && selectedItem.nomorPIList.length > 0 && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nomor Proforma Invoice</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedItem.nomorPIList.map((pi, idx) => (
                        <span key={idx} className="px-3 py-1 bg-white rounded-lg border border-blue-200 text-sm font-medium text-blue-700">{pi}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-green-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">No</th>
                        {selectedItem.jenis === "suratPengangkutanDO" && (
                          <>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Sub DO</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">PO</th>
                          </>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Jenis Pupuk</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Party</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">{selectedItem.items && selectedItem.items.some((it) => it.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, it.jenisPupuk)) ? "BOTOL" : "ZAK"}</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">Total KG</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.items || []).map((item, idx) => {
                        const isDusBotol = item.bobotPerUnit === 1 && isDusOrBotolProduct(stockList, item.jenisPupuk);
                        return (
                        <tr key={idx} className="border-b">
                          <td className="px-4 py-3 text-sm text-gray-900 border">{idx + 1}</td>
                          {selectedItem.jenis === "suratPengangkutanDO" && (
                            <>
                              <td className="px-4 py-3 text-sm text-gray-600 border">{item.nomorSubDO || "-"}</td>
                              <td className="px-4 py-3 text-sm text-gray-600 border">{item.nomorPO || "-"}</td>
                            </>
                          )}
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 border">{item.jenisPupuk}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{item.party || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono border">{item.pengambilanZAK || 0}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right font-mono border">{isDusBotol ? "-" : (item.totalKG || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{item.sisa || "-"}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {getTotalKGForSurat(selectedItem) > 0 && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Total Pengambilan</p>
                    <p className="text-2xl font-bold text-amber-700 font-mono">{getTotalKGForSurat(selectedItem).toLocaleString()} KG</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nomor Polisi</p>
                    <p className="text-lg font-semibold text-blue-700">{selectedItem.nomorPolisi || "-"}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Driver Unit</p>
                    <p className="text-lg font-semibold text-blue-700">{selectedItem.driverUnit || "-"}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nomor SIM</p>
                    <p className="text-lg font-semibold text-blue-700">{selectedItem.nomorSIM || "-"}</p>
                  </div>
                </div>
              </>
            ) : selectedItem.jenis === "barangKeluarBackup" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Driver</p>
                    <p className="text-lg font-semibold text-blue-700">{selectedItem.driverUnit}</p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nomor Polisi</p>
                    <p className="text-lg font-semibold text-blue-700 font-mono">{selectedItem.nomorPolisi}</p>
                  </div>
                </div>
                {selectedItem.nomorSIM && (
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nomor SIM</p>
                    <p className="text-lg font-semibold text-blue-700 font-mono">{selectedItem.nomorSIM}</p>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-stone-50">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-800 uppercase border">No</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-800 uppercase border">Kode</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-800 uppercase border">Nama Barang</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-800 uppercase border">Unit</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-stone-800 uppercase border">Jumlah</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-stone-800 uppercase border">Nomor PI</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.backupItems || []).map((it, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-4 py-3 text-sm text-gray-900 border">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm font-mono text-gray-600 border">{it.kodeBarang}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 border">{it.namaBarang}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{it.unit}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono border">
                            {it.unit === "DUS"
                              ? `${(it.pengambilanUnit / (it.botolPerDus || 20)).toLocaleString("id-ID", { maximumFractionDigits: 2 })} DUS (${it.pengambilanUnit.toLocaleString("id-ID")} botol)`
                              : it.unit === "BOTOL"
                              ? `${it.pengambilanUnit.toLocaleString("id-ID")} botol`
                              : `${it.pengambilanUnit.toLocaleString("id-ID")} ${it.unit}`}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{it.nomorPI}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(selectedItem.totalPengambilanKG || 0) > 0 && (
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Total Pengambilan</p>
                    <p className="text-2xl font-bold text-amber-700 font-mono">{(selectedItem.totalPengambilanKG || 0).toLocaleString("id-ID")} KG</p>
                  </div>
                )}
              </>
            ) : selectedItem.jenis !== "barangMasuk" && selectedItem.jenis !== "penggantianRusak" ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Kode Barang</p>
                    <p className="text-lg font-bold text-green-700 font-mono">{selectedItem.kodeBarang}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Nama Barang</p>
                    <p className="text-lg font-semibold text-gray-800">{selectedItem.namaBarang}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Unit</p>
                    <p className="text-lg font-bold text-gray-800">{selectedItem.unit}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">FOT</p>
                    <p className="text-lg font-bold text-indigo-700 font-mono">{selectedItem.fot}</p>
                  </div>
                </div>
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                  <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold mb-1">Jumlah</p>
                  <p className="text-3xl font-bold text-amber-700 font-mono">
                    {selectedItem.jumlahZAK.toLocaleString()} {selectedItem.unit === "KG" ? "KG" : "ZAK"}
                  </p>
                </div>
                {selectedItem.jenis === "barangKeluar" && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nama Customer</p>
                        <p className="text-lg font-semibold text-blue-700">{selectedItem.namaCustomer}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">No PI</p>
                        <p className="text-lg font-semibold text-blue-700 font-mono">{selectedItem.nomorPI}</p>
                      </div>
                    </div>
                  </>
                )}
              </>
            ) : null}
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Informasi Tambahan</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-gray-500">Dibuat Oleh:</span> <span className="font-medium">{selectedItem.createdBy}</span></p>
                <p><span className="text-gray-500">Tanggal Dibuat:</span> <span className="font-medium">{selectedItem.createdAt ? new Date(selectedItem.createdAt).toLocaleDateString("id-ID") : "-"}</span></p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {selectedFotoIndex !== null && selectedItem?.fotoUrls && (
        <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedFotoIndex(null)}>
          <div className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center">
            <button
              onClick={() => setSelectedFotoIndex(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={selectedItem.fotoUrls[selectedFotoIndex]}
              alt={`Foto ${selectedFotoIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <p className="text-white text-sm mt-4 font-medium">
              Foto {selectedFotoIndex + 1} dari {selectedItem.fotoUrls.length}
            </p>
            <div className="flex gap-2 mt-3">
              {selectedItem.fotoUrls.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => { e.stopPropagation(); setSelectedFotoIndex(idx); }}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${idx === selectedFotoIndex ? "bg-white" : "bg-white/40 hover:bg-white/60"}`}
                />
              ))}
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

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={isSuratEdit ? "Edit Surat Pengangkutan" : isBackupEdit ? "Edit Barang Keluar Backup" : `Edit ${selectedItem?.jenis === "barangMasuk" ? "Transaksi Barang Masuk" : selectedItem?.jenis === "penggantianRusak" ? "Penggantian Barang Rusak" : "Transaksi Barang Keluar"}`} size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleUpdate} isLoading={isSubmitting} disabled={isSuratEdit && !!nomorSeriError}>Simpan Perubahan</Button>
        </div>
      }>
        {isSuratEdit ? (
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Tanggal" type="date" value={editSuratForm.tanggal} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, tanggal: e.target.value }))} required />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Seri</label>
                <input type="text" value={editSuratForm.nomorSeri} onChange={handleNomorSeriChangeEdit} className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all font-mono text-sm ${nomorSeriError ? "border-red-500 bg-red-50" : "border-gray-300"}`} />
                {nomorSeriError && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {nomorSeriError}
                  </p>
                )}
              </div>
              <Input label="Nomor Polisi" type="text" value={editSuratForm.nomorPolisi} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, nomorPolisi: e.target.value }))} required />
              <Input label="Driver Unit" type="text" value={editSuratForm.driverUnit} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, driverUnit: e.target.value }))} required />
              <Input label="Nomor SIM" type="text" value={editSuratForm.nomorSIM} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, nomorSIM: e.target.value }))} className="md:col-span-2" />
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-700">Item Pengangkutan</h4>
              {editSuratForm.items.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="text-sm font-semibold text-gray-700">Item {idx + 1}</h5>
                    {editSuratForm.items.length > 1 && (
                      <button type="button" onClick={() => removeSuratItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input label="Nomor SUB DO" type="text" value={item.nomorSubDO} onChange={(e) => handleSuratItemChange(idx, "nomorSubDO", e.target.value)} />
                    <Input label="Nomor PO" type="text" value={item.nomorPO} onChange={(e) => handleSuratItemChange(idx, "nomorPO", e.target.value)} />
                    <Input label="Jenis Pupuk" type="text" value={item.jenisPupuk} onChange={(e) => handleSuratItemChange(idx, "jenisPupuk", e.target.value)} required />
                    <Input label="Party" type="text" value={item.party} onChange={(e) => handleSuratItemChange(idx, "party", e.target.value)} />
                    <Input label="Pengambilan (ZAK)" type="number" value={item.pengambilanZAK} onChange={(e) => handleSuratItemChange(idx, "pengambilanZAK", e.target.value)} required />
                    <Input label="Sisa" type="text" value={item.sisa} onChange={(e) => handleSuratItemChange(idx, "sisa", e.target.value)} />
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addSuratItem}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Tambah Item
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input label="Tanggal" type="date" value={editForm.tanggal} onChange={(e) => setEditForm((prev) => ({ ...prev, tanggal: e.target.value }))} required />
              <Input label="Kode Barang" type="text" value={editForm.kodeBarang} onChange={(e) => setEditForm((prev) => ({ ...prev, kodeBarang: e.target.value }))} required />
              <Input label="Nama Barang" type="text" value={editForm.namaBarang} onChange={(e) => setEditForm((prev) => ({ ...prev, namaBarang: e.target.value }))} required />
              <Select label="Unit" value={editForm.unit} onChange={(e) => setEditForm((prev) => ({ ...prev, unit: e.target.value as "ZAK" | "DUS" | "KG" | "BOTOL" }))} options={unitOptions} required />
              <Input label={`Jumlah (${editForm.unit === "KG" ? "KG" : "ZAK"})`} type="number" value={editForm.jumlahZAK} onChange={(e) => setEditForm((prev) => ({ ...prev, jumlahZAK: e.target.value }))} required />
              <Input label="FOT" type="text" value={editForm.fot} onChange={(e) => setEditForm((prev) => ({ ...prev, fot: e.target.value }))} required />
            </div>
            {selectedItem?.jenis === "barangMasuk" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Nomor Kontainer" type="text" value={editForm.nomorKontainer} onChange={(e) => setEditForm((prev) => ({ ...prev, nomorKontainer: e.target.value }))} required />
                <Input label="Nomor DO" type="text" value={editForm.nomorDO} onChange={(e) => setEditForm((prev) => ({ ...prev, nomorDO: e.target.value }))} />
              </div>
            )}
            {isBotol && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Botol per DUS" type="number" value={editForm.botolPerDus} onChange={(e) => setEditForm((prev) => ({ ...prev, botolPerDus: e.target.value }))} />
                <Input label="Bobot Per Botol (ml)" type="number" value={editForm.bobotPerBotol} onChange={(e) => setEditForm((prev) => ({ ...prev, bobotPerBotol: e.target.value }))} />
              </div>
            )}
            {selectedItem?.jenis === "barangMasuk" && (
              <Input label="Sopir / Nopol" type="text" value={editForm.sopirNopol} onChange={(e) => setEditForm((prev) => ({ ...prev, sopirNopol: e.target.value }))} required />
            )}
            {selectedItem?.jenis === "barangKeluar" && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Nama Customer" type="text" value={editForm.namaCustomer} onChange={(e) => setEditForm((prev) => ({ ...prev, namaCustomer: e.target.value }))} required />
                  <Input label="No PI / Proforma Invoice" type="text" value={editForm.nomorPI} onChange={(e) => setEditForm((prev) => ({ ...prev, nomorPI: e.target.value }))} required />
                  <Input label="No Invoice" type="text" value={editForm.nomorInvoice} onChange={(e) => setEditForm((prev) => ({ ...prev, nomorInvoice: e.target.value }))} required />
                  <Input label="Nomor Surat Pengangkutan" type="text" value={editForm.nomorSuratPengangkutan} onChange={(e) => setEditForm((prev) => ({ ...prev, nomorSuratPengangkutan: e.target.value }))} required />
                </div>
              </>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
}