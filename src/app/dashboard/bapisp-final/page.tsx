"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Header from "@/app/components/ui/Header";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import Select from "@/app/components/ui/Select";

interface ProformaInvoice {
  id: string;
  tanggal: string;
  nomorPI: string;
  namaCustomer: string;
  alamatCustomer: string;
  npwp: string;
  metodePembayaran: string;
  produkItems: {
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
  }[];
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
  subJenisDO?: string | null;
}

interface BeritaAcaraData {
  id: string;
  nomorSeri: string;
  nomorPI: string;
  namaCustomer: string;
  tanggal: string;
  pihakPertama: {
    nama: string;
    jabatan: string;
    perusahaan: string;
  };
  pihakKedua: {
    nama: string;
    alamat: string;
  };
  items: {
    no: number;
    tanggalMuat: string;
    namaProduk: string;
    fot: string;
    qty: string;
    noSJ: string;
    driver: string;
    nopol: string;
  }[];
  ttdId?: string;
  ttdNama?: string;
  ttdJabatan?: string;
  ttdImage?: string;
  createdAt: Date;
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

export default function BapispFinalPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [piList, setPiList] = useState<ProformaInvoice[]>([]);
  const [bastList, setBastList] = useState<BeritaAcaraData[]>([]);
  const [suratList, setSuratList] = useState<SuratMuatInfo[]>([]);
  const [ttdList, setTtdList] = useState<TTDData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTanggal, setFilterTanggal] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (isAuthenticated) fetchData();
  }, [isAuthenticated]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const piQ = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"));
      const piSnap = await getDocs(piQ);
      const piData = piSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          tanggal: data.tanggal || "",
          nomorPI: data.nomorPI || "",
          namaCustomer: data.namaCustomer || "",
          alamatCustomer: data.alamatCustomer || "",
          npwp: data.npwp || "",
          metodePembayaran: data.metodePembayaran || "Transfer",
          produkItems: data.produkItems || [],
          uangMuka: data.uangMuka || 0,
          includePPN: data.includePPN || false,
          ppnNominal: data.ppnNominal || 0,
          ongkosKirim: data.ongkosKirim || 0,
          subtotal: data.subtotal || 0,
          jumlahTertagih: data.jumlahTertagih || 0,
          terbilang: data.terbilang || "",
          tanggalJatuhTempo: data.tanggalJatuhTempo || "",
          keterangan: data.keterangan || "",
          ttdNama: data.ttdNama || "",
          ttdJabatan: data.ttdJabatan || "",
          ttdImage: data.ttdImage || "",
          createdBy: data.createdBy || "",
          createdAt: data.createdAt?.toDate(),
          updatedAt: data.updatedAt?.toDate(),
        } as ProformaInvoice;
      });
      setPiList(piData);

      const baQ = query(collection(db, "beritaAcara"), orderBy("createdAt", "desc"));
      const baSnap = await getDocs(baQ);
      const baData = baSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nomorSeri: data.nomorSeri || "",
          nomorPI: data.nomorPI || "",
          namaCustomer: data.namaCustomer || "",
          tanggal: data.tanggal || "",
          pihakPertama: data.pihakPertama || { nama: "", jabatan: "", perusahaan: "" },
          pihakKedua: data.pihakKedua || { nama: "", alamat: "" },
          items: data.items || [],
          ttdId: data.ttdId || "",
          ttdNama: data.ttdNama || "",
          ttdJabatan: data.ttdJabatan || "",
          ttdImage: data.ttdImage || "",
          createdAt: data.createdAt?.toDate(),
        } as BeritaAcaraData;
      });
      setBastList(baData);

      const spQ = query(collection(db, "suratPengangkutan"), orderBy("createdAt", "desc"));
      const spSnap = await getDocs(spQ);
      const spData = spSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          nomorSeri: data.nomorSeri || "",
          tanggal: data.tanggal || "",
          items: data.items || [],
          totalKG: data.totalPengambilanKG || 0,
          nomorPolisi: data.nomorPolisi || "",
          driverUnit: data.driverUnit || "",
          nomorPI: data.nomorPI || "",
          nomorSIM: data.nomorSIM || "",
          jenisSurat: data.jenisSurat || "gudangInduk",
          subJenisDO: data.subJenisDO || null,
        } as SuratMuatInfo;
      });
      setSuratList(spData);

      const ttdQ = query(collection(db, "ttd"), orderBy("nama", "asc"));
      const ttdSnap = await getDocs(ttdQ);
      setTtdList(ttdSnap.docs.map((d) => ({ id: d.id, ...d.data() } as TTDData)));
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === "080900") {
      setIsAuthenticated(true);
      setPinError("");
    } else {
      setPinError("PIN salah. Silakan coba lagi.");
      setPinInput("");
    }
  };

  const getBastForPI = (nomorPI: string) => {
    return bastList.find((b) => b.nomorPI === nomorPI);
  };

  const getSuratForPI = (nomorPI: string) => {
    const seen = new Set<string>();
    return suratList.filter((s) => {
      let match = false;
      if (Array.isArray(s.nomorPI)) match = s.nomorPI.includes(nomorPI);
      else match = s.nomorPI === nomorPI;
      if (match && !seen.has(s.id)) {
        seen.add(s.id);
        return true;
      }
      return false;
    });
  };

  const getTtdForBast = (bast: BeritaAcaraData | undefined) => {
    if (!bast || !bast.ttdId) return undefined;
    return ttdList.find((t) => t.id === bast.ttdId);
  };

  const filteredPI = piList.filter((pi) => {
    const bast = getBastForPI(pi.nomorPI);
    if (!bast || !bast.ttdId) return false;
    const date = new Date(pi.tanggal);
    const matchTanggal = filterTanggal ? pi.tanggal === filterTanggal : true;
    const matchBulan = filterBulan ? (date.getMonth() + 1).toString().padStart(2, "0") === filterBulan : true;
    const matchTahun = filterTahun ? date.getFullYear().toString() === filterTahun : true;
    return matchTanggal && matchBulan && matchTahun;
  });

  const totalPages = Math.ceil(filteredPI.length / itemsPerPage);
  const paginatedPI = filteredPI.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePrintFinal = (pi: ProformaInvoice) => {
    const bast = getBastForPI(pi.nomorPI);
    if (!bast || !bast.ttdId) return;
    const spList = getSuratForPI(pi.nomorPI);
    const ttd = getTtdForBast(bast);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const baHtml = generateBAHtml(bast, ttd, pi);
    const piHtml = generatePIHtml(pi, ttd);
    const spHtml = generateSPHtml(spList, pi);
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>BAPISP-Final ${pi.nomorPI}</title>
        <style>
          @page { size: A4; margin: 10mm 12mm 10mm 12mm; }
          @media print {
            body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .no-print { display: none !important; }
            .page-break { page-break-after: always; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #000; }
          .page { width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; padding-bottom: 10mm; }
          .page-break { page-break-after: always; }
          .print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
          .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
          @media print { .print-bar { display: none !important; } }
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        ${baHtml}
        <div class="page-break"></div>
        ${piHtml}
        <div class="page-break"></div>
        ${spHtml}
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const generateBAHtml = (bast: BeritaAcaraData, ttd: TTDData | undefined, pi: ProformaInvoice) => {
    const now = new Date();
    const hari = now.toLocaleDateString("id-ID", { weekday: "long" });
    const tanggalLengkap = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const rowsHtml = bast.items.map((it) => `
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
    return `
      <div class="page">
        <img src="/Picture3.png" alt="Header" style="width: 100%; display: block; margin-bottom: 0;" onerror="this.style.display='none'" />
        <div style="text-align: center; margin: 8px 0 12px 0;">
          <h1 style="font-size: 14px; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; text-decoration: underline;">BERITA ACARA SERAH TERIMA BARANG</h1>
          <p style="font-size: 11px; font-weight: 600;">${bast.nomorSeri}</p>
        </div>
        <div style="padding: 0 4px;">
          <p style="margin-bottom: 12px; font-size: 10px;">Kami yang bertanda tangan di bawah ini, pada hari ${hari}, ${tanggalLengkap}</p>
          <div style="margin-bottom: 10px;">
            <p style="font-weight: 700; margin-bottom: 4px; font-size: 10px;">Selanjutnya disebut Pihak Pertama.</p>
            <table style="width: 100%; margin-bottom: 8px; font-size: 10px;">
              <tr><td style="padding: 2px 0; vertical-align: top; width: 100px; font-weight: 600;">Nama</td><td>: ${ttd?.nama || "............................"}</td></tr>
              <tr><td style="padding: 2px 0; vertical-align: top; font-weight: 600;">Perusahaan</td><td>: PT Bukit Agrochemical Baru</td></tr>
              <tr><td style="padding: 2px 0; vertical-align: top; font-weight: 600;">Jabatan</td><td>: ${ttd?.jabatan || "............................"}</td></tr>
            </table>
          </div>
          <div style="margin-bottom: 10px;">
            <p style="font-weight: 700; margin-bottom: 4px; font-size: 10px;">Selanjutnya yang disebut Pihak Kedua.</p>
            <table style="width: 100%; margin-bottom: 8px; font-size: 10px;">
              <tr><td style="padding: 2px 0; vertical-align: top; width: 100px; font-weight: 600;">Nama</td><td>: ${pi.namaCustomer}</td></tr>
              <tr><td style="padding: 2px 0; vertical-align: top; font-weight: 600;">Alamat</td><td>: ${(pi.alamatCustomer || "").replace(/\n/g, " ")}</td></tr>
            </table>
          </div>
          <p style="margin-bottom: 12px; font-size: 10px; text-align: justify;">Pihak pertama menyerahkan barang kepada pihak kedua, dan pihak kedua menyatakan telah menerima barang dari pihak pertama, berupa daftar terlampir :</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px;">
            <thead>
              <tr style="background: #f0fdf4; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 30px;">No</th>
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 80px;">Tanggal Muat</th>
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center;">Nama Produk</th>
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 80px;">FOT / No DO</th>
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 70px;">QTY</th>
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 120px;">No SJ</th>
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 90px;">Driver</th>
                <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 80px;">Nopol</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <p style="margin-bottom: 16px; font-size: 10px; text-align: justify;">Demikian berita acara serah terima barang ini diperbuat oleh kedua belah pihak, adapun barang-barang tersebut dalam keadaan baik dan cukup, sejak penandatanganan berita acara ini, maka barang-barang tersebut menjadi tanggung jawab pihak kedua.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 30px;">
            <tr>
              <td style="width: 50%; text-align: center; vertical-align: bottom; padding: 0 10px;">
                <p style="font-size: 9px; margin-bottom: 50px;">${pi.namaCustomer}<br>(Pihak Kedua)</p>
                <div style="height: 50px;"></div>
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">${pi.namaCustomer}</p>
              </td>
              <td style="width: 50%; text-align: center; vertical-align: bottom; padding: 0 10px;">
                <p style="font-size: 9px; margin-bottom: 50px;">${ttd?.nama || "........................"}<br>(Pihak Pertama)</p>
                ${ttd ? `
                  <div style="position: relative; display: inline-block; margin-bottom: 4px;">
                    <img src="${ttd.ttdImage}" alt="TTD" style="height: 50px; object-fit: contain; margin: 0 auto; display: block;" onerror="this.style.display='none'" />
                    <img src="/LogoAGRO.png" alt="Stampel" style="position: absolute; top: -15px; right: -30px; width: 70px; height: auto; opacity: 0.9; pointer-events: none;" onerror="this.style.display='none'" />
                  </div>
                ` : `<div style="height: 50px;"></div>`}
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">${ttd?.nama || "........................"}</p>
                <p style="font-size: 9px; color: #333; margin-top: 2px;">${ttd?.jabatan || ""}</p>
              </td>
            </tr>
          </table>
        </div>
      </div>
    `;
  };

  const generatePIHtml = (pi: ProformaInvoice, orderTTD?: TTDData) => {
    const produkRows = (pi.produkItems || []).map((p, idx) => `
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
    const emptyRows = Array.from({ length: emptyRowsCount }, (_, i) => `
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
    return `
      <div class="page">
        <img src="/LogoAGRO.png" alt="Watermark" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 280px; height: auto; opacity: 0.08; pointer-events: none; z-index: 0;" onerror="this.style.display='none'" />
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
              <tr style="background: #ffedd5; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <th style="color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; width: 28px;">NO</th>
                <th style="color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: left; padding-left: 8px;">Nama Produk</th>
                <th style="color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; width: 45px;">Fot</th>
                <th style="color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; width: 90px;">Produsen</th>
                <th style="color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; width: 60px;">Kuantitas<br>(kg)</th>
                <th style="color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; width: 95px;">Harga Satuan</th>
                <th style="color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; width: 105px;">Total Harga</th>
              </tr>
            </thead>
            <tbody>${produkRows}${emptyRows}</tbody>
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
              <div style="display: flex; justify-content: space-between; padding: 5px 10px; border-bottom: none; background: #f0fdf4; border-top: 1px solid #16a34a; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                <span style="font-weight: 700; color: #000;">Jumlah Tertagih</span><span style="font-size: 10px; color: #000; font-weight: 700; font-family: monospace;">${formatRupiah(pi.jumlahTertagih)}</span>
              </div>
              <div style="padding: 5px 10px; text-align: right; border-top: 1px solid #ddd; font-size: 11px;">
                <span style="color: #666; font-size: 11px;">Tanggal Jatuh Tempo : </span><span style="color: #dc2626; font-weight: 700; font-size: 11px;">${pi.tanggalJatuhTempo || ""}</span>
              </div>
              <div style="padding: 4px 10px; text-align: right; border-top: 1px solid #eee; font-size: 10px; color: #666;">Dibuat: ${createdAtStr}</div>
            </div>
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; border-top: none;">
            <tbody>
              <tr>
                <td style="width: 50%; vertical-align: bottom; padding: 8px 10px; border-right: 1px solid #000; font-size: 9px; line-height: 1.6; color: #333;">
                  <p style="font-size: 9px; font-weight: 700; color: #000; margin-bottom: 5px;">Pembayaran mohon ditransfer via rekening:</p>
                  <p><strong style="color: #000; font-size: 9px;">BANK MANDIRI</strong> - Cabang Lamandau</p>
                  <p>a/n PT Bukit Agrochemical Baru</p>
                  <p>No. Rek : 159-00-1205477-0</p>
                  <p style="margin-top: 3px;"><strong style="color: #000; font-size: 9px;">BANK BRI</strong> - Cabang Lamandau</p>
                  <p>a/n PT Bukit Agrochemical Baru</p>
                  <p>No. Rek : 2232-01000-879-567</p>
                  <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #ccc;">
                    <p style="font-size: 9px; font-weight: 700; color: #000; margin-bottom: 2px;">Dipesan oleh:</p>
                    <p style="font-size: 10px; font-weight: 700; color: #000;">${pi.namaCustomer || ""}</p>
                  </div>
                  <div style="margin-top: 6px;">
                    <p style="font-size: 9px; font-weight: 600; color: #000; margin-bottom: 2px;">Diorder Oleh:</p>
                    <p style="font-size: 9px; color: #333; margin-bottom: 2px;">PT. Bukit Agrochemical Baru</p>
                    ${orderTTD ? `<img src="${orderTTD.ttdImage}" style="height: 35px; object-fit: contain; display: block; margin: 2px 0;" onerror="this.style.display='none'" />` : `<div style="height: 35px;"></div>`}
                    <div style="border-top: 1px solid #000; padding-top: 2px; margin-top: 2px; display: inline-block; min-width: 120px;">
                      ${orderTTD ? `<p style="font-weight: 700; margin: 0; font-size: 9px;">${orderTTD.nama}</p><p style="margin: 0; font-size: 8px; color: #555;">${orderTTD.jabatan}</p>` : `<p style="font-weight: 700; margin: 0; font-size: 9px;">_________________</p>`}
                    </div>
                  </div>
                </td>
                <td style="width: 50%; vertical-align: bottom; text-align: center; padding: 8px 10px; font-size: 9px;">
                  <p style="margin-bottom: 30px;">Hormat kami,<br>PT. Bukit Agrochemical Baru</p>
                  <img src="/Picture4.png" alt="TTD" style="max-height: 50px; object-fit: contain; margin: 0 auto; display: block;" onerror="this.style.display='none'" />
                  <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">Sri Setyo Wibowo</p>
                  <p style="font-size: 8px; color: #555;">Manager Keuangan</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  const generateSPHtml = (spList: SuratMuatInfo[], pi: ProformaInvoice) => {
    return spList.map((surat) => {
      const isGI = !surat.jenisSurat || surat.jenisSurat === "gudangInduk";
      const piDisplay = Array.isArray(surat.nomorPI) ? surat.nomorPI.join(", ") : surat.nomorPI;
      const itemsHtml = (surat.items || []).map((it, idx) => `
        <tr>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
          ${!isGI ? `<td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorSubDO || "-"}</td>` : ""}
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${isGI ? (piDisplay || "-") : (it.nomorPO || "-")}</td>
          <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.jenisPupuk || ""}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.party || "-"}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.pengambilanZAK || "-"} ZAK</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.sisa || "-"}</td>
        </tr>
      `).join("");
      return `
        <div class="page" style="width: 176mm; margin: 0 auto; position: relative; min-height: 257mm; display: flex; flex-direction: column; font-family: Arial, sans-serif; font-size: 10px; line-height: 1.4; color: #000;">
          <img src="/Picture3.png" alt="Header" style="width: 100%; display: block; margin-bottom: 0;" onerror="this.style.display='none'" />
          <div style="text-align: center; background: #15803d; color: white; padding: 8px 0; margin: 8px 0 12px 0; font-weight: bold; font-size: 14px; letter-spacing: 2px; -webkit-print-color-adjust: exact; print-color-adjust: exact;">SURAT PENGANGKUTAN</div>
          <div style="margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px;">
              <span>Lamandau, ${new Date(surat.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px;">
              <span style="font-weight: 600;">Nomor Seri : ${surat.nomorSeri}</span>
            </div>
            ${piDisplay ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 10px;"><span style="font-weight: 600;">Nomor PI : ${piDisplay}</span></div>` : ""}
          </div>
          <div style="border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px;">
            <p style="font-size: 9px; color: #333; margin-bottom: 2px;">Kepada Yth :</p>
            <p style="font-size: 11px; font-weight: 700;">Bapak Kepala Gudang Induk</p>
            <p style="font-size: 11px; font-weight: 700;">PT Bukit Agrochemical Baru</p>
            <p style="font-size: 9px; color: #333; line-height: 1.5; margin-top: 2px;">Desa Sungai Rangit<br>Pangkalan Lada, Kalimantan Tengah</p>
          </div>
          <div style="font-size: 10px; margin-bottom: 8px;">
            <p style="margin-bottom: 2px;">Dengan Hormat,</p>
            <p style="margin-bottom: 2px;">Dengan ini mohon dimuatkan pupuk dengan rincian sebagai berikut :</p>
          </div>
          <div style="margin-bottom: 10px;">
            <div style="text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact;">DASAR PENGANGKUTAN</div>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: #f0fdf4; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
                  <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 30px;">NO</th>
                  ${!isGI ? `<th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 100px;">NOMOR SUB DO</th>` : ""}
                  <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 100px;">NOMOR PI</th>
                  <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center;">JENIS PUPUK</th>
                  <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 60px;">PARTY</th>
                  <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 100px;">PENGAMBILAN<br>ZAK</th>
                  <th style="font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; width: 60px;">SISA</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
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
            <p style="margin-bottom: 2px; font-weight: 700;">Notes :</p>
            <p style="margin-bottom: 2px;">- Jika terdapat coretan / tip-ex Sub DO dianggap batal.</p>
            <p style="margin-bottom: 2px;">- Sub DO berlaku selama 3 hari dari tanggal Sub DO diterbitkan.</p>
            <p style="margin-bottom: 2px;">- Untuk konfirmasi dengan Customer Service kami, silahkan scan QRcode di atas.</p>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: auto;">
            <tr>
              <td style="width: 50%; text-align: center; vertical-align: bottom; padding: 20px 10px 0;">
                <p style="font-size: 9px; margin-bottom: 45px;">Hormat Kami,<br>PT. BUKIT AGROCHEMICAL BARU</p>
                <img src="/Picture2.png" alt="TTD" style="max-height: 105px; object-fit: contain; margin: 0 auto; display: block;" onerror="this.style.display='none'" />
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">HENDRA PRAMASYANTO</p>
              </td>
              <td style="width: 50%; text-align: center; vertical-align: bottom; padding: 20px 10px 0;">
                <p style="font-size: 9px; margin-bottom: 45px;">Diangkut oleh,<br>Driver</p>
                <div style="height: 105px;"></div>
                <p style="font-size: 10px; font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">${surat.driverUnit || ""}</p>
              </td>
            </tr>
          </table>
          <img src="/Picture1.png" alt="Footer" style="width: 100%; display: block; margin-top: 10px;" onerror="this.style.display='none'" />
        </div>
      `;
    }).join('<div class="page-break"></div>');
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

  const perPageOptions = [
    { value: "5", label: "5 per halaman" },
    { value: "10", label: "10 per halaman" },
    { value: "25", label: "25 per halaman" },
    { value: "50", label: "50 per halaman" },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-800">Akses BAPISP Final</h2>
            <p className="text-sm text-gray-500 mt-1">Masukkan PIN untuk mengakses dokumen final BA + PI + SP</p>
          </div>
          <form onSubmit={handlePinSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">PIN Akses</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
                placeholder="Masukkan 6 digit PIN"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white text-center text-lg tracking-widest font-mono"
                autoFocus
              />
            </div>
            {pinError && (
              <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-center gap-2">
                <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-600">{pinError}</p>
              </div>
            )}
            <Button type="submit" variant="primary" className="w-full">
              Masuk
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header title="BAPISP Final" subtitle="Dokumen Final Berita Acara + Proforma Invoice + Surat Pengangkutan (Sudah TTD)" />

      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-800">Daftar Dokumen Final</h3>
              <p className="text-xs text-gray-500">Hanya menampilkan PI yang sudah memiliki Berita Acara dan TTD</p>
            </div>
          </div>
          <button
            onClick={() => { setIsAuthenticated(false); setPinInput(""); setPinError(""); }}
            className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
          >
            Keluar
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Filter Tanggal</label>
            <input type="date" value={filterTanggal} onChange={(e) => { setFilterTanggal(e.target.value); setCurrentPage(1); }} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Filter Bulan</label>
            <select value={filterBulan} onChange={(e) => { setFilterBulan(e.target.value); setCurrentPage(1); }} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white">
              {bulanOptions.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Filter Tahun</label>
            <select value={filterTahun} onChange={(e) => { setFilterTahun(e.target.value); setCurrentPage(1); }} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white">
              {tahunOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tampilan Per Halaman</label>
            <select value={String(itemsPerPage)} onChange={(e) => { setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1); }} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-white">
              {perPageOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => { setFilterTanggal(""); setFilterBulan(""); setFilterTahun(""); setCurrentPage(1); }}
              className="w-full px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-semibold transition-colors"
            >
              Reset Filter
            </button>
          </div>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {paginatedPI.length} dari {filteredPI.length} data
          {filterTanggal && ` | Tanggal: ${filterTanggal}`}
          {filterBulan && ` | Bulan: ${bulanOptions.find((b) => b.value === filterBulan)?.label}`}
          {filterTahun && ` | Tahun: ${filterTahun}`}
          {` | Halaman ${currentPage} dari ${totalPages || 1}`}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700"></div>
          </div>
        ) : filteredPI.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium">Belum ada dokumen final yang tersedia</p>
            <p className="text-sm mt-1">Dokumen akan muncul setelah Berita Acara diterbitkan dan ditandatangani</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-indigo-50 border-b border-indigo-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Nomor PI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Tanggal PI</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Tanggal BA</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-800 uppercase">Nomor BA</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-indigo-800 uppercase">Jumlah SP</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-indigo-800 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-indigo-800 uppercase">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginatedPI.map((pi, idx) => {
                  const bast = getBastForPI(pi.nomorPI);
                  const spCount = getSuratForPI(pi.nomorPI).length;
                  const ttd = getTtdForBast(bast);
                  return (
                    <tr key={pi.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-900">{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                      <td className="px-4 py-3 font-mono font-bold text-green-700">{pi.nomorPI}</td>
                      <td className="px-4 py-3 text-gray-600">{pi.tanggal}</td>
                      <td className="px-4 py-3 text-gray-800">{pi.namaCustomer}</td>
                      <td className="px-4 py-3 text-gray-600">{bast?.tanggal || "-"}</td>
                      <td className="px-4 py-3 font-mono text-indigo-700">{bast?.nomorSeri || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700">{spCount} Surat</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-1 rounded-md text-xs font-bold border bg-green-100 text-green-700 border-green-200">
                          {ttd ? "Sudah TTD" : "Belum TTD"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handlePrintFinal(pi)}
                          disabled={!ttd}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors flex items-center gap-1 mx-auto ${
                            ttd
                              ? "bg-green-600 hover:bg-green-700 text-white"
                              : "bg-gray-200 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                          Print Final
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentPage === 1 ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              Sebelumnya
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                    currentPage === page ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {page}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                currentPage === totalPages ? "bg-gray-100 text-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"
              }`}
            >
              Selanjutnya
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}