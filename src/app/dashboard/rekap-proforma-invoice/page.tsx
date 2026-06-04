"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, where,
  serverTimestamp, getDoc, addDoc,
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
import { exportToExcel } from "@/app/utils/exportExcel";

interface ProdukItem {
  namaProduk: string;
  fot: string;
  produsen: string;
  kuantitas: number;
  satuan: string;
  hargaSatuan: number;
  hargaPerZakDus: number;
  bobotPerUnit: number;
  jumlahIsiBotol: number;
  totalHarga: number;
  includePPN?: boolean;
  ppnNominal?: number;
}

interface SuratMuatItem {
  nomorSubDO?: string;
  nomorPO?: string;
  nomorPI?: string;
  jenisPupuk: string;
  party?: string;
  pengambilanZAK: number;
  bobotPerUnit: number;
  totalKG: number;
  sisa?: string;
  fot?: string;
}

interface SuratMuatInfo {
  id: string;
  nomorSeri: string;
  tanggal: string;
  items: SuratMuatItem[];
  totalKG: number;
  nomorPolisi: string;
  driverUnit: string;
  nomorPI: string | string[];
  nomorSIM?: string;
  jenisSurat?: string;
  subJenisDO?: string;
  kepadaNama?: string;
  kepadaPerusahaan?: string;
  kepadaAlamat?: string;
  namaCustomer?: string | string[];
}

interface ProformaInvoice {
  id: string;
  tanggal: string;
  nomorPI: string;
  namaCustomer: string;
  alamatCustomer: string;
  npwp: string;
  metodePembayaran: string;
  produkItems: ProdukItem[];
  uangMuka: number;
  includePPN: boolean;
  ppnNominal: number;
  ongkosKirim: number;
  subtotal: number;
  jumlahTertagih: number;
  terbilang: string;
  tanggalJatuhTempo: string;
  keterangan: string;
  ttdNama: string;
  ttdJabatan: string;
  ttdImage: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  sisaPengambilanKG?: number;
  statusPengangkutan?: string;
  invoiceBaseNumber?: string;
  jumlahUangDibayar?: number;
  tanggalPembayaran?: string;
  statusPelunasan?: string;
  riwayatPembayaran?: RiwayatPembayaran[];
}

interface StockItem {
  id: string;
  namaBarang: string;
  bobotPerUnit: number;
  stokAkhirUnit: number;
  stokAkhirKG: number;
  barangKeluarUnit: number;
  barangKeluarKG: number;
}

interface EditSuratItem {
  nomorSubDO: string;
  nomorPO: string;
  jenisPupuk: string;
  party: string;
  pengambilanZAK: string;
  bobotPerUnit: number;
  sisa: string;
  maxZAK: number;
  fot: string;
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

interface BeritaAcaraItem {
  no: number;
  tanggalMuat: string;
  namaProduk: string;
  fot: string;
  qty: string;
  noSJ: string;
  driver: string;
  nopol: string;
}

interface RiwayatPembayaran {
  tanggal: string;
  jumlah: number;
}

type SuratMuatMap = Record<string, SuratMuatInfo[]>;

const getRomanMonth = (month: number) => {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
  return romans[month - 1] || "I";
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
  const giRegex = /^BAGB-SP\/\d{4}\/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\/\d{4}$/;
  const doRegex = /^BAGB-SP-DO.+-\d{4}$/;
  return giRegex.test(value.trim()) || doRegex.test(value.trim());
};

const parseInvoiceNumber = (nomor: string) => {
  const match = nomor.match(/^BAGB-INV(?:-S(\d+))?-(\d{4})$/);
  if (!match) return null;
  return {
    isPartial: !!match[1],
    partialNum: match[1] ? parseInt(match[1]) : 0,
    baseNum: parseInt(match[2]),
  };
};

const formatRupiah = (num: number) => {
  if (!num && num !== 0) return "Rp -";
  return "Rp " + num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
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

export default function RekapProformaInvoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<ProformaInvoice[]>([]);
  const [suratMuatMap, setSuratMuatMap] = useState<SuratMuatMap>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [selectedItem, setSelectedItem] = useState<ProformaInvoice | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditSuratModalOpen, setIsEditSuratModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<SuratMuatInfo | null>(null);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [existingSuratList, setExistingSuratList] = useState<ExistingSurat[]>([]);
  const [nomorSeriError, setNomorSeriError] = useState("");
  const [ttdList, setTtdList] = useState<TTDData[]>([]);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [invoiceSurat, setInvoiceSurat] = useState<SuratMuatInfo | null>(null);
  const [selectedOrderTTD, setSelectedOrderTTD] = useState("");
  const [invoiceNomor, setInvoiceNomor] = useState("");
  const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    jumlahUangDibayar: "",
    tanggalPembayaran: "",
    statusPelunasan: "",
  });
  const [bastExists, setBastExists] = useState(false);
  const [invoiceExists, setInvoiceExists] = useState(false);
  const [editForm, setEditForm] = useState({
    tanggal: "",
    nomorPI: "",
    namaCustomer: "",
    alamatCustomer: "",
    npwp: "",
    metodePembayaran: "Transfer",
    uangMuka: "",
    ongkosKirim: "",
    keterangan: "",
    produkItems: [] as ProdukItem[],
  });
  const [editSuratForm, setEditSuratForm] = useState({
    tanggal: "",
    nomorSeri: "",
    nomorPolisi: "",
    driverUnit: "",
    nomorSIM: "",
    jenisSurat: "gudangInduk",
    subJenisDO: "",
    kepadaNama: "",
    kepadaPerusahaan: "",
    kepadaAlamat: "",
    items: [] as EditSuratItem[],
  });

  useEffect(() => {
    fetchData();
    fetchSuratMuat();
    fetchStockGudang();
    fetchExistingSurat();
    fetchTTD();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      checkBastExists(selectedItem.nomorPI);
      checkInvoiceExists(selectedItem.nomorPI);
    } else {
      setBastExists(false);
      setInvoiceExists(false);
    }
  }, [selectedItem]);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          tanggal: d.tanggal || "",
          nomorPI: d.nomorPI || "",
          namaCustomer: d.namaCustomer || "",
          alamatCustomer: d.alamatCustomer || "",
          npwp: d.npwp || "",
          metodePembayaran: d.metodePembayaran || "Transfer",
          produkItems: d.produkItems || [],
          uangMuka: d.uangMuka || 0,
          includePPN: d.includePPN || false,
          ppnNominal: d.ppnNominal || 0,
          ongkosKirim: d.ongkosKirim || 0,
          subtotal: d.subtotal || 0,
          jumlahTertagih: d.jumlahTertagih || 0,
          terbilang: d.terbilang || "",
          tanggalJatuhTempo: d.tanggalJatuhTempo || "",
          keterangan: d.keterangan || "",
          ttdNama: d.ttdNama || "",
          ttdJabatan: d.ttdJabatan || "",
          ttdImage: d.ttdImage || "",
          createdBy: d.createdBy || "",
          createdAt: d.createdAt?.toDate(),
          updatedAt: d.updatedAt?.toDate(),
          sisaPengambilanKG: d.sisaPengambilanKG,
          statusPengangkutan: d.statusPengangkutan,
          invoiceBaseNumber: d.invoiceBaseNumber,
          jumlahUangDibayar: d.jumlahUangDibayar || 0,
          tanggalPembayaran: d.tanggalPembayaran || "",
          statusPelunasan: d.statusPelunasan || "Belum Lunas",
          riwayatPembayaran: d.riwayatPembayaran || [],
        } as ProformaInvoice;
      });
      setData(items);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        namaBarang: docSnap.data().namaBarang || "",
        bobotPerUnit: docSnap.data().bobotPerUnit || 50,
        stokAkhirUnit: docSnap.data().stokAkhirUnit || 0,
        stokAkhirKG: docSnap.data().stokAkhirKG || 0,
        barangKeluarUnit: docSnap.data().barangKeluarUnit || 0,
        barangKeluarKG: docSnap.data().barangKeluarKG || 0,
      } as StockItem));
      setStockList(data);
    } catch (error) { console.error(error); }
  };

  const fetchExistingSurat = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        nomorSeri: docSnap.data().nomorSeri || "",
      } as ExistingSurat));
      setExistingSuratList(data);
    } catch (error) { console.error(error); }
  };

  const fetchTTD = async () => {
    try {
      const q = query(collection(db, "ttd"), orderBy("nama", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as TTDData));
      setTtdList(data);
    } catch (error) { console.error(error); }
  };

  const checkBastExists = async (nomorPI: string) => {
    try {
      const q1 = query(collection(db, "beritaAcara"), where("nomorPI", "==", nomorPI));
      const snap1 = await getDocs(q1);
      const q2 = query(collection(db, "beritaAcara"), where("nomorPI", "array-contains", nomorPI));
      const snap2 = await getDocs(q2);
      setBastExists(!snap1.empty || !snap2.empty);
    } catch { setBastExists(false); }
  };

  const checkInvoiceExists = async (nomorPI: string) => {
    try {
      const piRow = data.find((d) => d.nomorPI === nomorPI);
      if (piRow && piRow.invoiceBaseNumber) { setInvoiceExists(true); return; }
      const suratQ1 = query(collection(db, "suratPengangkutan"), where("nomorPI", "==", nomorPI));
      const suratSnap1 = await getDocs(suratQ1);
      const suratQ2 = query(collection(db, "suratPengangkutan"), where("nomorPI", "array-contains", nomorPI));
      const suratSnap2 = await getDocs(suratQ2);
      let hasInvoice = false;
      [suratSnap1, suratSnap2].forEach((snap) => {
        snap.forEach((d) => { if (d.data().nomorInvoice) hasInvoice = true; });
      });
      setInvoiceExists(hasInvoice);
    } catch { setInvoiceExists(false); }
  };

  const getNextBastNumber = async (): Promise<string> => {
    const now = new Date();
    const year = now.getFullYear();
    const roman = getRomanMonth(now.getMonth() + 1);
    const prefix = `BAGB/BAB/${roman}/${year}`;
    const q = query(
      collection(db, "beritaAcara"),
      where("nomorSeri", ">=", prefix),
      where("nomorSeri", "<=", prefix + "\uf8ff"),
      orderBy("nomorSeri", "asc")
    );
    const snapshot = await getDocs(q);
    const numbers: number[] = [];
    snapshot.docs.forEach((d) => {
      const parts = d.data().nomorSeri?.split("/") || [];
      const last = parseInt(parts[parts.length - 1]);
      if (!isNaN(last)) numbers.push(last);
    });
    numbers.sort((a, b) => a - b);
    let nextNum = 1;
    for (const num of numbers) {
      if (num === nextNum) { nextNum++; } else if (num > nextNum) { break; }
    }
    return `${prefix}/${String(nextNum).padStart(4, "0")}`;
  };

  const checkNomorSeriExists = (value: string, excludeNomorSeri?: string) => {
    if (!value.trim()) { setNomorSeriError(""); return false; }
    if (!validateNomorSeriFormat(value)) {
      setNomorSeriError("Format nomor seri tidak valid.");
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

  const fetchSuratMuat = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const map: Record<string, SuratMuatInfo[]> = {};
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const rawPI = d.nomorPI;
        const piList: string[] = [];
        if (Array.isArray(rawPI)) {
          rawPI.forEach((p) => { if (p && typeof p === "string") piList.push(p); });
        } else if (rawPI && typeof rawPI === "string") {
          piList.push(rawPI);
        }
        const rawCustomer = d.namaCustomer;
        const firstCustomer = Array.isArray(rawCustomer) ? rawCustomer[0] : rawCustomer;
        const info: SuratMuatInfo = {
          id: docSnap.id,
          nomorSeri: d.nomorSeri || "",
          tanggal: d.tanggal || "",
          items: d.items || [],
          totalKG: d.totalPengambilanKG || 0,
          nomorPolisi: d.nomorPolisi || "",
          driverUnit: d.driverUnit || "",
          nomorPI: rawPI || "",
          nomorSIM: d.nomorSIM || "",
          jenisSurat: d.jenisSurat || "gudangInduk",
          subJenisDO: d.subJenisDO || null,
          kepadaNama: d.kepadaNama || firstCustomer || "",
          kepadaPerusahaan: d.kepadaPerusahaan || firstCustomer || "",
          kepadaAlamat: d.kepadaAlamat || "",
          namaCustomer: rawCustomer || "",
        };
        piList.forEach((pi) => {
          if (!map[pi]) map[pi] = [];
          map[pi].push(info);
        });
      });
      setSuratMuatMap(map);
    } catch (error) { console.error(error); }
  };

  const getStockForProduct = (namaProduk: string) => {
    return stockList.find((s) =>
      s.namaBarang.toUpperCase().includes(namaProduk.toUpperCase()) ||
      namaProduk.toUpperCase().includes(s.namaBarang.toUpperCase())
    );
  };

  const getSuratMuatForPI = (nomorPI: string): SuratMuatInfo[] => {
    const results: SuratMuatInfo[] = [];
    Object.values(suratMuatMap).forEach((list) => {
      list.forEach((surat) => {
        const rawPI = surat.nomorPI;
        let match = false;
        if (Array.isArray(rawPI)) { match = rawPI.includes(nomorPI); }
        else if (typeof rawPI === "string") { match = rawPI === nomorPI; }
        if (match && !results.find((r) => r.id === surat.id)) { results.push(surat); }
      });
    });
    return results;
  };

  const getTotalOrdered = (item: ProformaInvoice) => {
    return item.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
  };

  const getTotalLoaded = (nomorPI: string) => {
    const suratList = getSuratMuatForPI(nomorPI);
    return suratList.reduce((sum: number, s: SuratMuatInfo) => {
      return sum + (s.items || []).reduce((itemSum: number, it: SuratMuatItem) => {
        const itemPI = it.nomorPI || "";
        if (itemPI && itemPI !== nomorPI) return itemSum;
        return itemSum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
      }, 0);
    }, 0);
  };

  const getStatusPengangkutan = (item: ProformaInvoice) => {
    const totalOrdered = getTotalOrdered(item);
    const totalLoaded = getTotalLoaded(item.nomorPI);
    if (totalLoaded >= totalOrdered) return "complete";
    if (totalLoaded > 0) return "partial";
    return item.statusPengangkutan || "pending";
  };

  const getStatusBadge = (status: string) => {
    if (status === "complete") return { class: "bg-green-100 text-green-700", label: "Selesai Dimuat" };
    if (status === "partial") return { class: "bg-yellow-100 text-yellow-700", label: "Sebagian Dimuat" };
    return { class: "bg-gray-100 text-gray-600", label: "Belum Dimuat" };
  };

  const getPaymentStatus = (item: ProformaInvoice) => {
    const paid = (item.riwayatPembayaran || []).reduce((sum, r) => sum + (r.jumlah || 0), 0) || item.jumlahUangDibayar || 0;
    const total = item.jumlahTertagih || 0;
    if (paid >= total && total > 0) return "Lunas";
    if (paid > 0) return "Cicilan";
    return "Belum Lunas";
  };

  const getPaymentBadge = (status: string) => {
    if (status === "Lunas") return { class: "bg-green-100 text-green-700 border-green-200", label: "Lunas" };
    if (status === "Cicilan") return { class: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "Cicilan" };
    return { class: "bg-red-100 text-red-700 border-red-200", label: "Belum Lunas" };
  };

  const getProdukLoadStatus = (item: ProformaInvoice) => {
    const suratList = getSuratMuatForPI(item.nomorPI);
    return item.produkItems.map((prod) => {
      const ordered = prod.kuantitas || 0;
      let loaded = 0;
      suratList.forEach((surat: SuratMuatInfo) => {
        (surat.items || []).forEach((it: SuratMuatItem) => {
          const itemPI = it.nomorPI || "";
          if (itemPI && itemPI !== item.nomorPI) return;
          if (it.jenisPupuk && (
            it.jenisPupuk.toUpperCase().includes(prod.namaProduk.toUpperCase()) ||
            prod.namaProduk.toUpperCase().includes(it.jenisPupuk.toUpperCase())
          )) {
            loaded += (it.pengambilanZAK || 0) * (it.bobotPerUnit || 50);
          }
        });
      });
      const remaining = Math.max(0, ordered - loaded);
      let status = "pending";
      if (loaded >= ordered) status = "complete";
      else if (loaded > 0) status = "partial";
      return { namaProduk: prod.namaProduk, ordered, loaded, remaining, status };
    });
  };

  const getNextInvoiceBaseNumber = async (): Promise<string> => {
    const piQuery = query(collection(db, "proformaInvoice"), where("invoiceBaseNumber", "!=", ""));
    const piSnapshot = await getDocs(piQuery);
    const suratQuery = query(collection(db, "suratPengangkutan"), where("nomorInvoice", "!=", ""));
    const suratSnapshot = await getDocs(suratQuery);
    const usedBases: number[] = [];
    piSnapshot.docs.forEach((d) => {
      const bn = d.data().invoiceBaseNumber;
      if (bn) usedBases.push(parseInt(bn));
    });
    suratSnapshot.docs.forEach((d) => {
      const ni = d.data().nomorInvoice;
      if (ni) {
        const parsed = parseInvoiceNumber(ni);
        if (parsed) usedBases.push(parsed.baseNum);
      }
    });
    usedBases.sort((a, b) => a - b);
    let nextBase = 1;
    for (const num of usedBases) {
      if (num === nextBase) { nextBase++; } else if (num > nextBase) { break; }
    }
    return String(nextBase).padStart(4, "0");
  };

  const generateInvoiceNumber = async (surat: SuratMuatInfo): Promise<string> => {
    if (!selectedItem) return "";
    const suratRef = doc(db, "suratPengangkutan", surat.id);
    const suratSnap = await getDoc(suratRef);
    const existingNomor = suratSnap.data()?.nomorInvoice;
    if (existingNomor) {
      const parsed = parseInvoiceNumber(existingNomor);
      if (parsed) return existingNomor;
    }
    const piRef = doc(db, "proformaInvoice", selectedItem.id);
    const piSnap = await getDoc(piRef);
    let baseNumber = piSnap.data()?.invoiceBaseNumber;
    if (!baseNumber) {
      baseNumber = await getNextInvoiceBaseNumber();
      await updateDoc(piRef, { invoiceBaseNumber: baseNumber });
    }
    const suratQ1 = query(collection(db, "suratPengangkutan"), where("nomorPI", "==", selectedItem.nomorPI));
    const suratSnap1 = await getDocs(suratQ1);
    const suratQ2 = query(collection(db, "suratPengangkutan"), where("nomorPI", "array-contains", selectedItem.nomorPI));
    const suratSnap2 = await getDocs(suratQ2);
    const usedPartials = new Set<number>();
    [suratSnap1, suratSnap2].forEach((snap) => {
      snap.docs.forEach((d) => {
        const ni = d.data().nomorInvoice;
        if (ni && ni.includes("-S") && ni.endsWith(`-${baseNumber}`)) {
          const match = ni.match(/-S(\d+)-/);
          if (match) usedPartials.add(parseInt(match[1]));
        }
      });
    });
    let nextPartial = 1;
    while (usedPartials.has(nextPartial)) nextPartial++;
    const nomor = `BAGB-INV-S${nextPartial}-${baseNumber}`;
    await updateDoc(suratRef, { nomorInvoice: nomor });
    return nomor;
  };

  const handleOpenFullInvoice = async (row: ProformaInvoice) => {
    setSelectedItem(row);
    setInvoiceSurat(null);
    setSelectedOrderTTD("");
    setInvoiceNomor("");
    setIsInvoiceModalOpen(true);
    setIsGeneratingInvoice(true);
    try {
      const piRef = doc(db, "proformaInvoice", row.id);
      const piSnap = await getDoc(piRef);
      let baseNumber = piSnap.data()?.invoiceBaseNumber;
      if (!baseNumber) {
        baseNumber = await getNextInvoiceBaseNumber();
        await updateDoc(piRef, { invoiceBaseNumber: baseNumber });
      }
      const nomor = `BAGB-INV-${baseNumber}`;
      setInvoiceNomor(nomor);
    } catch (error) { console.error(error); } finally { setIsGeneratingInvoice(false); }
  };

  const handleOpenInvoice = async (surat: SuratMuatInfo) => {
    setInvoiceSurat(surat);
    setSelectedOrderTTD("");
    setInvoiceNomor("");
    setIsInvoiceModalOpen(true);
    setIsGeneratingInvoice(true);
    try {
      const nomor = await generateInvoiceNumber(surat);
      setInvoiceNomor(nomor);
    } catch (error) { console.error(error); } finally { setIsGeneratingInvoice(false); }
  };

  const handleResetBast = async (nomorPI: string) => {
    if (!confirm("Reset Berita Acara? Nomor seri akan dikembalikan ke pool.")) return;
    try {
      const q1 = query(collection(db, "beritaAcara"), where("nomorPI", "==", nomorPI));
      const snap1 = await getDocs(q1);
      for (const d of snap1.docs) { await deleteDoc(doc(db, "beritaAcara", d.id)); }
      const q2 = query(collection(db, "beritaAcara"), where("nomorPI", "array-contains", nomorPI));
      const snap2 = await getDocs(q2);
      for (const d of snap2.docs) { await deleteDoc(doc(db, "beritaAcara", d.id)); }
      setBastExists(false);
      fetchData();
    } catch (error) { console.error(error); }
  };

  const handleResetInvoice = async (nomorPI: string) => {
    if (!confirm("Reset Invoice? Nomor seri akan dikembalikan ke pool.")) return;
    try {
      const piRow = data.find((d) => d.nomorPI === nomorPI);
      if (piRow) {
        await updateDoc(doc(db, "proformaInvoice", piRow.id), {
          invoiceBaseNumber: null,
          updatedAt: serverTimestamp(),
        });
      }
      const suratQ1 = query(collection(db, "suratPengangkutan"), where("nomorPI", "==", nomorPI));
      const suratSnap1 = await getDocs(suratQ1);
      for (const d of suratSnap1.docs) {
        await updateDoc(doc(db, "suratPengangkutan", d.id), { nomorInvoice: null, updatedAt: serverTimestamp() });
      }
      const suratQ2 = query(collection(db, "suratPengangkutan"), where("nomorPI", "array-contains", nomorPI));
      const suratSnap2 = await getDocs(suratQ2);
      for (const d of suratSnap2.docs) {
        await updateDoc(doc(db, "suratPengangkutan", d.id), { nomorInvoice: null, updatedAt: serverTimestamp() });
      }
      setInvoiceExists(false);
      fetchData();
    } catch (error) { console.error(error); }
  };

  const filteredData = data.filter((item) => {
    const matchSearch =
      item.nomorPI?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaCustomer?.toLowerCase().includes(searchTerm.toLowerCase());
    const date = new Date(item.tanggal);
    const matchTanggal = filterTanggal ? item.tanggal === filterTanggal : true;
    const matchBulan = filterBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === filterBulan : true;
    const matchTahun = filterTahun ? date.getFullYear().toString() === filterTahun : true;
    return matchSearch && matchTanggal && matchBulan && matchTahun;
  });

  const handleDetail = (item: ProformaInvoice) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (item: ProformaInvoice) => {
    setSelectedItem(item);
    setEditForm({
      tanggal: item.tanggal,
      nomorPI: item.nomorPI,
      namaCustomer: item.namaCustomer,
      alamatCustomer: item.alamatCustomer,
      npwp: item.npwp || "",
      metodePembayaran: item.metodePembayaran,
      uangMuka: String(item.uangMuka || ""),
      ongkosKirim: String(item.ongkosKirim || ""),
      keterangan: item.keterangan || "",
      produkItems: (item.produkItems || []).map((p) => ({ ...p })),
    });
    setIsEditModalOpen(true);
  };

  const handleEditSurat = (surat: SuratMuatInfo) => {
    setSelectedSurat(surat);
    setNomorSeriError("");
    setEditSuratForm({
      tanggal: surat.tanggal,
      nomorSeri: surat.nomorSeri,
      nomorPolisi: surat.nomorPolisi,
      driverUnit: surat.driverUnit,
      nomorSIM: surat.nomorSIM || "",
      jenisSurat: surat.jenisSurat || "gudangInduk",
      subJenisDO: surat.subJenisDO || "",
      kepadaNama: surat.kepadaNama || "",
      kepadaPerusahaan: surat.kepadaPerusahaan || "",
      kepadaAlamat: surat.kepadaAlamat || "",
      items: (surat.items || []).map((it) => {
        const pengambilan = it.pengambilanZAK || 0;
        const sisa = parseFloat(it.sisa || "0") || 0;
        return {
          nomorSubDO: it.nomorSubDO || "",
          nomorPO: it.nomorPO || "",
          jenisPupuk: it.jenisPupuk || "",
          party: it.party || "",
          pengambilanZAK: String(pengambilan),
          bobotPerUnit: it.bobotPerUnit || 50,
          sisa: String(sisa),
          maxZAK: pengambilan + sisa,
          fot: it.fot || "",
        };
      }),
    });
    setIsEditSuratModalOpen(true);
  };

  const handleUpdateFull = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      let subtotal = 0;
      const updatedProdukItems = editForm.produkItems.map((p) => {
        const qty = p.kuantitas || 0;
        const price = p.hargaSatuan || 0;
        const total = qty * price;
        subtotal += total;
        return { ...p, totalHarga: total };
      });
      const uangMuka = parseFloat(editForm.uangMuka) || 0;
      const ongkosKirim = parseFloat(editForm.ongkosKirim) || 0;
      let ppn = 0;
      if (editForm.produkItems.some((p) => p.includePPN)) {
        ppn = editForm.produkItems.reduce((sum, p) => {
          if (p.includePPN) return sum + ((p.kuantitas || 0) * (p.hargaSatuan || 0) * 0.11);
          return sum;
        }, 0);
      }
      const jumlahTertagih = subtotal - uangMuka + ppn + ongkosKirim;
      await updateDoc(doc(db, "proformaInvoice", selectedItem.id), {
        tanggal: editForm.tanggal,
        nomorPI: editForm.nomorPI.trim(),
        namaCustomer: editForm.namaCustomer.trim(),
        alamatCustomer: editForm.alamatCustomer.trim(),
        npwp: editForm.npwp.trim(),
        metodePembayaran: editForm.metodePembayaran,
        produkItems: updatedProdukItems,
        uangMuka: uangMuka,
        includePPN: editForm.produkItems.some((p) => p.includePPN),
        ppnNominal: ppn,
        ongkosKirim: ongkosKirim,
        subtotal: subtotal,
        jumlahTertagih: jumlahTertagih,
        keterangan: editForm.keterangan.trim(),
        updatedAt: serverTimestamp(),
      });
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleUpdateSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurat || !selectedItem) return;
    const newNomorSeri = editSuratForm.nomorSeri.trim();
    if (checkNomorSeriExists(newNomorSeri, selectedSurat.nomorSeri)) { return; }
    setIsSubmitting(true);
    try {
      const oldItems = selectedSurat.items || [];
      const newItems = editSuratForm.items.map((it) => ({
        nomorSubDO: it.nomorSubDO,
        nomorPO: it.nomorPO,
        jenisPupuk: it.jenisPupuk,
        party: it.party,
        pengambilanZAK: parseFloat(it.pengambilanZAK) || 0,
        bobotPerUnit: it.bobotPerUnit,
        totalKG: (parseFloat(it.pengambilanZAK) || 0) * it.bobotPerUnit,
        sisa: it.sisa,
        fot: it.fot || "",
      }));
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
      if (editSuratForm.jenisSurat !== "gudangInduk") {
        updateData.jenisSurat = editSuratForm.jenisSurat;
        updateData.subJenisDO = editSuratForm.subJenisDO || null;
        updateData.kepadaNama = editSuratForm.kepadaNama.trim();
        updateData.kepadaPerusahaan = editSuratForm.kepadaPerusahaan.trim();
        updateData.kepadaAlamat = editSuratForm.kepadaAlamat.trim();
      }
      await updateDoc(doc(db, "suratPengangkutan", selectedSurat.id), updateData);
      const transaksiQuery = query(collection(db, "transaksiBarangKeluar"), where("nomorSeri", "==", selectedSurat.nomorSeri));
      const transaksiSnapshot = await getDocs(transaksiQuery);
      if (!transaksiSnapshot.empty) {
        await updateDoc(doc(db, "transaksiBarangKeluar", transaksiSnapshot.docs[0].id), {
          ...updateData,
          nomorSeri: newNomorSeri,
        });
      }
      const oldTotalKG = oldItems.reduce((sum, it) => sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50)), 0);
      const delta = oldTotalKG - totalPengambilanKG;
      const piNomors = Array.isArray(selectedSurat.nomorPI) ? selectedSurat.nomorPI : [selectedSurat.nomorPI].filter(Boolean);
      for (const piNomor of piNomors) {
        const piRow = data.find((d) => d.nomorPI === piNomor);
        if (!piRow) continue;
        const piRef = doc(db, "proformaInvoice", piRow.id);
        const piSnap = await getDoc(piRef);
        if (piSnap.exists()) {
          const piData = piSnap.data();
          const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
          const newSisa = Math.max(0, currentSisa + delta);
          const totalOrdered = piRow.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
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
      const isGI = !selectedSurat.jenisSurat || selectedSurat.jenisSurat === "gudangInduk";
      if (isGI) {
        const productMapOld: Record<string, number> = {};
        const productMapNew: Record<string, number> = {};
        oldItems.forEach((it) => {
          const key = it.jenisPupuk;
          productMapOld[key] = (productMapOld[key] || 0) + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
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
      setIsEditSuratModalOpen(false);
      fetchData();
      fetchSuratMuat();
      fetchStockGudang();
      fetchExistingSurat();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleDeleteSurat = async (surat: SuratMuatInfo) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus surat pengangkutan ${surat.nomorSeri}?`)) return;
    try {
      const totalKG = (surat.items || []).reduce((sum, it) => sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50)), 0);
      const piNomors = Array.isArray(surat.nomorPI) ? surat.nomorPI : [surat.nomorPI].filter(Boolean);
      for (const piNomor of piNomors) {
        const piRow = data.find((d) => d.nomorPI === piNomor);
        if (!piRow) continue;
        const piRef = doc(db, "proformaInvoice", piRow.id);
        const piSnap = await getDoc(piRef);
        if (piSnap.exists()) {
          const piData = piSnap.data();
          const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
          const newSisa = currentSisa + totalKG;
          const totalOrdered = piRow.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
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
      const isGI = !surat.jenisSurat || surat.jenisSurat === "gudangInduk";
      if (isGI) {
        const productMap: Record<string, number> = {};
        (surat.items || []).forEach((it: SuratMuatItem) => {
          const key = it.jenisPupuk;
          productMap[key] = (productMap[key] || 0) + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
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
      const transaksiQuery = query(collection(db, "transaksiBarangKeluar"), where("nomorSeri", "==", surat.nomorSeri));
      const transaksiSnapshot = await getDocs(transaksiQuery);
      if (!transaksiSnapshot.empty) {
        await deleteDoc(doc(db, "transaksiBarangKeluar", transaksiSnapshot.docs[0].id));
      }
      await deleteDoc(doc(db, "suratPengangkutan", surat.id));
      fetchData();
      fetchSuratMuat();
      fetchStockGudang();
      fetchExistingSurat();
    } catch (error) { console.error(error); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini? Semua surat pengangkutan, berita acara, invoice, dan riwayat transaksi terkait juga akan dihapus.")) return;
    setIsLoading(true);
    try {
      const piDoc = data.find((d) => d.id === id);
      if (!piDoc) { setIsLoading(false); return; }
      const nomorPI = piDoc.nomorPI;
      const suratDocsMap = new Map<string, any>();
      const suratQuery1 = query(collection(db, "suratPengangkutan"), where("nomorPI", "==", nomorPI));
      const suratSnap1 = await getDocs(suratQuery1);
      suratSnap1.docs.forEach((d) => suratDocsMap.set(d.id, d));
      const suratQuery2 = query(collection(db, "suratPengangkutan"), where("nomorPI", "array-contains", nomorPI));
      const suratSnap2 = await getDocs(suratQuery2);
      suratSnap2.docs.forEach((d) => suratDocsMap.set(d.id, d));
      const deletedSuratSeriSet = new Set<string>();
      for (const [, suratDoc] of suratDocsMap) {
        const suratData = suratDoc.data();
        const items = suratData.items || [];
        const isGI = !suratData.jenisSurat || suratData.jenisSurat === "gudangInduk";
        if (isGI) {
          for (const item of items) {
            const stock = getStockForProduct(item.jenisPupuk);
            if (stock) {
              const stockRef = doc(db, "stockGudang", stock.id);
              const stockSnap = await getDoc(stockRef);
              if (stockSnap.exists()) {
                const sData = stockSnap.data();
                const zak = parseFloat(String(item.pengambilanZAK)) || 0;
                const bobot = item.bobotPerUnit || stock.bobotPerUnit || 50;
                const kg = zak * bobot;
                const currentUnit = sData.stokAkhirUnit || 0;
                const currentKG = sData.stokAkhirKG || 0;
                const currentKeluarUnit = sData.barangKeluarUnit || 0;
                const currentKeluarKG = sData.barangKeluarKG || 0;
                await updateDoc(stockRef, {
                  stokAkhirUnit: currentUnit + zak,
                  stokAkhirKG: currentKG + kg,
                  barangKeluarUnit: Math.max(0, currentKeluarUnit - zak),
                  barangKeluarKG: Math.max(0, currentKeluarKG - kg),
                  updatedAt: serverTimestamp(),
                });
              }
            }
          }
        }
        if (suratData.nomorSeri) { deletedSuratSeriSet.add(suratData.nomorSeri); }
      }
      for (const [docId] of suratDocsMap) { await deleteDoc(doc(db, "suratPengangkutan", docId)); }
      const deletedSuratSeri = Array.from(deletedSuratSeriSet);
      if (deletedSuratSeri.length > 0) {
        for (let i = 0; i < deletedSuratSeri.length; i += 10) {
          const batch = deletedSuratSeri.slice(i, i + 10);
          const q = query(collection(db, "transaksiBarangKeluar"), where("nomorSeri", "in", batch));
          const snap = await getDocs(q);
          for (const d of snap.docs) { await deleteDoc(doc(db, "transaksiBarangKeluar", d.id)); }
        }
      }
      const transaksiQuery1 = query(collection(db, "transaksiBarangKeluar"), where("nomorPI", "==", nomorPI));
      const transaksiSnap1 = await getDocs(transaksiQuery1);
      for (const d of transaksiSnap1.docs) { await deleteDoc(doc(db, "transaksiBarangKeluar", d.id)); }
      const transaksiQuery2 = query(collection(db, "transaksiBarangKeluar"), where("nomorPIList", "array-contains", nomorPI));
      const transaksiSnap2 = await getDocs(transaksiQuery2);
      for (const d of transaksiSnap2.docs) { await deleteDoc(doc(db, "transaksiBarangKeluar", d.id)); }
      const baQuery1 = query(collection(db, "beritaAcara"), where("nomorPI", "==", nomorPI));
      const baSnap1 = await getDocs(baQuery1);
      for (const d of baSnap1.docs) { await deleteDoc(doc(db, "beritaAcara", d.id)); }
      const baQuery2 = query(collection(db, "beritaAcara"), where("nomorPI", "array-contains", nomorPI));
      const baSnap2 = await getDocs(baQuery2);
      for (const d of baSnap2.docs) { await deleteDoc(doc(db, "beritaAcara", d.id)); }
      await deleteDoc(doc(db, "proformaInvoice", id));
      await fetchData();
      await fetchSuratMuat();
      await fetchStockGudang();
      await fetchExistingSurat();
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus data. Silakan coba lagi.");
    } finally { setIsLoading(false); }
  };

  const handleGenerateBast = async (item: ProformaInvoice) => {
    try {
      const nomor = await getNextBastNumber();
      const suratList = getSuratMuatForPI(item.nomorPI);
      const bastItems: BeritaAcaraItem[] = [];
      let no = 1;
      suratList.forEach((surat) => {
        const suratItems = (surat.items || []).filter((it) => {
          const itemPI = it.nomorPI || "";
          return !itemPI || itemPI === item.nomorPI;
        });
        if (suratItems.length === 0) return;
        const totalZAK = suratItems.reduce((sum, it) => sum + (it.pengambilanZAK || 0), 0);
        const produkNames = suratItems.map((it) => it.jenisPupuk).filter(Boolean).join(", ");
        const fotSet = new Set(suratItems.map((it) => it.fot || "").filter(Boolean));
        const fot = Array.from(fotSet).join(", ");
        bastItems.push({
          no: no++,
          tanggalMuat: surat.tanggal,
          namaProduk: produkNames,
          fot: fot,
          qty: `${totalZAK} ZAK`,
          noSJ: surat.nomorSeri,
          driver: surat.driverUnit || "",
          nopol: surat.nomorPolisi || "",
        });
      });
      const q1 = query(collection(db, "beritaAcara"), where("nomorPI", "==", item.nomorPI));
      const snap1 = await getDocs(q1);
      for (const d of snap1.docs) { await deleteDoc(doc(db, "beritaAcara", d.id)); }
      const q2 = query(collection(db, "beritaAcara"), where("nomorPI", "array-contains", item.nomorPI));
      const snap2 = await getDocs(q2);
      for (const d of snap2.docs) { await deleteDoc(doc(db, "beritaAcara", d.id)); }
      await addDoc(collection(db, "beritaAcara"), {
        nomorSeri: nomor,
        nomorPI: item.nomorPI,
        namaCustomer: item.namaCustomer,
        tanggal: new Date().toISOString().split("T")[0],
        pihakPertama: { nama: "", jabatan: "", perusahaan: "PT Bukit Agrochemical Baru" },
        pihakKedua: { nama: item.namaCustomer, alamat: item.alamatCustomer },
        items: bastItems,
        createdAt: serverTimestamp(),
      });
      setBastExists(true);
    } catch (error) { console.error(error); }
  };

  const handlePrintBastSimple = async (item: ProformaInvoice) => {
    let baData: any = null;
    const q1 = query(collection(db, "beritaAcara"), where("nomorPI", "==", item.nomorPI));
    const snap1 = await getDocs(q1);
    if (!snap1.empty) baData = snap1.docs[0].data();
    if (!baData) {
      const q2 = query(collection(db, "beritaAcara"), where("nomorPI", "array-contains", item.nomorPI));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) baData = snap2.docs[0].data();
    }
    if (!baData) {
      alert("Berita Acara belum dibuat. Silakan generate terlebih dahulu.");
      return;
    }
    const bastItems: BeritaAcaraItem[] = baData.items || [];
    const now = new Date();
    const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
    const tanggalLengkap = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const rowsHtml = bastItems.map((it) => `
      <tr>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.no}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.tanggalMuat}</td>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.namaProduk}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.fot || "-"}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.qty}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.noSJ}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.driver}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nopol}</td>
      </tr>
    `).join("");
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Berita Acara ${baData.nomorSeri}</title>
        <style>
          @page { size: A4; margin: 10mm 12mm 10mm 12mm; }
          @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #000; }
          .page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; display: flex; flex-direction: column; }
          .header-img { width: 100%; display: block; margin-bottom: 0; }
          .title-bar { text-align: center; margin: 8px 0 12px 0; }
          .title-bar h1 { font-size: 14px; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; text-decoration: underline; }
          .title-bar p { font-size: 11px; font-weight: 600; }
          .content { padding: 0 4px; flex: 1; }
          .opening { margin-bottom: 12px; font-size: 10px; }
          .party-section { margin-bottom: 10px; }
          .party-title { font-weight: 700; margin-bottom: 4px; font-size: 10px; }
          .party-table { width: 100%; margin-bottom: 8px; font-size: 10px; }
          .party-table td { padding: 2px 0; vertical-align: top; }
          .party-label { width: 100px; font-weight: 600; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
          .data-table th { background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .data-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: top; }
          .closing { margin-bottom: 16px; font-size: 10px; text-align: justify; }
          .signature-row { display: flex; justify-content: space-between; margin-top: 30px; }
          .signature-box { width: 45%; text-align: center; }
          .signature-title { font-size: 9px; margin-bottom: 50px; }
          .signature-name { font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block; }
          .signature-role { font-size: 9px; color: #333; margin-top: 2px; }
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
          <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display=\'none\'" />
          <div class="title-bar">
            <h1>BERITA ACARA SERAH TERIMA BARANG</h1>
            <p>${baData.nomorSeri}</p>
          </div>
          <div class="content">
            <p class="opening">Kami yang bertanda tangan di bawah ini, pada hari ${hari}, ${tanggalLengkap}</p>
            <div class="party-section">
              <p class="party-title">Selanjutnya disebut Pihak Pertama.</p>
              <table class="party-table">
                <tr><td class="party-label">Nama</td><td>: ........................</td></tr>
                <tr><td class="party-label">Perusahaan</td><td>: PT Bukit Agrochemical Baru</td></tr>
                <tr><td class="party-label">Jabatan</td><td>: ........................</td></tr>
              </table>
            </div>
            <div class="party-section">
              <p class="party-title">Selanjutnya yang disebut Pihak Kedua.</p>
              <table class="party-table">
                <tr><td class="party-label">Nama</td><td>: ${item.namaCustomer}</td></tr>
                <tr><td class="party-label">Alamat</td><td>: ${(item.alamatCustomer || "").replace(/\n/g, " ")}</td></tr>
              </table>
            </div>
            <p class="opening">Pihak pertama menyerahkan barang kepada pihak kedua, dan pihak kedua menyatakan telah menerima barang dari pihak pertama, berupa daftar terlampir :</p>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 30px;">No</th>
                  <th style="width: 80px;">Tanggal Muat</th>
                  <th>Nama Produk</th>
                  <th style="width: 80px;">FOT / No DO</th>
                  <th style="width: 70px;">QTY</th>
                  <th style="width: 120px;">No SJ</th>
                  <th style="width: 90px;">Driver</th>
                  <th style="width: 80px;">Nopol</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <p class="closing">Demikian berita acara serah terima barang ini diperbuat oleh kedua belah pihak, adapun barang-barang tersebut dalam keadaan baik dan cukup, sejak penandatanganan berita acara ini, maka barang-barang tersebut menjadi tanggung jawab pihak kedua.</p>
            <div style="display: flex; justify-content: space-between; margin-top: 40px; align-items: flex-end;">
              <div style="width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                <p style="font-size: 10px; font-weight: 700; margin-bottom: 8px;">PIHAK KEDUA</p>
                <div style="width: 100%; min-height: 80px; margin-bottom: 8px;"></div>
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px; display: block; width: 90%; margin-left: auto; margin-right: auto;">${item.namaCustomer || "_________________"}</p>
              </div>
              <div style="width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                <p style="font-size: 10px; font-weight: 700; margin-bottom: 8px;">PIHAK PERTAMA</p>
                <div style="position: relative; width: 100%; min-height: 80px; margin-bottom: 8px; display: flex; align-items: flex-end; justify-content: center;">
                  <img src="/LogoAGRO.png" alt="Stempel" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 80px; max-width: 100px; opacity: 0.25; object-fit: contain; z-index: 1;" onerror="this.style.display=\'none\'" />
                  <div style="position: relative; z-index: 2; min-height: 70px;"></div>
                </div>
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px; display: block; width: 90%; margin-left: auto; margin-right: auto;">_________________</p>
                <p style="font-size: 9px; color: #333; margin-top: 3px;">PT Bukit Agrochemical Baru</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleOpenPaymentEdit = (item: ProformaInvoice) => {
    setSelectedItem(item);
    setPaymentForm({
      jumlahUangDibayar: "",
      tanggalPembayaran: new Date().toISOString().split("T")[0],
      statusPelunasan: item.statusPelunasan || getPaymentStatus(item),
    });
    setIsPaymentModalOpen(true);
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      const newJumlah = parseFloat(paymentForm.jumlahUangDibayar) || 0;
      const newTanggal = paymentForm.tanggalPembayaran.trim();
      const existingRiwayat = selectedItem.riwayatPembayaran || [];
      const updatedRiwayat = [...existingRiwayat, { tanggal: newTanggal, jumlah: newJumlah }];
      const totalPaid = updatedRiwayat.reduce((sum, r) => sum + r.jumlah, 0);
      const total = selectedItem.jumlahTertagih || 0;
      let status = "Belum Lunas";
      if (totalPaid >= total && total > 0) status = "Lunas";
      else if (totalPaid > 0) status = "Cicilan";
      await updateDoc(doc(db, "proformaInvoice", selectedItem.id), {
        riwayatPembayaran: updatedRiwayat,
        jumlahUangDibayar: totalPaid,
        tanggalPembayaran: newTanggal,
        statusPelunasan: status,
        updatedAt: serverTimestamp(),
      });
      setIsPaymentModalOpen(false);
      fetchData();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleExportExcel = () => {
    const exportData: any[] = [];
    filteredData.forEach((item) => {
      const produkRows = item.produkItems.map((p, idx) => ({
        "No": idx + 1,
        "Nama Produk": p.namaProduk,
        "FOT": p.fot || "",
        "Produsen": p.produsen || "",
        "Kuantitas": p.kuantitas || 0,
        "Satuan": p.satuan || "",
        "Harga Satuan": p.hargaSatuan || 0,
        "Harga Per ZAK/DUS": p.hargaPerZakDus || 0,
        "Total Harga": p.totalHarga || 0,
        "PPN 11%": p.includePPN ? (p.ppnNominal || ((p.kuantitas || 0) * (p.hargaSatuan || 0) * 0.11)) : 0,
      }));
      const suratList = getSuratMuatForPI(item.nomorPI);
      const suratRows = suratList.map((s, idx) => ({
        "No Surat": idx + 1,
        "Nomor Seri": s.nomorSeri,
        "Tanggal Surat": s.tanggal,
        "Driver": s.driverUnit,
        "No Polisi": s.nomorPolisi,
        "Total KG": s.totalKG,
      }));
      exportData.push({
        "Tanggal PI": item.tanggal,
        "Nomor PI": item.nomorPI,
        "Nama Customer": item.namaCustomer,
        "Alamat": item.alamatCustomer,
        "NPWP": item.npwp || "",
        "Metode Pembayaran": item.metodePembayaran,
        "Subtotal": item.subtotal,
        "Total PPN": item.ppnNominal,
        "Uang Muka": item.uangMuka || 0,
        "Ongkos Kirim": item.ongkosKirim || 0,
        "Jumlah Tertagih": item.jumlahTertagih,
        "Terbilang": item.terbilang,
        "Jatuh Tempo": item.tanggalJatuhTempo,
        "Keterangan": item.keterangan,
        "Status Pengangkutan": getStatusPengangkutan(item),
        "Status Pelunasan": item.statusPelunasan || getPaymentStatus(item),
        "Jumlah Dibayar": item.jumlahUangDibayar || 0,
        "Tanggal Pembayaran": item.tanggalPembayaran || "",
        "Sisa (KG)": item.sisaPengambilanKG || 0,
        "Dibuat Oleh": item.createdBy,
        "Produk Count": item.produkItems.length,
        "Produk Detail": JSON.stringify(produkRows),
        "Surat Muat Count": suratList.length,
        "Surat Muat Detail": JSON.stringify(suratRows),
      });
    });
    exportToExcel(exportData, `Rekap_Proforma_Invoice_${new Date().toISOString().split("T")[0]}`, "Rekap PI");
  };

  const handlePrintPDF = (item: ProformaInvoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const produkRows = (item.produkItems || []).map((p, idx) => `
      <tr>
        <td style="text-align: center; padding: 5px 3px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">${idx + 1}</td>
        <td style="padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600; height: 28px;">${p.namaProduk || ""}</td>
        <td style="text-align: center; padding: 5px 3px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">${p.fot || ""}</td>
        <td style="padding: 5px 8px; font-size: 9px; border: 1px solid #000; vertical-align: top; height: 28px; color: #555;">${p.produsen || ""}</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">${p.kuantitas?.toLocaleString("id-ID") || "0"}</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">${formatRupiah(p.hargaSatuan)}</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600; height: 28px;">${formatRupiah(p.totalHarga)}</td>
      </tr>
    `).join("");
    const emptyRowsCount = Math.max(0, 10 - (item.produkItems || []).length);
    const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => `
      <tr>
        <td style="text-align: center; padding: 5px 3px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">${(item.produkItems || []).length + i + 1}</td>
        <td style="padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: center; padding: 5px 3px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="padding: 5px 8px; font-size: 9px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
      </tr>
    `).join("");
    const createdAtStr = item.createdAt instanceof Date
      ? item.createdAt.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "-";
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Proforma Invoice ${item.nomorPI}</title>
        <style>
          @page { size: A4; margin: 12mm 14mm 12mm 14mm; }
          @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: white; color: #000; font-size: 10px; line-height: 1.3; }
          .page { width: 182mm; margin: 0 auto; background: white; position: relative; min-height: 257mm; }
          .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 280px; height: auto; opacity: 0.08; pointer-events: none; z-index: 0; }
          .content-layer { position: relative; z-index: 1; }
          .header-img { width: 100%; display: block; margin-bottom: 0; }
          .invoice-title { text-align: center; margin: 8px 0 10px 0; padding: 5px 0; background: #dcfce7; border-top: 2px solid #16a34a; border-bottom: 2px solid #16a34a; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .invoice-title h1 { color: #111; font-size: 15px; margin: 0; font-weight: bold; letter-spacing: 3px; }
          .info-section { margin-bottom: 10px; }
          .kepada-label { font-size: 9px; color: #333; margin-bottom: 2px; }
          .info-row { display: flex; justify-content: space-between; gap: 0; }
          .customer-box { flex: 1; border: 1px solid #000; padding: 8px 10px; min-height: 75px; }
          .customer-name { font-size: 11px; font-weight: 700; color: #000; margin: 0 0 3px 0; }
          .customer-address { font-size: 9px; color: #333; line-height: 1.5; }
          .invoice-meta { width: 250px; padding: 0 0 0 10px; }
          .meta-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 9px; border-bottom: 1px solid #ddd; }
          .meta-row:last-child { border-bottom: none; }
          .meta-label { color: #333; min-width: 90px; }
          .meta-colon { margin: 0 3px; }
          .meta-value { color: #000; font-weight: 600; text-align: right; flex: 1; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
          .data-table th { background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .data-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: top; }
          .summary-row { display: flex; border: 1px solid #000; border-top: none; }
          .terbilang-area { flex: 1; padding: 8px 10px; border-right: 1px solid #000; }
          .terbilang-title { font-size: 9px; color: #333; margin-bottom: 3px; font-weight: 600; }
          .terbilang-text { font-size: 10px; color: #000; font-weight: 700; text-transform: uppercase; line-height: 1.4; }
          .calc-area { width: 250px; padding: 0; }
          .calc-line { display: flex; justify-content: space-between; padding: 3px 10px; border-bottom: 1px solid #ddd; font-size: 9px; }
          .calc-line:last-child { border-bottom: none; background: #f0fdf4; border-top: 1px solid #16a34a; padding: 5px 10px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .calc-name { color: #333; }
          .calc-name-bold { font-weight: 700; color: #000; }
          .calc-amount { font-weight: 600; font-family: monospace; font-size: 9px; }
          .calc-amount-bold { font-size: 10px; color: #000; font-weight: 700; font-family: monospace; }
          .due-date { padding: 5px 10px; text-align: right; border-top: 1px solid #ddd; font-size: 11px; }
          .due-label { color: #666; font-size: 11px; }
          .due-value { color: #dc2626; font-weight: 700; font-size: 11px; }
          .created-info { padding: 4px 10px; text-align: right; border-top: 1px solid #eee; font-size: 10px; color: #666; }
          .footer-row { display: flex; border: 1px solid #000; border-top: none; }
          .footer-bank-area { flex: 1; padding: 8px 10px; border-right: 1px solid #000; }
          .footer-bank-title { font-size: 9px; font-weight: 700; color: #000; margin-bottom: 5px; }
          .footer-bank-text { font-size: 8px; line-height: 1.6; color: #333; }
          .footer-bank-text strong { color: #000; font-size: 9px; }
          .footer-ttd-area { width: 180px; padding: 8px 10px; text-align: center; }
          .ttd-title { font-size: 9px; color: #333; margin-bottom: 6px; }
          .ttd-img { height: 40px; object-fit: contain; margin: 0 auto 4px auto; display: block; }
          .ttd-name { font-size: 10px; font-weight: 700; color: #000; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block; }
          .ttd-role { font-size: 8px; color: #555; }
          .print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
          .print-btn:hover { background: #15803d; }
          .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
          @media print { .print-bar { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="page">
          <img src="/LogoAGRO.png" alt="Watermark" class="watermark" onerror="this.style.display=\'none\'" />
          <div class="content-layer">
            <img src="/logo.png" alt="Header" class="header-img" onerror="this.style.display=\'none\'; this.parentElement.insertAdjacentHTML(\'afterbegin\', \'<div style=text-align:center;padding:10px;border:1px solid #ccc;margin-bottom:10px;>Logo tidak tersedia</div>\');" />
            <div class="invoice-title">
              <h1>PROFORMA INVOICE</h1>
            </div>
            <div class="info-section">
              <p class="kepada-label">Kepada Yth,</p>
              <div class="info-row">
                <div class="customer-box">
                  <p class="customer-name">${item.namaCustomer || ""}</p>
                  <p class="customer-address">${(item.alamatCustomer || "").replace(/\n/g, "<br>")}</p>
                </div>
                <div class="invoice-meta">
                  <div class="meta-row"><span class="meta-label">Tanggal</span><span class="meta-colon">:</span><span class="meta-value">${item.tanggal || ""}</span></div>
                  <div class="meta-row"><span class="meta-label">No Invoice</span><span class="meta-colon">:</span><span class="meta-value">${item.nomorPI || ""}</span></div>
                  <div class="meta-row"><span class="meta-label">Metode Pembayaran</span><span class="meta-colon">:</span><span class="meta-value">${item.metodePembayaran || ""}</span></div>
                  ${item.npwp ? `<div class="meta-row"><span class="meta-label">NPWP</span><span class="meta-colon">:</span><span class="meta-value">${item.npwp}</span></div>` : ""}
                </div>
              </div>
            </div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 28px;">NO</th>
                  <th style="text-align: left; padding-left: 8px;">Nama Produk</th>
                  <th style="width: 45px;">Fot</th>
                  <th style="width: 90px;">Produsen</th>
                  <th style="width: 60px;">Kuantitas<br>(kg)</th>
                  <th style="width: 95px;">Harga Satuan</th>
                  <th style="width: 105px;">Total Harga</th>
                </tr>
              </thead>
              <tbody>${produkRows}${emptyRows}</tbody>
            </table>
            <div class="summary-row">
              <div class="terbilang-area">
                <div class="terbilang-title">Terbilang :</div>
                <div class="terbilang-text">${item.terbilang || "-"}</div>
              </div>
              <div class="calc-area">
                <div class="calc-line"><span class="calc-name">Subtotal</span><span class="calc-amount">${formatRupiah(item.subtotal)}</span></div>
                ${(item.uangMuka || 0) > 0 ? `<div class="calc-line"><span class="calc-name">Uang Muka</span><span class="calc-amount">${formatRupiah(item.uangMuka)}</span></div>` : ""}
                ${item.includePPN ? `<div class="calc-line"><span class="calc-name">PPN 11%</span><span class="calc-amount">${formatRupiah(item.ppnNominal)}</span></div>` : ""}
                ${(item.ongkosKirim || 0) > 0 ? `<div class="calc-line"><span class="calc-name">Ongkos Kirim</span><span class="calc-amount">${formatRupiah(item.ongkosKirim)}</span></div>` : ""}
                <div class="calc-line"><span class="calc-name-bold">Jumlah Tertagih</span><span class="calc-amount-bold">${formatRupiah(item.jumlahTertagih)}</span></div>
                <div class="due-date"><span class="due-label">Tanggal Jatuh Tempo : </span><span class="due-value">${item.tanggalJatuhTempo || ""}</span></div>
                <div class="created-info">Dibuat: ${createdAtStr}</div>
              </div>
            </div>
            <div class="footer-row">
              <div class="footer-bank-area">
                <p class="footer-bank-title">Pembayaran mohon ditransfer via rekening:</p>
                <div class="footer-bank-text">
                  <p><strong>BANK MANDIRI</strong> - Cabang Lamandau</p>
                  <p>a/n PT Bukit Agrochemical Baru</p>
                  <p>No. Rek : 159-00-1205477-0</p>
                  <p style="margin-top: 3px;"><strong>BANK BRI</strong> - Cabang Lamandau</p>
                  <p>a/n PT Bukit Agrochemical Baru</p>
                  <p>No. Rek : 2232-01000-879-567</p>
                </div>
              </div>
              <div class="footer-ttd-area">
                <p class="ttd-title">Dengan Hormat</p>
                ${item.ttdImage ? `<img src="${item.ttdImage}" class="ttd-img" alt="TTD" />` : `<div style="height: 40px;"></div>`}
                <p class="ttd-name">${item.ttdNama || ""}</p>
                <p class="ttd-role">${item.ttdJabatan ? `(${item.ttdJabatan})` : ""}</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintSuratPDF = (surat: SuratMuatInfo) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const isGI = !surat.jenisSurat || surat.jenisSurat === "gudangInduk";
    const isMandiri = surat.jenisSurat === "do" && surat.subJenisDO === "mandiri";
    const isDikuasakan = surat.jenisSurat === "do" && surat.subJenisDO === "dikuasakan";
    const piDisplay = Array.isArray(surat.nomorPI) ? surat.nomorPI.join(", ") : surat.nomorPI;
    const itemsHtml = (surat.items || [])
      .map(
        (it, idx) => `
        <tr>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
          ${!isGI ? `<td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorSubDO || "-"}</td>` : ""}
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${isGI || isDikuasakan ? (it.nomorPI || piDisplay || "-") : (it.nomorPO || "-")}</td>
          <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.jenisPupuk || ""}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.party || "-"}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.pengambilanZAK || "-"} ZAK</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.sisa || "-"}</td>
        </tr>
      `
      )
      .join("");

    let recipientBox = "";
    if (isGI) {
      recipientBox = `<div class="recipient-box">
        <p class="recipient-title">Kepada Yth :</p>
        <p class="recipient-name">Bapak Kepala Gudang Induk</p>
        <p class="recipient-name">PT Bukit Agrochemical Baru</p>
        <p class="recipient-address">Desa Sungai Rangit<br>Pangkalan Lada, Kalimantan Tengah</p>
      </div>`;
    } else if (isDikuasakan) {
      const customerName = Array.isArray(surat.namaCustomer) ? surat.namaCustomer[0] : surat.namaCustomer;
      recipientBox = `<div class="recipient-box">
        <p class="recipient-title">Kepada Yth :</p>
        <p class="recipient-name">${customerName || ""}</p>
        <p class="recipient-name">${customerName || ""}</p>
      </div>`;
    } else {
      recipientBox = `<div class="recipient-box">
        <p class="recipient-title">Kepada Yth :</p>
        <p class="recipient-name">${surat.kepadaNama || ""}</p>
        <p class="recipient-name">${surat.kepadaPerusahaan || ""}</p>
        <p class="recipient-address">${(surat.kepadaAlamat || "").replace(/\n/g, "<br>")}</p>
      </div>`;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Pengangkutan ${surat.nomorSeri}</title>
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
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="page">
          <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display=\'none\'" />
          <div class="title-bar">SURAT PENGANGKUTAN</div>
          <div class="info-section">
            <div class="info-row">
              <span>Lamandau, ${new Date(surat.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nomor Seri : ${surat.nomorSeri}</span>
            </div>
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
                  <th style="width: 100px;">NOMOR PI</th>
                  <th>JENIS PUPUK</th>
                  <th style="width: 60px;">PARTY</th>
                  <th style="width: 100px;">PENGAMBILAN<br>ZAK</th>
                  <th style="width: 60px;">SISA</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>
          <div class="table-section">
            <div class="table-title">DATA UNIT ANGKUTAN</div>
            <table class="data-table">
              <tbody>
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600; width: 120px;">NO. POLISI :</td>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${surat.nomorPolisi || "-"}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">DRIVER UNIT :</td>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${surat.driverUnit || "-"}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">NOMOR SIM :</td>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${surat.nomorSIM || "-"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="notes-section">
            <p style="font-weight: 700;">Notes :</p>
            <p>- Jika terdapat coretan / tip-ex Sub DO dianggap batal.</p>
            <p>- Sub DO berlaku selama 3 hari dari tanggal Sub DO diterbitkan.</p>
            <p>- Untuk konfirmasi dengan Customer Service kami, silahkan scan QRcode di atas.</p>
          </div>
          <div class="signature-row">
            <div class="signature-box">
              <p class="signature-title">Hormat Kami,<br>PT. BUKIT AGROCHEMICAL BARU</p>
              <div style="min-height: 60px; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center;">
                <img src="/Picture2.png" alt="TTD" class="signature-img" onerror="this.style.display=\'none\'" />
              </div>
              <p class="signature-name">HENDRA PRAMASYANTO</p>
            </div>
            <div class="signature-box">
              <p class="signature-title">Diangkut oleh,<br>Driver</p>
              <div style="min-height: 60px; margin-bottom: 4px;"></div>
              <p class="signature-name">${surat.driverUnit || ""}</p>
            </div>
          </div>
          <img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display=\'none\'" />
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintInvoice = () => {
    if (!selectedItem || !invoiceNomor) return;
    const pi = selectedItem;
    const orderTTD = ttdList.find((t) => t.id === selectedOrderTTD);
    const allSuratForPI = getSuratMuatForPI(pi.nomorPI);
    const sortedSurat = [...allSuratForPI].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    const invoiceDate = invoiceSurat ? invoiceSurat.tanggal : (sortedSurat[0] ? sortedSurat[0].tanggal : pi.tanggal);

    const invoiceItems = pi.produkItems
      .map((produk, idx) => {
        let loadedQty = 0;
        if (invoiceSurat) {
          (invoiceSurat.items || []).forEach((it) => {
            const itemPI = it.nomorPI || "";
            if (itemPI && itemPI !== pi.nomorPI) return;
            const match =
              it.jenisPupuk.toUpperCase().includes(produk.namaProduk.toUpperCase()) ||
              produk.namaProduk.toUpperCase().includes(it.jenisPupuk.toUpperCase());
            if (match) {
              const bobot = it.bobotPerUnit || produk.bobotPerUnit || 50;
              loadedQty += (it.pengambilanZAK || 0) * bobot;
            }
          });
        } else {
          allSuratForPI.forEach((surat) => {
            (surat.items || []).forEach((it) => {
              const itemPI = it.nomorPI || "";
              if (itemPI && itemPI !== pi.nomorPI) return;
              const match =
                it.jenisPupuk.toUpperCase().includes(produk.namaProduk.toUpperCase()) ||
                produk.namaProduk.toUpperCase().includes(it.jenisPupuk.toUpperCase());
              if (match) {
                const bobot = it.bobotPerUnit || produk.bobotPerUnit || 50;
                loadedQty += (it.pengambilanZAK || 0) * bobot;
              }
            });
          });
        }
        const hargaSatuan = produk.hargaSatuan || 0;
        const hargaPerZakDus = produk.hargaPerZakDus || 0;
        const kemasan = produk.bobotPerUnit ? `${produk.bobotPerUnit} KG` : "-";
        const subTotal = loadedQty * hargaSatuan;
        return {
          no: idx + 1,
          namaProduk: produk.namaProduk,
          produsen: produk.produsen || "",
          kemasan,
          fot: produk.fot || "",
          kuantitas: loadedQty,
          satuan: "KG",
          hargaSatuan,
          hargaPerZakDus,
          subTotal,
        };
      })
      .filter((it) => !invoiceSurat || it.kuantitas > 0)
      .map((it, idx) => ({ ...it, no: idx + 1 }));

    const totalSubTotal = invoiceItems.reduce((sum, it) => sum + it.subTotal, 0);
    const dppNilaiLain = 0;
    const ongkosKirim = pi.ongkosKirim || 0;
    const ppn = pi.includePPN ? totalSubTotal * 0.11 : 0;
    const totalPembayaran = totalSubTotal + dppNilaiLain + ongkosKirim + ppn;

    const itemsHtml = invoiceItems.map((it) => `
      <tr>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.no}</td>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.namaProduk}</td>
        <td style="padding: 6px 8px; font-size: 9px; border: 1px solid #000; vertical-align: top;">${it.produsen}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.kemasan}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.fot}</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.kuantitas.toLocaleString("id-ID")} ${it.satuan}</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${formatRupiah(it.hargaSatuan)}</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${formatRupiah(it.hargaPerZakDus)}</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${formatRupiah(it.subTotal)}</td>
      </tr>
    `).join("");

    const emptyRows = Array.from({ length: Math.max(0, 8 - invoiceItems.length) }, (_, i) => `
      <tr>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${invoiceItems.length + i + 1}</td>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
        <td style="padding: 6px 8px; font-size: 9px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
        <td style="text-align: right; padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top;">&nbsp;</td>
      </tr>
    `).join("");

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoiceNomor}</title>
        <style>
          @page { size: A4; margin: 8mm 10mm 8mm 10mm; }
          @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 9px; line-height: 1.3; color: #000; }
          .page { width: 190mm; margin: 0 auto; position: relative; min-height: 277mm; display: flex; flex-direction: column; }
          .header-img { width: 100%; display: block; margin-bottom: 0; }
          .title-bar { text-align: center; background: #15803d; color: white; padding: 4px 0; margin: 4px 0 8px 0; font-weight: bold; font-size: 12px; letter-spacing: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .info-section { display: flex; justify-content: space-between; margin-bottom: 8px; }
          .customer-box { width: 55%; font-size: 9px; }
          .customer-box p { margin-bottom: 1px; }
          .customer-title { font-size: 9px; margin-bottom: 2px; }
          .customer-name { font-weight: 700; font-size: 10px; }
          .meta-box { width: 40%; text-align: right; font-size: 9px; }
          .meta-box p { margin-bottom: 2px; }
          .data-table { width: 100%; border-collapse: collapse; margin-bottom: 0; font-size: 9px; }
          .data-table th { background: #e8f5e9; font-size: 8px; padding: 4px 2px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .data-table td { border: 1px solid #000; padding: 4px 2px; vertical-align: top; font-size: 9px; }
          .summary-section { display: flex; justify-content: flex-end; margin-top: 0; }
          .summary-table { width: 55%; border-collapse: collapse; font-size: 9px; }
          .summary-table td { border: 1px solid #000; padding: 3px 6px; }
          .summary-label { text-align: left; font-weight: 600; }
          .summary-value { text-align: right; font-family: monospace; }
          .total-row { font-weight: 700; font-size: 10px; }
          .terbilang-box { border: 1px dashed #000; padding: 4px 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
          .terbilang-label { font-size: 8px; font-weight: 600; margin-bottom: 1px; }
          .bottom-section { display: flex; justify-content: space-between; margin-top: 8px; }
          .left-boxes { width: 48%; }
          .pay-box { border: 1px solid #000; padding: 6px 8px; margin-bottom: 6px; font-size: 9px; }
          .pay-box p { margin-bottom: 1px; }
          .pay-title { font-weight: 700; margin-bottom: 3px; }
          .order-box { border: 1px solid #000; padding: 6px 8px; margin-bottom: 6px; font-size: 9px; }
          .order-box p { margin-bottom: 1px; }
          .ttd-box { border: 1px solid #000; padding: 6px 8px; font-size: 9px; }
          .ttd-box p { margin-bottom: 1px; }
          .right-signature { width: 48%; text-align: center; font-size: 9px; }
          .right-signature p { margin-bottom: 2px; }
          .sig-img { height: 50px; object-fit: contain; margin: 0 auto; display: block; }
          .sig-name { font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block; }
          .footer-img { width: 100%; display: block; margin-top: auto; padding-top: 8px; }
          .print-btn { background: #16a34a; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 600; margin: 8px; }
          .print-bar { text-align: center; padding: 8px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
          @media print { .print-bar { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="page">
          <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display=\'none\'" />
          <div class="title-bar">I N V O I C E</div>
          <div class="info-section">
            <div class="customer-box">
              <p class="customer-title">Kepada Yth,</p>
              <p class="customer-name">${pi.namaCustomer || ""}</p>
              <p>${(pi.alamatCustomer || "").replace(/\n/g, "<br>")}</p>
              ${pi.npwp ? `<p style="margin-top: 3px;">NP/WP: ${pi.npwp}</p>` : ""}
            </div>
            <div class="meta-box">
              <p><span style="font-weight: 600;">INVOICE NO. :</span> ${invoiceNomor}</p>
              <p><span style="font-weight: 600;">TANGGAL :</span> ${new Date(invoiceDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p><span style="font-weight: 600;">CUSTOMER ID :</span> ${pi.nomorPI || ""}</p>
            </div>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 24px;">NO</th>
                <th style="text-align: left; padding-left: 4px;">NAMA PRODUK</th>
                <th style="text-align: left; padding-left: 4px;">PRODUSEN</th>
                <th style="width: 50px;">KEMASAN</th>
                <th style="width: 40px;">FOT</th>
                <th style="width: 60px;">KUANTITAS</th>
                <th style="width: 80px;">HARGA SATUAN<br>PER KG</th>
                <th style="width: 80px;">PER ZAK</th>
                <th style="width: 90px;">SUB TOTAL</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}${emptyRows}</tbody>
          </table>
          <div class="summary-section">
            <table class="summary-table">
              <tr><td class="summary-label" style="border: none;"></td><td class="summary-label">TOTAL</td><td class="summary-value">${formatRupiah(totalSubTotal)}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label">DPP NILAI LAIN-LAIN</td><td class="summary-value">${formatRupiah(dppNilaiLain)}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label">ONGKOS KIRIM</td><td class="summary-value">${ongkosKirim > 0 ? formatRupiah(ongkosKirim) : "Rp -"}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label">PPN</td><td class="summary-value">${ppn > 0 ? formatRupiah(ppn) : "Rp -"}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label">SUB TOTAL</td><td class="summary-value">${formatRupiah(totalSubTotal + ppn)}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label total-row">TOTAL PEMBAYARAN :</td><td class="summary-value total-row">${formatRupiah(totalPembayaran)}</td></tr>
            </table>
          </div>
          <div class="terbilang-box">
            <div class="terbilang-label">TERBILANG :</div>
            <div>${numberToWords(Math.round(totalPembayaran))}</div>
          </div>
          <div class="bottom-section">
            <div class="left-boxes">
              <div class="pay-box">
                <p class="pay-title">Pembayaran PT. Bukit Agrochemical Baru</p>
                <p>Bank BRI Cabang Lamandau- Kalimantan Tengah</p>
                <p>No. Rek : 2232-01000-879-567</p>
              </div>
              <div class="order-box">
                <p style="font-weight: 600;">Dipesan oleh:</p>
                <p style="font-weight: 700;">${pi.namaCustomer || ""}</p>
              </div>
              <div class="ttd-box" style="text-align: center;">
                <p style="font-weight: 600; text-align: left;">Diorder Oleh:</p>
                <p style="text-align: left;">PT. Bukit Agrochemical Baru</p>
                <div style="height: 10px;"></div>
                ${orderTTD ? `<img src="${orderTTD.ttdImage}" style="height: 35px; object-fit: contain; display: block; margin: 0 auto 2px auto;" />` : `<div style="height: 35px;"></div>`}
                <div style="border-top: 1px solid #000; padding-top: 2px; margin-top: 2px;">
                  ${orderTTD ? `<p style="font-weight: 700; margin: 0;">${orderTTD.nama}</p>` : `<p style="font-weight: 700; margin: 0;">_________________</p>`}
                  ${orderTTD ? `<p style="margin: 0; font-size: 8px;">${orderTTD.jabatan}</p>` : ""}
                </div>
              </div>
            </div>
            <div class="right-signature">
              <p style="margin-bottom: 30px;">Hormat kami,<br>PT. Bukit Agrochemical Baru</p>
              <img src="/Picture4.png" alt="TTD" style="height: 50px; object-fit: contain; margin: 0 auto; display: block;" onerror="this.style.display=\'none\'" />
              <p style="font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">Sri Setyo Wibowo</p>
              <p>Manager Keuangan</p>
            </div>
          </div>
          <img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display=\'none\'" />
        </div>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setIsInvoiceModalOpen(false);
  };

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
      items: [...prev.items, { nomorSubDO: "", nomorPO: "", jenisPupuk: "", party: "", pengambilanZAK: "", bobotPerUnit: 50, sisa: "", maxZAK: 0, fot: "" }],
    }));
  };

  const removeSuratItem = (idx: number) => {
    setEditSuratForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleGenerateNomorSeriEdit = () => {
    if (editSuratForm.jenisSurat === "gudangInduk") {
      const current = editSuratForm.nomorSeri;
      const parts = current.split("/");
      if (parts.length !== 4) return;
      const prefix = `${parts[0]}/${parts[1]}/${parts[2]}`;
      const numbers: number[] = [];
      existingSuratList.forEach((s) => {
        if (s.nomorSeri === selectedSurat?.nomorSeri) return;
        if (s.nomorSeri.startsWith(prefix + "/")) {
          const p = s.nomorSeri.split("/");
          const last = parseInt(p[p.length - 1]);
          if (!isNaN(last)) numbers.push(last);
        }
      });
      numbers.sort((a, b) => a - b);
      let nextUrut = 1;
      for (const num of numbers) {
        if (num === nextUrut) nextUrut++;
        else if (num > nextUrut) break;
      }
      const newNomorSeri = `${prefix}/${String(nextUrut).padStart(4, "0")}`;
      setEditSuratForm((prev) => ({ ...prev, nomorSeri: newNomorSeri }));
      setNomorSeriError("");
    } else {
      const firstItem = editSuratForm.items.find((it) => it.nomorSubDO.trim() !== "");
      const nomorDO = firstItem?.nomorSubDO?.trim() || "";
      const sopir = editSuratForm.driverUnit.trim();
      const perusahaan = editSuratForm.kepadaPerusahaan.trim();
      if (!nomorDO || !sopir || !perusahaan) return;
      const prefix = `BAGB-SP-DO${nomorDO} ${sopir} - ${perusahaan} - `;
      const existing = existingSuratList.filter((s) =>
        s.nomorSeri.startsWith(prefix) && s.nomorSeri !== selectedSurat?.nomorSeri
      );
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
      const newNomorSeri = `${prefix}${String(nextUrut).padStart(4, "0")}`;
      setEditSuratForm((prev) => ({ ...prev, nomorSeri: newNomorSeri }));
      setNomorSeriError("");
    }
  };

  const handleEditProdukChange = (index: number, field: string, value: string) => {
    setEditForm((prev) => {
      const newItems = [...prev.produkItems];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, produkItems: newItems };
    });
  };

  const addEditProdukItem = () => {
    setEditForm((prev) => ({
      ...prev,
      produkItems: [...prev.produkItems, { namaProduk: "", fot: "", produsen: "", kuantitas: 0, satuan: "KG", hargaSatuan: 0, hargaPerZakDus: 0, bobotPerUnit: 50, jumlahIsiBotol: 1, totalHarga: 0, includePPN: false, ppnNominal: 0 }],
    }));
  };

  const removeEditProdukItem = (index: number) => {
    if (editForm.produkItems.length > 1) {
      setEditForm((prev) => ({ ...prev, produkItems: prev.produkItems.filter((_, i) => i !== index) }));
    }
  };

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

  const columns = [
    {
      key: "tanggal",
      header: "Tanggal",
      width: "120px",
      render: (row: ProformaInvoice) => <span className="font-medium text-gray-800">{row.tanggal}</span>,
    },
    {
      key: "nomorPI",
      header: "Nomor PI",
      width: "150px",
      render: (row: ProformaInvoice) => <span className="font-semibold text-green-700">{row.nomorPI}</span>,
    },
    {
      key: "namaCustomer",
      header: "Customer",
      render: (row: ProformaInvoice) => row.namaCustomer,
    },
    {
      key: "statusPelunasan",
      header: "Status Pelunasan",
      width: "160px",
      render: (row: ProformaInvoice) => {
        const status = row.statusPelunasan || getPaymentStatus(row);
        const badge = getPaymentBadge(status);
        const paid = row.jumlahUangDibayar || 0;
        const total = row.jumlahTertagih || 0;
        return (
          <div className="flex flex-col gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); handleOpenPaymentEdit(row); }} className={`px-2 py-1 rounded-md text-xs font-bold border transition-colors text-left ${badge.class}`}>
              {badge.label}
            </button>
            <div className="text-xs text-gray-600 font-mono">{formatRupiah(paid)} / {formatRupiah(total)}</div>
            {row.tanggalPembayaran && <div className="text-xs text-gray-500">{row.tanggalPembayaran}</div>}
          </div>
        );
      },
    },
    {
      key: "invoice",
      header: "Invoice",
      width: "120px",
      render: (row: ProformaInvoice) => {
        const status = getStatusPengangkutan(row);
        const isComplete = status === "complete";
        const isPaid = getPaymentStatus(row) === "Lunas";
        const canInvoice = isComplete && isPaid;
        let title = "";
        if (!isComplete) title = "Belum selesai dimuat";
        else if (!isPaid) title = "Menunggu pelunasan";
        else title = "Print Invoice Full";
        return (
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenFullInvoice(row); }}
            disabled={!canInvoice}
            className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 ${
              canInvoice ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer" : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
            title={title}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Invoice
          </button>
        );
      },
    },
    {
      key: "jumlahTertagih",
      header: "Jumlah",
      width: "160px",
      render: (row: ProformaInvoice) => <span className="font-mono font-medium text-gray-900">{formatRupiah(row.jumlahTertagih)}</span>,
    },
    {
      key: "statusPengangkutan",
      header: "Status Muat",
      width: "320px",
      render: (row: ProformaInvoice) => {
        const produkStatus = getProdukLoadStatus(row);
        const isComplete = produkStatus.every((p) => p.status === "complete");
        const isPartial = produkStatus.some((p) => p.status === "partial" || p.status === "complete");
        const badge = isComplete
          ? { class: "bg-green-100 text-green-700", label: "Selesai Dimuat" }
          : isPartial
          ? { class: "bg-yellow-100 text-yellow-700", label: "Sebagian Dimuat" }
          : { class: "bg-gray-100 text-gray-600", label: "Belum Dimuat" };
        return (
          <div className="flex flex-col gap-2">
            <span className={`px-2 py-1 rounded-md text-xs font-bold ${badge.class}`}>{badge.label}</span>
            <div className="space-y-1">
              {produkStatus.map((p, i) => (
                <div key={i} className="text-xs text-gray-600">
                  <span className="font-semibold">{p.namaProduk}:</span>{' '}
                  <span className="font-mono">{p.loaded.toLocaleString()} / {p.ordered.toLocaleString()} KG</span>
                  {p.status === "partial" && <span className="text-yellow-600 ml-1">(Sebagian)</span>}
                  {p.status === "complete" && <span className="text-green-600 ml-1">(Selesai)</span>}
                  {p.status === "pending" && <span className="text-gray-400 ml-1">(Belum)</span>}
                </div>
              ))}
            </div>
            {!isComplete && (
              <button onClick={(e) => { e.stopPropagation(); router.push("/dashboard/surat-pengangkutan?nomorPI=" + encodeURIComponent(row.nomorPI)); }} className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                Buat Surat Muat
              </button>
            )}
          </div>
        );
      },
    },
    {
      key: "metodePembayaran",
      header: "Pembayaran",
      width: "120px",
      render: (row: ProformaInvoice) => (
        <span className={`px-2 py-1 rounded-md text-xs font-medium ${row.metodePembayaran === "Transfer" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
          {row.metodePembayaran}
        </span>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "200px",
      render: (row: ProformaInvoice) => (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleDetail(row); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Detail">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handlePrintPDF(row); }} disabled={(row.jumlahUangDibayar || 0) === 0} className={`p-2 rounded-lg transition-colors ${(row.jumlahUangDibayar || 0) === 0 ? "text-gray-300 cursor-not-allowed" : "text-purple-600 hover:bg-purple-50"}`} title={(row.jumlahUangDibayar || 0) === 0 ? "Belum dibayar - tidak dapat print" : "Print PDF"}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Header title="Rekap Proforma Invoice" subtitle="Kelola dan lihat riwayat proforma invoice beserta status pengangkutan" />
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Cari nomor PI, customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:z-20 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200" />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportExcel}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export Excel
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Input label="Filter Tanggal" type="date" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} />
          <Select label="Filter Bulan" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} options={bulanOptions} />
          <Select label="Filter Tahun" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} options={tahunOptions} />
        </div>
        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredData.length} dari {data.length} data
          {filterTanggal && ` | Tanggal: ${filterTanggal}`}
          {filterBulan && ` | Bulan: ${bulanOptions.find((b) => b.value === filterBulan)?.label}`}
          {filterTahun && ` | Tahun: ${filterTahun}`}
        </div>
        <Table columns={columns} data={filteredData} isLoading={isLoading} emptyMessage="Belum ada data proforma invoice" keyExtractor={(row) => row.id} onRowClick={handleDetail} />
      </Card>
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detail Proforma Invoice" size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
          <Button variant="primary" onClick={() => selectedItem && handlePrintPDF(selectedItem)}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print PDF
          </Button>
        </div>
      }>
        {selectedItem && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Nomor PI</p><p className="text-lg font-bold text-green-700">{selectedItem.nomorPI}</p></div>
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Tanggal</p><p className="text-lg font-bold text-gray-800">{selectedItem.tanggal}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="font-semibold text-gray-800">{selectedItem.namaCustomer}</p>
                <p className="text-sm text-gray-600 mt-1">{selectedItem.alamatCustomer}</p>
                {selectedItem.npwp && <p className="text-sm text-gray-600 mt-1">NPWP: {selectedItem.npwp}</p>}
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Metode Pembayaran</p>
                <p className="font-semibold text-gray-800">{selectedItem.metodePembayaran}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-3">Jatuh Tempo</p>
                <p className="font-semibold text-red-600">{selectedItem.tanggalJatuhTempo}</p>
              </div>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Status Pengangkutan</p>
                {(() => {
                  const status = getStatusPengangkutan(selectedItem);
                  const badge = getStatusBadge(status);
                  return (<span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${badge.class}`}>{badge.label}</span>);
                })()}
              </div>
              <div className="space-y-2">
                {getProdukLoadStatus(selectedItem).map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">{p.namaProduk}</span>
                    <span className="font-mono text-gray-900">{p.loaded.toLocaleString()} / {p.ordered.toLocaleString()} KG</span>
                  </div>
                ))}
              </div>
            </div>
            {(() => {
              const status = getStatusPengangkutan(selectedItem);
              return status === "complete" ? (
                <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-indigo-600 uppercase tracking-wide font-semibold">Berita Acara Serah Terima</p>
                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${bastExists ? "bg-green-100 text-green-700" : "bg-indigo-100 text-indigo-700"}`}>{bastExists ? "Sudah Terbit" : "Siap Dibuat"}</span>
                  </div>
                  <p className="text-sm text-gray-700 mb-3">Seluruh muatan telah selesai dimuat. {bastExists ? "Berita Acara sudah dibuat." : "Buat Berita Acara Serah Terima Barang."}</p>
                  <div className="flex gap-2">
                    {!bastExists && (
                      <button onClick={() => handleGenerateBast(selectedItem)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        Generate Berita Acara
                      </button>
                    )}
                    {bastExists && (
                      <>
                        <button onClick={() => handlePrintBastSimple(selectedItem)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          Print BA
                        </button>
                        <button onClick={() => handleResetBast(selectedItem.nomorPI)} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          Reset BA
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : null;
            })()}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Status Pelunasan</p>
                {(() => {
                  const status = selectedItem.statusPelunasan || getPaymentStatus(selectedItem);
                  const badge = getPaymentBadge(status);
                  return (<span className={`px-3 py-1 rounded-lg text-xs font-bold border ${badge.class}`}>{badge.label}</span>);
                })()}
              </div>
              <div className="mb-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Riwayat Pembayaran</p>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-amber-200"><th className="text-left py-1 px-2 text-xs font-semibold text-amber-700">No</th><th className="text-left py-1 px-2 text-xs font-semibold text-amber-700">Tanggal</th><th className="text-right py-1 px-2 text-xs font-semibold text-amber-700">Jumlah</th></tr></thead>
                  <tbody>
                    {(selectedItem.riwayatPembayaran || []).length === 0 && (<tr><td colSpan={3} className="py-2 text-center text-gray-500 text-xs">Belum ada pembayaran</td></tr>)}
                    {(selectedItem.riwayatPembayaran || []).map((r, i) => (
                      <tr key={i} className="border-b border-amber-100"><td className="py-1 px-2 text-gray-700">{i + 1}</td><td className="py-1 px-2 text-gray-700">{r.tanggal}</td><td className="py-1 px-2 text-right font-mono text-gray-900">{formatRupiah(r.jumlah)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-2 border-t border-amber-200 pt-2">
                <div className="flex justify-between items-center text-sm"><span className="font-medium text-gray-700">Total Dibayar</span><span className="font-mono text-gray-900">{formatRupiah(selectedItem.jumlahUangDibayar || 0)}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="font-medium text-gray-700">Jumlah Tertagih</span><span className="font-mono text-gray-900">{formatRupiah(selectedItem.jumlahTertagih)}</span></div>
                <div className="flex justify-between items-center text-sm"><span className="font-medium text-gray-700">Sisa Pembayaran</span><span className="font-mono text-gray-900">{formatRupiah(Math.max(0, (selectedItem.jumlahTertagih || 0) - (selectedItem.jumlahUangDibayar || 0)))}</span></div>
                {selectedItem.tanggalPembayaran && <div className="flex justify-between items-center text-sm"><span className="font-medium text-gray-700">Pembayaran Terakhir</span><span className="font-mono text-gray-900">{selectedItem.tanggalPembayaran}</span></div>}
              </div>
              <button onClick={() => handleOpenPaymentEdit(selectedItem)} className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold transition-colors">Tambah Pembayaran</button>
            </div>
            {getSuratMuatForPI(selectedItem.nomorPI).length > 0 && (
              <div className="overflow-x-auto">
                <p className="text-sm font-semibold text-gray-700 mb-3">Riwayat Surat Muat</p>
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-green-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">No</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Nomor Seri</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Tanggal</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Jenis Pupuk</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">ZAK</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">Total KG</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">No. Polisi</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Driver</th>
                      <th className="px-2 py-3 text-center text-xs font-semibold text-green-800 uppercase border" colSpan={4}>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSuratMuatForPI(selectedItem.nomorPI).map((surat: SuratMuatInfo, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-3 text-sm text-gray-900 border">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-green-700 border">{surat.nomorSeri}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border">{surat.tanggal}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 border">{surat.items.map((it: SuratMuatItem, i: number) => (<div key={i}>{it.jenisPupuk} ({it.pengambilanZAK} ZAK)</div>))}</td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono border">{surat.items.reduce((sum: number, it: SuratMuatItem) => sum + (it.pengambilanZAK || 0), 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right font-mono border">{surat.totalKG.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border">{surat.nomorPolisi}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border">{surat.driverUnit}</td>
                        <td className="px-2 py-3 text-sm text-gray-600 border">
                          <button onClick={() => handlePrintSuratPDF(surat)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Print Surat">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                          </button>
                        </td>
                        <td className="px-2 py-3 text-sm text-gray-600 border">
                          <button onClick={() => handleEditSurat(surat)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Surat">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                        </td>
                        <td className="px-2 py-3 text-sm text-gray-600 border">
                          <button onClick={() => handleDeleteSurat(surat)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Surat">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </td>
                        <td className="px-2 py-3 text-sm text-gray-600 border">
                          <button onClick={() => handleOpenInvoice(surat)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Invoice">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-green-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Produk</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">FOT</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Produsen</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Kuantitas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Harga</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Harga/ZAK</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(selectedItem.produkItems || []).map((p, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3 text-sm text-gray-900">{idx + 1}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.namaProduk}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.fot}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.produsen || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{p.kuantitas?.toLocaleString("id-ID")} {p.satuan}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{formatRupiah(p.hargaSatuan)}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{formatRupiah(p.hargaPerZakDus)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right font-mono">{formatRupiah(p.totalHarga)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Terbilang</p>
                <p className="text-sm font-semibold text-gray-800 uppercase">{selectedItem.terbilang}</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex justify-between py-1"><span className="text-sm text-gray-600">Subtotal</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.subtotal)}</span></div>
                {selectedItem.includePPN && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">PPN 11%</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ppnNominal)}</span></div>}
                {(selectedItem.uangMuka || 0) > 0 && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">Uang Muka</span><span className="text-sm font-mono font-medium text-red-600">- {formatRupiah(selectedItem.uangMuka)}</span></div>}
                {(selectedItem.ongkosKirim || 0) > 0 && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">Ongkos Kirim</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ongkosKirim)}</span></div>}
                <div className="flex justify-between py-2 border-t border-green-200 mt-2"><span className="text-base font-bold text-green-800">Jumlah Tertagih</span><span className="text-lg font-mono font-bold text-green-700">{formatRupiah(selectedItem.jumlahTertagih)}</span></div>
              </div>
            </div>
            {selectedItem.ttdImage && (
              <div className="flex justify-end">
                <div className="text-center p-4">
                  <img src={selectedItem.ttdImage} alt="TTD" className="h-20 object-contain mx-auto" />
                  <p className="text-sm font-semibold mt-2">{selectedItem.ttdNama}</p>
                  <p className="text-xs text-gray-500">{selectedItem.ttdJabatan}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Proforma Invoice" size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleUpdateFull} isLoading={isSubmitting}>Simpan Perubahan</Button>
        </div>
      }>
        <form onSubmit={handleUpdateFull} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Tanggal" type="date" value={editForm.tanggal} onChange={(e) => setEditForm((prev) => ({ ...prev, tanggal: e.target.value }))} required />
            <Input label="Nomor PI" type="text" value={editForm.nomorPI} onChange={(e) => setEditForm((prev) => ({ ...prev, nomorPI: e.target.value }))} required />
            <Input label="Nama Customer" type="text" value={editForm.namaCustomer} onChange={(e) => setEditForm((prev) => ({ ...prev, namaCustomer: e.target.value }))} required />
            <Input label="Alamat Customer" type="text" value={editForm.alamatCustomer} onChange={(e) => setEditForm((prev) => ({ ...prev, alamatCustomer: e.target.value }))} required />
            <Input label="NPWP" type="text" value={editForm.npwp} onChange={(e) => setEditForm((prev) => ({ ...prev, npwp: e.target.value }))} />
            <Select label="Metode Pembayaran" value={editForm.metodePembayaran} onChange={(e) => setEditForm((prev) => ({ ...prev, metodePembayaran: e.target.value }))} options={[{ value: "Transfer", label: "Transfer" }, { value: "Cash", label: "Cash" }]} required />
            <Input label="Uang Muka" type="text" value={editForm.uangMuka} onChange={(e) => setEditForm((prev) => ({ ...prev, uangMuka: e.target.value }))} />
            <Input label="Ongkos Kirim" type="text" value={editForm.ongkosKirim} onChange={(e) => setEditForm((prev) => ({ ...prev, ongkosKirim: e.target.value }))} />
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Keterangan</label>
              <textarea value={editForm.keterangan} onChange={(e) => setEditForm((prev) => ({ ...prev, keterangan: e.target.value }))} rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:z-20 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200" />
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">Daftar Produk</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-green-50">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">No</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">Nama Produk</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">FOT</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">Produsen</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">Kuantitas</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">Satuan</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">Harga Satuan</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-green-800 uppercase">Harga/ZAK</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-green-800 uppercase">PPN</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-green-800 uppercase">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editForm.produkItems.map((item, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-3 py-2 relative overflow-visible"><input type="text" value={item.namaProduk} onChange={(e) => handleEditProdukChange(index, "namaProduk", e.target.value)} className="w-full min-w-[60px] px-2 py-1 border border-gray-300 rounded text-sm transition-all duration-200 focus:w-auto focus:min-w-[280px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></td>
                      <td className="px-3 py-2 relative overflow-visible"><input type="text" value={item.fot || ""} onChange={(e) => handleEditProdukChange(index, "fot", e.target.value)} className="w-full min-w-[60px] px-2 py-1 border border-gray-300 rounded text-sm transition-all duration-200 focus:w-auto focus:min-w-[200px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></td>
                      <td className="px-3 py-2 relative overflow-visible"><input type="text" value={item.produsen || ""} onChange={(e) => handleEditProdukChange(index, "produsen", e.target.value)} className="w-full min-w-[60px] px-2 py-1 border border-gray-300 rounded text-sm transition-all duration-200 focus:w-auto focus:min-w-[200px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></td>
                      <td className="px-3 py-2 relative overflow-visible"><input type="text" inputMode="decimal" value={String(item.kuantitas)} onChange={(e) => handleEditProdukChange(index, "kuantitas", e.target.value)} className="w-full min-w-[60px] px-2 py-1 border border-gray-300 rounded text-sm transition-all duration-200 focus:w-auto focus:min-w-[160px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></td>
                      <td className="px-3 py-2 relative overflow-visible">
                        <select value={item.satuan} onChange={(e) => handleEditProdukChange(index, "satuan", e.target.value)} className="w-full min-w-[60px] px-2 py-1 border border-gray-300 rounded text-sm transition-all duration-200 focus:w-auto focus:min-w-[160px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md">
                          <option value="KG">KG</option>
                          <option value="ZAK">ZAK</option>
                          <option value="DUS">DUS</option>
                          <option value="LITER">LITER</option>
                          <option value="BOTOL">BOTOL</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 relative overflow-visible"><input type="text" inputMode="decimal" value={String(item.hargaSatuan)} onChange={(e) => handleEditProdukChange(index, "hargaSatuan", e.target.value)} className="w-full min-w-[60px] px-2 py-1 border border-gray-300 rounded text-sm transition-all duration-200 focus:w-auto focus:min-w-[180px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></td>
                      <td className="px-3 py-2 text-sm font-mono text-gray-700">{formatRupiah(item.hargaPerZakDus || 0)}</td>
                      <td className="px-3 py-2 text-center overflow-visible"><input type="checkbox" checked={item.includePPN || false} onChange={(e) => handleEditProdukChange(index, "includePPN", e.target.checked ? "true" : "")} className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500" /></td>
                      <td className="px-3 py-2 text-center overflow-visible">
                        <button type="button" onClick={() => removeEditProdukItem(index)} className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors" disabled={editForm.produkItems.length === 1}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addEditProdukItem}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Tambah Produk
            </Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={isEditSuratModalOpen} onClose={() => setIsEditSuratModalOpen(false)} title={`Edit Surat Muat - ${selectedSurat?.nomorSeri}`} size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsEditSuratModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleUpdateSurat} isLoading={isSubmitting} disabled={!!nomorSeriError}>Simpan Perubahan</Button>
        </div>
      }>
        <form onSubmit={handleUpdateSurat} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Tanggal" type="date" value={editSuratForm.tanggal} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, tanggal: e.target.value }))} required />
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Seri</label>
              <div className="flex gap-2">
                <input type="text" value={editSuratForm.nomorSeri} readOnly className={`w-full px-4 py-3 border rounded-xl focus:outline-none transition-all font-mono text-sm bg-gray-100 transition-all duration-200 focus:w-auto focus:min-w-[400px] focus:py-3 focus:px-4 focus:text-base focus:shadow-2xl focus:z-50 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200 ${nomorSeriError ? "border-red-500 bg-red-50" : "border-gray-300"}`} />
                <button type="button" onClick={handleGenerateNomorSeriEdit} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold whitespace-nowrap transition-colors">Generate</button>
              </div>
              {nomorSeriError && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {nomorSeriError}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jenis Surat</label>
              <select
                value={editSuratForm.jenisSurat}
                onChange={(e) => setEditSuratForm((prev) => ({ ...prev, jenisSurat: e.target.value }))}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white text-sm transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:z-20 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200"
              >
                <option value="gudangInduk">Gudang Induk</option>
                <option value="do">DO (Delivery Order)</option>
              </select>
            </div>
            {editSuratForm.jenisSurat === "do" && (
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Sub Jenis DO</label>
                <select
                  value={editSuratForm.subJenisDO}
                  onChange={(e) => setEditSuratForm((prev) => ({ ...prev, subJenisDO: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white text-sm transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:z-20 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200"
                >
                  <option value="">Pilih Sub Jenis</option>
                  <option value="mandiri">DO Mandiri</option>
                  <option value="dikuasakan">DO Dikuasakan</option>
                </select>
              </div>
            )}
            <Input label="Nomor Polisi" type="text" value={editSuratForm.nomorPolisi} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, nomorPolisi: e.target.value }))} required />
            <Input label="Driver Unit" type="text" value={editSuratForm.driverUnit} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, driverUnit: e.target.value }))} required />
            <Input label="Nomor SIM" type="text" value={editSuratForm.nomorSIM} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, nomorSIM: e.target.value }))} className="md:col-span-2" />
          </div>
          {editSuratForm.jenisSurat !== "gudangInduk" && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <h4 className="text-sm font-semibold text-gray-700 mb-4">Informasi Penerima</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="Kepada Yth (Nama)" type="text" value={editSuratForm.kepadaNama} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, kepadaNama: e.target.value }))} placeholder="Contoh: Bapak Kepala Gudang" required />
                <Input label="Nama Perusahaan" type="text" value={editSuratForm.kepadaPerusahaan} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, kepadaPerusahaan: e.target.value }))} placeholder="Contoh: PT Bukit Agrochemical Baru" required />
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alamat</label>
                  <textarea
                    value={editSuratForm.kepadaAlamat}
                    onChange={(e) => setEditSuratForm((prev) => ({ ...prev, kepadaAlamat: e.target.value }))}
                    rows={3}
                    placeholder="Contoh: Desa Sungai Rangit, Pangkalan Lada"
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none text-sm transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:z-20 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200"
                    required
                  />
                </div>
              </div>
            </div>
          )}
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
                  <div className="relative overflow-visible"><label className="block text-xs font-medium text-gray-600 mb-1">Nomor SUB DO</label><input type="text" value={item.nomorSubDO} onChange={(e) => handleSuratItemChange(idx, "nomorSubDO", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 focus:w-auto focus:min-w-[260px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></div>
                  <div className="relative overflow-visible"><label className="block text-xs font-medium text-gray-600 mb-1">Nomor PO</label><input type="text" value={item.nomorPO} onChange={(e) => handleSuratItemChange(idx, "nomorPO", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 focus:w-auto focus:min-w-[260px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></div>
                  <div className="relative overflow-visible"><label className="block text-xs font-medium text-gray-600 mb-1">Jenis Pupuk *</label><input type="text" value={item.jenisPupuk} onChange={(e) => handleSuratItemChange(idx, "jenisPupuk", e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 focus:w-auto focus:min-w-[260px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></div>
                  <div className="relative overflow-visible"><label className="block text-xs font-medium text-gray-600 mb-1">FOT</label><input type="text" value={item.fot} onChange={(e) => handleSuratItemChange(idx, "fot", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 focus:w-auto focus:min-w-[200px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></div>
                  <div className="relative overflow-visible"><label className="block text-xs font-medium text-gray-600 mb-1">Party</label><input type="text" value={item.party} onChange={(e) => handleSuratItemChange(idx, "party", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 focus:w-auto focus:min-w-[200px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></div>
                  <div className="relative overflow-visible"><label className="block text-xs font-medium text-gray-600 mb-1">Pengambilan (ZAK) *</label><input type="number" value={item.pengambilanZAK} onChange={(e) => handleSuratItemChange(idx, "pengambilanZAK", e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 focus:w-auto focus:min-w-[200px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></div>
                  <div className="relative overflow-visible"><label className="block text-xs font-medium text-gray-600 mb-1">Sisa</label><input type="text" value={item.sisa} onChange={(e) => handleSuratItemChange(idx, "sisa", e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm transition-all duration-200 focus:w-auto focus:min-w-[200px] focus:py-2.5 focus:px-3 focus:text-base focus:shadow-2xl focus:border-green-500 focus:ring-2 focus:ring-green-200 focus:bg-white focus:z-50 focus:relative focus:rounded-md" /></div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSuratItem}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Tambah Item
            </Button>
          </div>
        </form>
      </Modal>
      <Modal isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title="Print Invoice" size="md" footer={
        <div className="flex justify-end gap-3">
          {invoiceExists && (
            <Button variant="danger" onClick={() => { if (selectedItem) handleResetInvoice(selectedItem.nomorPI); setIsInvoiceModalOpen(false); }}>Reset Invoice</Button>
          )}
          <Button variant="outline" onClick={() => setIsInvoiceModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handlePrintInvoice} disabled={!selectedOrderTTD || !invoiceNomor || isGeneratingInvoice}>Print Invoice</Button>
        </div>
      }>
        <div className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nomor Invoice</p>
            <p className="text-lg font-mono font-bold text-green-700">{invoiceNomor || "Memuat..."}</p>
            {isGeneratingInvoice && <p className="text-sm text-gray-500 mt-1">Menghasilkan nomor invoice...</p>}
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-700"><span className="font-semibold">Dipesan Oleh:</span> {selectedItem?.namaCustomer || "-"}</p>
          </div>
          <p className="text-sm text-gray-600">Pilih TTD untuk bagian <strong>Diorder Oleh</strong>:</p>
          <Select label="Pilih TTD" value={selectedOrderTTD} onChange={(e) => setSelectedOrderTTD(e.target.value)} options={[{ value: "", label: "Pilih tanda tangan..." }, ...ttdList.map((ttd) => ({ value: ttd.id, label: `${ttd.nama} - ${ttd.jabatan}` }))]} />
          {selectedOrderTTD && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-4">
              {(() => {
                const ttd = ttdList.find((t) => t.id === selectedOrderTTD);
                if (!ttd) return null;
                return (
                  <>
                    <img src={ttd.ttdImage} alt="TTD" className="h-16 object-contain bg-white rounded-lg border border-gray-200" />
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{ttd.nama}</p>
                      <p className="text-xs text-gray-500">{ttd.jabatan}</p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </Modal>
      <Modal isOpen={isPaymentModalOpen} onClose={() => setIsPaymentModalOpen(false)} title="Tambah Pembayaran" size="md" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleUpdatePayment} isLoading={isSubmitting}>Simpan</Button>
        </div>
      }>
        <form onSubmit={handleUpdatePayment} className="space-y-4">
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Nomor PI</p>
            <p className="text-lg font-bold text-green-700">{selectedItem?.nomorPI}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Customer</p>
            <p className="text-sm font-semibold text-gray-800">{selectedItem?.namaCustomer}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl border border-green-200">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-green-700">Jumlah Tertagih</span>
              <span className="text-lg font-mono font-bold text-green-700">{selectedItem ? formatRupiah(selectedItem.jumlahTertagih) : "-"}</span>
            </div>
          </div>
          {(selectedItem?.riwayatPembayaran || []).length > 0 && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Riwayat Pembayaran</p>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-gray-200"><th className="text-left py-1 px-2 text-xs font-semibold text-gray-600">No</th><th className="text-left py-1 px-2 text-xs font-semibold text-gray-600">Tanggal</th><th className="text-right py-1 px-2 text-xs font-semibold text-gray-600">Jumlah</th></tr></thead>
                <tbody>
                  {selectedItem?.riwayatPembayaran?.map((r, i) => (
                    <tr key={i} className="border-b border-gray-100"><td className="py-1 px-2 text-gray-700">{i + 1}</td><td className="py-1 px-2 text-gray-700">{r.tanggal}</td><td className="py-1 px-2 text-right font-mono text-gray-900">{formatRupiah(r.jumlah)}</td></tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-300"><td colSpan={2} className="py-1 px-2 text-xs font-bold text-gray-700">Total Dibayar</td><td className="py-1 px-2 text-right font-mono font-bold text-gray-900">{formatRupiah(selectedItem?.jumlahUangDibayar || 0)}</td></tr>
                </tfoot>
              </table>
            </div>
          )}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-sm font-semibold text-blue-700 mb-3">Pembayaran Baru</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Jumlah Pembayaran</label>
                <input type="text" inputMode="decimal" value={paymentForm.jumlahUangDibayar} onChange={(e) => setPaymentForm((prev) => ({ ...prev, jumlahUangDibayar: e.target.value }))} placeholder="0.00" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white transition-all duration-200 focus:w-auto focus:min-w-[280px] focus:py-3 focus:px-4 focus:text-base focus:shadow-2xl focus:z-50 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200" />
              </div>
              <Input label="Tanggal Pembayaran" type="date" value={paymentForm.tanggalPembayaran} onChange={(e) => setPaymentForm((prev) => ({ ...prev, tanggalPembayaran: e.target.value }))} />
            </div>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-sm text-amber-700"><span className="font-semibold">Status Otomatis: </span>{selectedItem && (() => {
              const currentPaid = selectedItem.jumlahUangDibayar || 0;
              const newPaid = parseFloat(paymentForm.jumlahUangDibayar) || 0;
              const totalPaid = currentPaid + newPaid;
              const total = selectedItem.jumlahTertagih || 0;
              if (totalPaid >= total && total > 0) return "Lunas";
              if (totalPaid > 0) return "Cicilan";
              return "Belum Lunas";
            })()}</p>
          </div>
          {selectedItem && parseFloat(paymentForm.jumlahUangDibayar || "0") > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex justify-between items-center text-sm"><span className="font-medium text-blue-700">Total Setelah Pembayaran</span><span className="font-mono font-semibold text-blue-700">{formatRupiah((selectedItem.jumlahUangDibayar || 0) + (parseFloat(paymentForm.jumlahUangDibayar) || 0))}</span></div>
              <div className="flex justify-between items-center text-sm mt-1"><span className="font-medium text-blue-700">Sisa Pembayaran</span><span className="font-mono font-semibold text-blue-700">{formatRupiah(Math.max(0, (selectedItem.jumlahTertagih || 0) - (selectedItem.jumlahUangDibayar || 0) - (parseFloat(paymentForm.jumlahUangDibayar) || 0)))}</span></div>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}