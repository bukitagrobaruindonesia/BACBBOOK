"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection, getDocs, query, orderBy,
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

interface BeritaAcaraData {
  id: string;
  nomorSeri: string;
  nomorPI: string | string[];
  namaCustomer: string;
  tanggal: string;
  pihakPertama: { nama: string; jabatan: string; perusahaan: string };
  pihakKedua: { nama: string; alamat: string };
  items: BeritaAcaraItem[];
  createdAt: any;
}

interface TTDData {
  id: string;
  nama: string;
  jabatan: string;
  ttdImage: string;
}

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

export default function BeritaAcaraPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [currentPin, setCurrentPin] = useState("080900");
  const [isPinSettingsOpen, setIsPinSettingsOpen] = useState(false);
  const [oldPinInput, setOldPinInput] = useState("");
  const [newPinInput, setNewPinInput] = useState("");
  const [confirmPinInput, setConfirmPinInput] = useState("");

  const [baList, setBaList] = useState<BeritaAcaraData[]>([]);
  const [piMap, setPiMap] = useState<Record<string, ProformaInvoice>>({});
  const [suratMap, setSuratMap] = useState<Record<string, SuratMuatInfo[]>>({});
  const [ttdList, setTtdList] = useState<TTDData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterTanggal, setFilterTanggal] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");

  const [selectedBA, setSelectedBA] = useState<BeritaAcaraData | null>(null);
  const [isTTDModalOpen, setIsTTDModalOpen] = useState(false);
  const [selectedTTDId, setSelectedTTDId] = useState("");

  useEffect(() => {
    const savedPin = localStorage.getItem("ba_page_pin");
    if (savedPin) setCurrentPin(savedPin);
    const auth = sessionStorage.getItem("ba_page_auth");
    if (auth === "true") setIsAuthenticated(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAllData();
  }, [isAuthenticated]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const baSnap = await getDocs(query(collection(db, "beritaAcara"), orderBy("createdAt", "desc")));
      const baData: BeritaAcaraData[] = baSnap.docs.map(d => ({ id: d.id, ...d.data() } as BeritaAcaraData));
      setBaList(baData);

      const piSnap = await getDocs(query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc")));
      const piData: Record<string, ProformaInvoice> = {};
      piSnap.docs.forEach(d => {
        const data = d.data() as ProformaInvoice;
        data.id = d.id;
        piData[data.nomorPI] = data;
      });
      setPiMap(piData);

      const suratSnap = await getDocs(query(collection(db, "suratPengangkutan"), orderBy("createdAt", "desc")));
      const suratData: Record<string, SuratMuatInfo[]> = {};
      suratSnap.docs.forEach(d => {
        const data = d.data() as SuratMuatInfo;
        data.id = d.id;
        const rawPI = data.nomorPI;
        const piList: string[] = [];
        if (Array.isArray(rawPI)) rawPI.forEach(p => { if (p && typeof p === "string") piList.push(p); });
        else if (rawPI && typeof rawPI === "string") piList.push(rawPI);
        piList.forEach(pi => {
          if (!suratData[pi]) suratData[pi] = [];
          suratData[pi].push(data);
        });
      });
      setSuratMap(suratData);

      const ttdSnap = await getDocs(query(collection(db, "ttd"), orderBy("nama", "asc")));
      setTtdList(ttdSnap.docs.map(d => ({ id: d.id, ...d.data() } as TTDData)));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = () => {
    if (pinInput === currentPin) {
      setIsAuthenticated(true);
      sessionStorage.setItem("ba_page_auth", "true");
      setPinInput("");
    } else {
      alert("PIN salah!");
    }
  };

  const handleChangePin = () => {
    if (oldPinInput !== currentPin) { alert("PIN lama salah!"); return; }
    if (newPinInput !== confirmPinInput) { alert("Konfirmasi PIN baru tidak cocok!"); return; }
    if (newPinInput.length < 4) { alert("PIN minimal 4 digit!"); return; }
    setCurrentPin(newPinInput);
    localStorage.setItem("ba_page_pin", newPinInput);
    setIsPinSettingsOpen(false);
    setOldPinInput("");
    setNewPinInput("");
    setConfirmPinInput("");
    alert("PIN berhasil diubah!");
  };

  const getTTDForBA = (baId: string) => {
    const mapping = JSON.parse(localStorage.getItem("ba_ttd_mapping") || "{}");
    return mapping[baId] || null;
  };

  const getJumlahSP = (nomorPI: string | string[]) => {
    const piList = Array.isArray(nomorPI) ? nomorPI : [nomorPI];
    let count = 0;
    piList.forEach(pi => { if (suratMap[pi]) count += suratMap[pi].length; });
    return count;
  };

  const filteredData = baList.filter(ba => {
    const piNomor = Array.isArray(ba.nomorPI) ? ba.nomorPI[0] : ba.nomorPI;
    const piData = piMap[piNomor];
    const customerName = piData?.namaCustomer || ba.namaCustomer || "";
    const matchSearch =
      (piNomor || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (ba.nomorSeri || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchTanggal = filterTanggal ? ba.tanggal === filterTanggal : true;
    const date = new Date(ba.tanggal);
    const matchBulan = filterBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === filterBulan : true;
    const matchTahun = filterTahun ? date.getFullYear().toString() === filterTahun : true;
    return matchSearch && matchTanggal && matchBulan && matchTahun;
  });

  const handleSelectTTD = (ba: BeritaAcaraData) => {
    setSelectedBA(ba);
    const existing = getTTDForBA(ba.id);
    setSelectedTTDId(existing?.ttdId || "");
    setIsTTDModalOpen(true);
  };

  const handleSaveTTD = () => {
    if (!selectedBA) return;
    const mapping = JSON.parse(localStorage.getItem("ba_ttd_mapping") || "{}");
    if (!selectedTTDId) {
      delete mapping[selectedBA.id];
      localStorage.setItem("ba_ttd_mapping", JSON.stringify(mapping));
      setIsTTDModalOpen(false);
      setSelectedBA(null);
      setSelectedTTDId("");
      setBaList([...baList]);
      return;
    }
    const ttd = ttdList.find(t => t.id === selectedTTDId);
    if (!ttd) return;
    mapping[selectedBA.id] = { ttdId: ttd.id, nama: ttd.nama, jabatan: ttd.jabatan, ttdImage: ttd.ttdImage };
    localStorage.setItem("ba_ttd_mapping", JSON.stringify(mapping));
    setIsTTDModalOpen(false);
    setSelectedBA(null);
    setSelectedTTDId("");
    setBaList([...baList]);
  };

  const handlePrintCombined = (ba: BeritaAcaraData) => {
    const piNomor = Array.isArray(ba.nomorPI) ? ba.nomorPI[0] : ba.nomorPI;
    const pi = piMap[piNomor];
    if (!pi) { alert("Data Proforma Invoice tidak ditemukan!"); return; }
    const suratList: SuratMuatInfo[] = [];
    if (Array.isArray(ba.nomorPI)) {
      ba.nomorPI.forEach(p => { if (suratMap[p]) suratList.push(...suratMap[p]); });
    } else {
      if (suratMap[ba.nomorPI]) suratList.push(...suratMap[ba.nomorPI]);
    }
    const ttd = getTTDForBA(ba.id);
    const baDate = new Date(ba.tanggal);
    const hari = baDate.toLocaleDateString("id-ID", { weekday: "long" });
    const tanggalLengkap = baDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

    const baRowsHtml = ba.items.map(it => `
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

    const piProdukRows = (pi.produkItems || []).map((p, idx) => `
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
    const emptyRowsCount = Math.max(0, 10 - (pi.produkItems || []).length);
    const piEmptyRows = Array.from({ length: emptyRowsCount }, (_, i) => `
      <tr>
        <td style="text-align: center; padding: 5px 3px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">${(pi.produkItems || []).length + i + 1}</td>
        <td style="padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: center; padding: 5px 3px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="padding: 5px 8px; font-size: 9px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
        <td style="text-align: right; padding: 5px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; height: 28px;">&nbsp;</td>
      </tr>
    `).join("");
    const createdAtStr = pi.createdAt instanceof Date
      ? pi.createdAt.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "-";

    let spHtml = "";
    suratList.forEach((surat, sIdx) => {
      const isGI = !surat.jenisSurat || surat.jenisSurat === "gudangInduk";
      const isDikuasakan = surat.jenisSurat === "do" && surat.subJenisDO === "dikuasakan";
      const piDisplay = Array.isArray(surat.nomorPI) ? surat.nomorPI.join(", ") : surat.nomorPI;
      const spItemsHtml = (surat.items || []).map((it, idx) => `
        <tr>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
          ${!isGI ? `<td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorSubDO || "-"}</td>` : ""}
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${isGI || isDikuasakan ? (it.nomorPI || piDisplay || "-") : (it.nomorPO || "-")}</td>
          <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.jenisPupuk || ""}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.party || "-"}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.pengambilanZAK || "-"} ZAK</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.sisa || "-"}</td>
        </tr>
      `).join("");

      let recipientBox = "";
      if (isGI) {
        recipientBox = `<div style="border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px;">
          <p style="font-size: 9px; color: #333; margin-bottom: 2px;">Kepada Yth :</p>
          <p style="font-size: 11px; font-weight: 700;">Bapak Kepala Gudang Induk</p>
          <p style="font-size: 11px; font-weight: 700;">PT Bukit Agrochemical Baru</p>
          <p style="font-size: 9px; color: #333; line-height: 1.5; margin-top: 2px;">Desa Sungai Rangit<br>Pangkalan Lada, Kalimantan Tengah</p>
        </div>`;
      } else if (isDikuasakan) {
        const customerName = Array.isArray(surat.namaCustomer) ? surat.namaCustomer[0] : surat.namaCustomer;
        recipientBox = `<div style="border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px;">
          <p style="font-size: 9px; color: #333; margin-bottom: 2px;">Kepada Yth :</p>
          <p style="font-size: 11px; font-weight: 700;">${customerName || ""}</p>
          <p style="font-size: 11px; font-weight: 700;">${customerName || ""}</p>
        </div>`;
      } else {
        recipientBox = `<div style="border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px;">
          <p style="font-size: 9px; color: #333; margin-bottom: 2px;">Kepada Yth :</p>
          <p style="font-size: 11px; font-weight: 700;">${surat.kepadaNama || ""}</p>
          <p style="font-size: 11px; font-weight: 700;">${surat.kepadaPerusahaan || ""}</p>
          <p style="font-size: 9px; color: #333; line-height: 1.5; margin-top: 2px;">${(surat.kepadaAlamat || "").replace(/\n/g, "<br>")}</p>
        </div>`;
      }

      spHtml += `
        <div style="page-break-before: always;">
          <img src="/Picture3.png" alt="Header" style="width: 100%; display: block; margin-bottom: 0;" onerror="this.style.display='none'" />
          <div style="text-align: center; background: #15803d; color: white; padding: 8px 0; margin: 8px 0 12px 0; font-weight: bold; font-size: 14px; letter-spacing: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">SURAT PENGANGKUTAN</div>
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px;">
              <span>Lamandau, ${new Date(surat.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px;">
              <span style="font-weight: 600;">Nomor Seri : ${surat.nomorSeri}</span>
            </div>
          </div>
          ${recipientBox}
          <div style="margin-bottom: 8px; font-size: 10px;">
            <p>Dengan Hormat,</p>
            <p>Dengan ini mohon dimuatkan pupuk dengan rincian sebagai berikut :</p>
          </div>
          <div style="margin-bottom: 10px;">
            <div style="text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact;">DASAR PENGANGKUTAN</div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 30px;">NO</th>
                  ${!isGI ? `<th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 100px;">NOMOR SUB DO</th>` : ""}
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 100px;">NOMOR PI</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">JENIS PUPUK</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 60px;">PARTY</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 100px;">PENGAMBILAN<br>ZAK</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 60px;">SISA</th>
                </tr>
              </thead>
              <tbody>${spItemsHtml}</tbody>
            </table>
          </div>
          <div style="margin-bottom: 10px;">
            <div style="text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact;">DATA UNIT ANGKUTAN</div>
            <table style="width: 100%; border-collapse: collapse;">
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
          <div style="margin-top: 10px; font-size: 9px;">
            <p style="font-weight: 700;">Notes :</p>
            <p>- Jika terdapat coretan / tip-ex Sub DO dianggap batal.</p>
            <p>- Sub DO berlaku selama 3 hari dari tanggal Sub DO diterbitkan.</p>
            <p>- Untuk konfirmasi dengan Customer Service kami, silahkan scan QRcode di atas.</p>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 30px; align-items: flex-end;">
            <div style="width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
              <p style="font-size: 9px; margin-bottom: 4px; min-height: 28px; line-height: 1.4;">Hormat Kami,<br>PT. BUKIT AGROCHEMICAL BARU</p>
              <div style="min-height: 60px; margin-bottom: 4px; display: flex; align-items: flex-end; justify-content: center;">
                <img src="/Picture2.png" alt="TTD" style="max-height: 60px; width: auto; object-fit: contain; margin: 0 auto 4px auto; display: block;" onerror="this.style.display='none'" />
              </div>
              <p style="font-size: 10px; font-weight: 700; margin-top: 0; border-top: 1px solid #000; padding-top: 3px; display: block; width: 90%; margin-left: auto; margin-right: auto;">HENDRA PRAMASYANTO</p>
            </div>
            <div style="width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
              <p style="font-size: 9px; margin-bottom: 4px; min-height: 28px; line-height: 1.4;">Diangkut oleh,<br>Driver</p>
              <div style="min-height: 60px; margin-bottom: 4px;"></div>
              <p style="font-size: 10px; font-weight: 700; margin-top: 0; border-top: 1px solid #000; padding-top: 3px; display: block; width: 90%; margin-left: auto; margin-right: auto;">${surat.driverUnit || ""}</p>
            </div>
          </div>
          <img src="/Picture1.png" alt="Footer" style="width: 100%; display: block; margin-top: auto; padding-top: 10px;" onerror="this.style.display='none'" />
        </div>
      `;
    });

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dokumen Gabungan ${ba.nomorSeri}</title>
        <style>
          @page { size: A4; margin: 10mm 12mm 10mm 12mm; }
          @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #000; }
          .doc-page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; display: flex; flex-direction: column; }
          .doc-page-pi { width: 182mm; margin: 0 auto; position: relative; min-height: 257mm; }
          .print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
          .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
          @media print { .print-bar { display: none !important; } .page-break { page-break-before: always; } }
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>

        <div class="doc-page">
          <img src="/Picture3.png" alt="Header" style="width: 100%; display: block; margin-bottom: 0;" onerror="this.style.display='none'" />
          <div style="text-align: center; margin: 8px 0 12px 0;">
            <h1 style="font-size: 14px; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; text-decoration: underline;">BERITA ACARA SERAH TERIMA BARANG</h1>
            <p style="font-size: 11px; font-weight: 600;">${ba.nomorSeri}</p>
          </div>
          <div style="padding: 0 4px; flex: 1;">
            <p style="margin-bottom: 12px; font-size: 10px;">Kami yang bertanda tangan di bawah ini, pada hari ${hari}, ${tanggalLengkap}</p>
            <div style="margin-bottom: 10px;">
              <p style="font-weight: 700; margin-bottom: 4px; font-size: 10px;">Selanjutnya disebut Pihak Pertama.</p>
              <table style="width: 100%; margin-bottom: 8px; font-size: 10px;">
                <tr><td style="width: 100px; font-weight: 600; padding: 2px 0; vertical-align: top;">Nama</td><td style="padding: 2px 0; vertical-align: top;">: ${ttd?.nama || "........................"}</td></tr>
                <tr><td style="width: 100px; font-weight: 600; padding: 2px 0; vertical-align: top;">Perusahaan</td><td style="padding: 2px 0; vertical-align: top;">: PT Bukit Agrochemical Baru</td></tr>
                <tr><td style="width: 100px; font-weight: 600; padding: 2px 0; vertical-align: top;">Jabatan</td><td style="padding: 2px 0; vertical-align: top;">: ${ttd?.jabatan || "........................"}</td></tr>
              </table>
            </div>
            <div style="margin-bottom: 10px;">
              <p style="font-weight: 700; margin-bottom: 4px; font-size: 10px;">Selanjutnya yang disebut Pihak Kedua.</p>
              <table style="width: 100%; margin-bottom: 8px; font-size: 10px;">
                <tr><td style="width: 100px; font-weight: 600; padding: 2px 0; vertical-align: top;">Nama</td><td style="padding: 2px 0; vertical-align: top;">: ${ba.pihakKedua?.nama || pi.namaCustomer || ""}</td></tr>
                <tr><td style="width: 100px; font-weight: 600; padding: 2px 0; vertical-align: top;">Alamat</td><td style="padding: 2px 0; vertical-align: top;">: ${(ba.pihakKedua?.alamat || pi.alamatCustomer || "").replace(/\n/g, " ")}</td></tr>
              </table>
            </div>
            <p style="margin-bottom: 12px; font-size: 10px;">Pihak pertama menyerahkan barang kepada pihak kedua, dan pihak kedua menyatakan telah menerima barang dari pihak pertama, berupa daftar terlampir :</p>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;">
              <thead>
                <tr>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 30px;">No</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 80px;">Tanggal Muat</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">Nama Produk</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 80px;">FOT / No DO</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 70px;">QTY</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 120px;">No SJ</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 90px;">Driver</th>
                  <th style="background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 80px;">Nopol</th>
                </tr>
              </thead>
              <tbody>${baRowsHtml}</tbody>
            </table>
            <p style="margin-bottom: 16px; font-size: 10px; text-align: justify;">Demikian berita acara serah terima barang ini diperbuat oleh kedua belah pihak, adapun barang-barang tersebut dalam keadaan baik dan cukup, sejak penandatanganan berita acara ini, maka barang-barang tersebut menjadi tanggung jawab pihak kedua.</p>
            <div style="display: flex; justify-content: space-between; margin-top: 40px; align-items: flex-end;">
              <div style="width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                <p style="font-size: 10px; font-weight: 700; margin-bottom: 8px;">PIHAK KEDUA</p>
                <div style="width: 100%; min-height: 80px; margin-bottom: 8px;"></div>
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px; display: block; width: 90%; margin-left: auto; margin-right: auto;">${pi.namaCustomer || "_________________"}</p>
              </div>
              <div style="width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center;">
                <p style="font-size: 10px; font-weight: 700; margin-bottom: 8px;">PIHAK PERTAMA</p>
                <div style="position: relative; width: 100%; min-height: 80px; margin-bottom: 8px; display: flex; align-items: flex-end; justify-content: center;">
                  <img src="/LogoAGRO.png" alt="Stempel" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); max-height: 80px; max-width: 100px; opacity: 0.6; object-fit: contain; z-index: 1;" onerror="this.style.display='none'" />
                  <div style="position: relative; z-index: 2;">
                    ${ttd?.ttdImage ? `<img src="${ttd.ttdImage}" style="max-height: 70px; max-width: 140px; object-fit: contain; display: block; margin: 0 auto;" />` : `<div style="min-height: 70px;"></div>`}
                  </div>
                </div>
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 4px; display: block; width: 90%; margin-left: auto; margin-right: auto;">${ttd?.nama || "_________________"}</p>
                <p style="font-size: 9px; color: #333; margin-top: 3px;">${ttd?.jabatan || "PT Bukit Agrochemical Baru"}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="page-break"></div>

        <div class="doc-page-pi" style="page-break-before: always;">
          <img src="/LogoAGRO.png" alt="Watermark" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 280px; height: auto; opacity: 0.6; pointer-events: none; z-index: 0;" onerror="this.style.display='none'" />
          <div style="position: relative; z-index: 1;">
            <img src="/logo.png" alt="Header" style="width: 100%; display: block; margin-bottom: 0;" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '<div style=text-align:center;padding:10px;border:1px solid #ccc;margin-bottom:10px;>Logo tidak tersedia</div>');" />
            <div style="text-align: center; margin: 8px 0 10px 0; padding: 5px 0; background: #dcfce7; border-top: 2px solid #16a34a; border-bottom: 2px solid #16a34a; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
              <h1 style="color: #111; font-size: 15px; margin: 0; font-weight: bold; letter-spacing: 3px;">PROFORMA INVOICE</h1>
            </div>
            <div style="margin-bottom: 10px;">
              <p style="font-size: 9px; color: #333; margin-bottom: 2px;">Kepada Yth,</p>
              <div style="display: flex; justify-content: space-between; gap: 0;">
                <div style="flex: 1; border: 1px solid #000; padding: 8px 10px; min-height: 75px;">
                  <p style="font-size: 11px; font-weight: 700; color: #000; margin: 0 0 3px 0;">${pi.namaCustomer || ""}</p>
                  <p style="font-size: 9px; color: #333; line-height: 1.5;">${(pi.alamatCustomer || "").replace(/\n/g, "<br>")}</p>
                </div>
                <div style="width: 250px; padding: 0 0 0 10px;">
                  <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 9px; border-bottom: 1px solid #ddd;">
                    <span style="color: #333; min-width: 90px;">Tanggal</span><span style="margin: 0 3px;">:</span><span style="color: #000; font-weight: 600; text-align: right; flex: 1;">${pi.tanggal || ""}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 9px; border-bottom: 1px solid #ddd;">
                    <span style="color: #333; min-width: 90px;">No Invoice</span><span style="margin: 0 3px;">:</span><span style="color: #000; font-weight: 600; text-align: right; flex: 1;">${pi.nomorPI || ""}</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 9px; border-bottom: 1px solid #ddd;">
                    <span style="color: #333; min-width: 90px;">Metode Pembayaran</span><span style="margin: 0 3px;">:</span><span style="color: #000; font-weight: 600; text-align: right; flex: 1;">${pi.metodePembayaran || ""}</span>
                  </div>
                  ${pi.npwp ? `<div style="display: flex; justify-content: space-between; padding: 2px 0; font-size: 9px; border-bottom: 1px solid #ddd;"><span style="color: #333; min-width: 90px;">NPWP</span><span style="margin: 0 3px;">:</span><span style="color: #000; font-weight: 600; text-align: right; flex: 1;">${pi.npwp}</span></div>` : ""}
                </div>
              </div>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 0;">
              <thead>
                <tr>
                  <th style="background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 28px;">NO</th>
                  <th style="background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: left; padding-left: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">Nama Produk</th>
                  <th style="background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 45px;">Fot</th>
                  <th style="background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: left; padding-left: 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 90px;">Produsen</th>
                  <th style="background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 60px;">Kuantitas<br>(kg)</th>
                  <th style="background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 95px;">Harga Satuan</th>
                  <th style="background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; width: 105px;">Total Harga</th>
                </tr>
              </thead>
              <tbody>${piProdukRows}${piEmptyRows}</tbody>
            </table>
            <div style="display: flex; border: 1px solid #000; border-top: none;">
              <div style="flex: 1; padding: 8px 10px; border-right: 1px solid #000;">
                <div style="font-size: 9px; color: #333; margin-bottom: 3px; font-weight: 600;">Terbilang :</div>
                <div style="font-size: 10px; color: #000; font-weight: 700; text-transform: uppercase; line-height: 1.4;">${pi.terbilang || "-"}</div>
              </div>
              <div style="width: 250px; padding: 0;">
                <div style="display: flex; justify-content: space-between; padding: 3px 10px; border-bottom: 1px solid #ddd; font-size: 9px;">
                  <span style="color: #333;">Subtotal</span><span style="font-weight: 600; font-family: monospace; font-size: 9px;">${formatRupiah(pi.subtotal)}</span>
                </div>
                ${(pi.uangMuka || 0) > 0 ? `<div style="display: flex; justify-content: space-between; padding: 3px 10px; border-bottom: 1px solid #ddd; font-size: 9px;"><span style="color: #333;">Uang Muka</span><span style="font-weight: 600; font-family: monospace; font-size: 9px;">${formatRupiah(pi.uangMuka)}</span></div>` : ""}
                ${pi.includePPN ? `<div style="display: flex; justify-content: space-between; padding: 3px 10px; border-bottom: 1px solid #ddd; font-size: 9px;"><span style="color: #333;">PPN 11%</span><span style="font-weight: 600; font-family: monospace; font-size: 9px;">${formatRupiah(pi.ppnNominal)}</span></div>` : ""}
                ${(pi.ongkosKirim || 0) > 0 ? `<div style="display: flex; justify-content: space-between; padding: 3px 10px; border-bottom: 1px solid #ddd; font-size: 9px;"><span style="color: #333;">Ongkos Kirim</span><span style="font-weight: 600; font-family: monospace; font-size: 9px;">${formatRupiah(pi.ongkosKirim)}</span></div>` : ""}
                <div style="display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: none; background: #f0fdf4; border-top: 1px solid #16a34a; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-size: 9px;">
                  <span style="font-weight: 700; color: #000;">Jumlah Tertagih</span><span style="font-size: 10px; color: #000; font-weight: 700; font-family: monospace;">${formatRupiah(pi.jumlahTertagih)}</span>
                </div>
                <div style="padding: 5px 10px; text-align: right; border-top: 1px solid #ddd; font-size: 11px;">
                  <span style="color: #666; font-size: 11px;">Tanggal Jatuh Tempo : </span><span style="color: #dc2626; font-weight: 700; font-size: 11px;">${pi.tanggalJatuhTempo || ""}</span>
                </div>
                <div style="padding: 4px 10px; text-align: right; border-top: 1px solid #eee; font-size: 10px; color: #666;">Dibuat: ${createdAtStr}</div>
              </div>
            </div>
            <div style="display: flex; border: 1px solid #000; border-top: none;">
              <div style="flex: 1; padding: 8px 10px; border-right: 1px solid #000;">
                <p style="font-size: 9px; font-weight: 700; color: #000; margin-bottom: 5px;">Pembayaran mohon ditransfer via rekening:</p>
                <div style="font-size: 8px; line-height: 1.6; color: #333;">
                  <p><strong style="color: #000; font-size: 9px;">BANK MANDIRI</strong> - Cabang Lamandau</p>
                  <p>a/n PT Bukit Agrochemical Baru</p>
                  <p>No. Rek : 159-00-1205477-0</p>
                  <p style="margin-top: 3px;"><strong style="color: #000; font-size: 9px;">BANK BRI</strong> - Cabang Lamandau</p>
                  <p>a/n PT Bukit Agrochemical Baru</p>
                  <p>No. Rek : 2232-01000-879-567</p>
                </div>
              </div>
              <div style="width: 180px; padding: 8px 10px; text-align: center;">
                <p style="font-size: 9px; color: #333; margin-bottom: 6px;">Dengan Hormat</p>
                ${pi.ttdImage ? `<img src="${pi.ttdImage}" style="height: 40px; object-fit: contain; margin: 0 auto 4px auto; display: block;" />` : `<div style="height: 40px;"></div>`}
                <p style="font-size: 10px; font-weight: 700; color: #000; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">${pi.ttdNama || ""}</p>
                <p style="font-size: 8px; color: #555;">${pi.ttdJabatan ? `(${pi.ttdJabatan})` : ""}</p>
              </div>
            </div>
          </div>
        </div>

        ${spHtml}
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const columns = [
    {
      key: "no",
      header: "NO",
      width: "50px",
      render: (row: BeritaAcaraData & { __index?: number }) => <span className="text-sm text-gray-900">{(row.__index ?? 0) + 1}</span>,
    },
    {
      key: "nomorPI",
      header: "NOMOR PI",
      width: "150px",
      render: (row: BeritaAcaraData) => {
        const piNomor = Array.isArray(row.nomorPI) ? row.nomorPI[0] : row.nomorPI;
        return <span className="font-mono font-semibold text-green-700">{piNomor}</span>;
      },
    },
    {
      key: "namaCustomer",
      header: "CUSTOMER",
      render: (row: BeritaAcaraData) => {
        const piNomor = Array.isArray(row.nomorPI) ? row.nomorPI[0] : row.nomorPI;
        const pi = piMap[piNomor];
        return <span className="font-medium text-gray-800">{pi?.namaCustomer || row.namaCustomer || "-"}</span>;
      },
    },
    {
      key: "tanggal",
      header: "TANGGAL BA",
      width: "120px",
      render: (row: BeritaAcaraData) => <span className="text-sm text-gray-600">{row.tanggal}</span>,
    },
    {
      key: "nomorSeri",
      header: "NOMOR BA",
      width: "180px",
      render: (row: BeritaAcaraData) => <span className="font-mono text-sm font-bold text-indigo-700">{row.nomorSeri}</span>,
    },
    {
      key: "jumlahSP",
      header: "JUMLAH SP",
      width: "100px",
      render: (row: BeritaAcaraData) => {
        const count = getJumlahSP(row.nomorPI);
        return <span className="px-2 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700">{count} Surat</span>;
      },
    },
    {
      key: "statusTTD",
      header: "STATUS TTD",
      width: "120px",
      render: (row: BeritaAcaraData) => {
        const ttd = getTTDForBA(row.id);
        if (ttd) {
          return <span className="px-2 py-1 rounded-md text-xs font-bold bg-green-100 text-green-700">{ttd.nama}</span>;
        }
        return <span className="px-2 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700">Belum TTD</span>;
      },
    },
    {
      key: "aksi",
      header: "AKSI",
      width: "140px",
      render: (row: BeritaAcaraData) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleSelectTTD(row); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
            TTD
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handlePrintCombined(row); }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print
          </button>
        </div>
      ),
    },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Akses Berita Acara</h2>
            <p className="text-sm text-gray-500 mt-1">Masukkan PIN untuk melanjutkan</p>
          </div>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handlePinSubmit(); }}
            className="w-full px-4 py-3 text-center text-2xl tracking-widest border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 mb-4"
            placeholder="••••••"
          />
          <Button variant="primary" className="w-full" onClick={handlePinSubmit}>Masuk</Button>
          <p className="text-xs text-gray-400 text-center mt-4">PIN default: 080900</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start sm:items-center justify-between gap-4">
        <Header title="Daftar Proforma Invoice dengan Berita Acara" subtitle="Pilih PI untuk mencetak dokumen gabungan BA + PI + SP" />
        <Button variant="secondary" onClick={() => setIsPinSettingsOpen(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Pengaturan PIN
        </Button>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              placeholder="Cari nomor PI, customer, nomor BA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <Input label="Filter Tanggal" type="date" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} />
          <Select label="Filter Bulan" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} options={bulanOptions} />
          <Select label="Filter Tahun" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} options={tahunOptions} />
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredData.length} dari {baList.length} data
          {filterTanggal && ` | Tanggal: ${filterTanggal}`}
          {filterBulan && ` | Bulan: ${bulanOptions.find((b) => b.value === filterBulan)?.label}`}
          {filterTahun && ` | Tahun: ${filterTahun}`}
        </div>

        <Table
          columns={columns}
          data={filteredData.map((row, idx) => ({ ...row, __index: idx }))}
          isLoading={isLoading}
          emptyMessage="Belum ada data berita acara"
          keyExtractor={(row) => row.id}
        />
      </Card>

      <Modal isOpen={isTTDModalOpen} onClose={() => setIsTTDModalOpen(false)} title="Pilih TTD" size="md" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsTTDModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleSaveTTD}>Simpan</Button>
        </div>
      }>
        <div className="space-y-4">
          <Select
            label="Pilih TTD"
            value={selectedTTDId}
            onChange={(e) => setSelectedTTDId(e.target.value)}
            options={[{ value: "", label: "Pilih tanda tangan..." }, ...ttdList.map((ttd) => ({ value: ttd.id, label: `${ttd.nama} - ${ttd.jabatan}` }))]}
          />
          {selectedTTDId && (() => {
            const ttd = ttdList.find(t => t.id === selectedTTDId);
            if (!ttd) return null;
            return (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center gap-4">
                <img src={ttd.ttdImage} alt="TTD" className="h-16 object-contain bg-white rounded-lg border border-gray-200" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{ttd.nama}</p>
                  <p className="text-xs text-gray-500">{ttd.jabatan}</p>
                </div>
              </div>
            );
          })()}
          <p className="text-xs text-gray-500">Kosongkan pilihan untuk menghapus TTD yang sudah dipilih.</p>
        </div>
      </Modal>

      <Modal isOpen={isPinSettingsOpen} onClose={() => setIsPinSettingsOpen(false)} title="Pengaturan PIN" size="md" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsPinSettingsOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleChangePin}>Ubah PIN</Button>
        </div>
      }>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">PIN Lama</label>
            <input type="password" inputMode="numeric" value={oldPinInput} onChange={(e) => setOldPinInput(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">PIN Baru</label>
            <input type="password" inputMode="numeric" value={newPinInput} onChange={(e) => setNewPinInput(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Konfirmasi PIN Baru</label>
            <input type="password" inputMode="numeric" value={confirmPinInput} onChange={(e) => setConfirmPinInput(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
          </div>
          <p className="text-xs text-gray-500">PIN minimal 4 digit. PIN default adalah 080900.</p>
        </div>
      </Modal>
    </div>
  );
}