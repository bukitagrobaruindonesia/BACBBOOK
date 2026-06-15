"use client";

import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, doc, deleteDoc, updateDoc, Timestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Header from "@/app/components/ui/Header";
import Table from "@/app/components/ui/Table";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import Card from "@/app/components/ui/Card";

interface InvoiceItem {
  no: number;
  namaProduk: string;
  produsen: string;
  kemasan: string;
  fot: string;
  kuantitas: number;
  satuan: string;
  hargaSatuan: number;
  hargaPerZakDus: number;
  subTotal: number;
}

interface SuratPengangkutan {
  nomorSeri: string;
  tanggal: string;
  driverUnit: string;
  nomorPolisi: string;
  items: any[];
  totalKG: number;
}

interface ArsipInvoiceSementara {
  id: string;
  nomorInvoice: string;
  tanggalInvoice: string;
  nomorPI: string;
  nomorSeriSP: string;
  namaCustomer: string;
  alamatCustomer: string;
  npwp: string;
  customerId: string;
  produkItems: any[];
  invoiceItems: InvoiceItem[];
  suratPengangkutan: SuratPengangkutan;
  subtotal: number;
  ppnNominal: number;
  ongkosKirim: number;
  jumlahTertagih: number;
  terbilang: string;
  ttdOrderNama: string;
  ttdOrderJabatan: string;
  ttdOrderImage: string;
  ttdHormatNama: string;
  ttdHormatJabatan: string;
  ttdHormatImage: string;
  isPrinted: boolean;
  printedAt: Date | null;
  printedBy: string;
  createdAt: Date;
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

const generateTahunOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [{ value: "", label: "Semua Tahun" }];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
};

export default function ArsipInvoiceSementaraPage() {
  const [data, setData] = useState<ArsipInvoiceSementara[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "unprinted" | "printed">("all");
  const [filterBulan, setFilterBulan] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ArsipInvoiceSementara | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<ArsipInvoiceSementara | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMarking, setIsMarking] = useState(false);
  const [unprintedCount, setUnprintedCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "arsipInvoiceSementara"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          nomorInvoice: d.nomorInvoice || "",
          tanggalInvoice: d.tanggalInvoice || "",
          nomorPI: d.nomorPI || "",
          nomorSeriSP: d.nomorSeriSP || "",
          namaCustomer: d.namaCustomer || "",
          alamatCustomer: d.alamatCustomer || "",
          npwp: d.npwp || "",
          customerId: d.customerId || "",
          produkItems: d.produkItems || [],
          invoiceItems: d.invoiceItems || [],
          suratPengangkutan: d.suratPengangkutan || {},
          subtotal: d.subtotal || 0,
          ppnNominal: d.ppnNominal || 0,
          ongkosKirim: d.ongkosKirim || 0,
          jumlahTertagih: d.jumlahTertagih || 0,
          terbilang: d.terbilang || "",
          ttdOrderNama: d.ttdOrderNama || "",
          ttdOrderJabatan: d.ttdOrderJabatan || "",
          ttdOrderImage: d.ttdOrderImage || "",
          ttdHormatNama: d.ttdHormatNama || "",
          ttdHormatJabatan: d.ttdHormatJabatan || "",
          ttdHormatImage: d.ttdHormatImage || "",
          isPrinted: d.isPrinted || false,
          printedAt: d.printedAt?.toDate() || null,
          printedBy: d.printedBy || "",
          createdAt: d.createdAt?.toDate() || new Date(),
        } as ArsipInvoiceSementara;
      });
      const sortedItems = items.sort((a, b) => {
        if (a.isPrinted !== b.isPrinted) return a.isPrinted ? 1 : -1;
        if (!a.isPrinted && !b.isPrinted) return a.createdAt.getTime() - b.createdAt.getTime();
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      setData(sortedItems);
      setUnprintedCount(sortedItems.filter((i) => !i.isPrinted).length);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const filteredData = useMemo(() => {
    let result = data.filter((item) => {
      const matchSearch =
        item.nomorInvoice?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nomorPI?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nomorSeriSP?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.namaCustomer?.toLowerCase().includes(searchTerm.toLowerCase());
      if (filterStatus === "unprinted") return matchSearch && !item.isPrinted;
      if (filterStatus === "printed") return matchSearch && item.isPrinted;
      return matchSearch;
    });
    if (filterBulan || filterTahun) {
      result = result.filter((item) => {
        if (!item.tanggalInvoice) return false;
        const dateParts = item.tanggalInvoice.split("-");
        if (dateParts.length < 3) return false;
        const itemBulan = dateParts[1];
        const itemTahun = dateParts[2];
        const matchBulan = filterBulan ? itemBulan === filterBulan : true;
        const matchTahun = filterTahun ? itemTahun === filterTahun : true;
        return matchBulan && matchTahun;
      });
    }
    return result;
  }, [data, searchTerm, filterStatus, filterBulan, filterTahun]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(start, start + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterBulan, filterTahun, itemsPerPage]);

  const handleDetail = (item: ArsipInvoiceSementara) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleDeleteClick = (item: ArsipInvoiceSementara) => {
    setDeleteItem(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteItem) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "arsipInvoiceSementara", deleteItem.id));
      setData((prev) => prev.filter((i) => i.id !== deleteItem.id));
      setIsDeleteModalOpen(false);
      setDeleteItem(null);
    } catch (error) {
      console.error(error);
      alert("Gagal menghapus data. Silakan coba lagi.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMarkPrinted = async (item: ArsipInvoiceSementara) => {
    setIsMarking(true);
    try {
      await updateDoc(doc(db, "arsipInvoiceSementara", item.id), {
        isPrinted: true,
        printedAt: Timestamp.now(),
        printedBy: "User",
      });
      const updated = { ...item, isPrinted: true, printedAt: new Date(), printedBy: "User" };
      setData((prev) => {
        const filtered = prev.filter((i) => i.id !== item.id);
        const newArr = [...filtered, updated].sort((a, b) => {
          if (a.isPrinted !== b.isPrinted) return a.isPrinted ? 1 : -1;
          if (!a.isPrinted && !b.isPrinted) return a.createdAt.getTime() - b.createdAt.getTime();
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        return newArr;
      });
      setUnprintedCount((prev) => Math.max(0, prev - 1));
      if (selectedItem && selectedItem.id === item.id) {
        setSelectedItem(updated);
      }
    } catch (error) {
      console.error(error);
      alert("Gagal menandai status print.");
    } finally {
      setIsMarking(false);
    }
  };

  const handleUnmarkPrinted = async (item: ArsipInvoiceSementara) => {
    setIsMarking(true);
    try {
      await updateDoc(doc(db, "arsipInvoiceSementara", item.id), {
        isPrinted: false,
        printedAt: null,
        printedBy: "",
      });
      const updated = { ...item, isPrinted: false, printedAt: null, printedBy: "" };
      setData((prev) => {
        const filtered = prev.filter((i) => i.id !== item.id);
        const newArr = [...filtered, updated].sort((a, b) => {
          if (a.isPrinted !== b.isPrinted) return a.isPrinted ? 1 : -1;
          if (!a.isPrinted && !b.isPrinted) return a.createdAt.getTime() - b.createdAt.getTime();
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
        return newArr;
      });
      setUnprintedCount((prev) => prev + 1);
      if (selectedItem && selectedItem.id === item.id) {
        setSelectedItem(updated);
      }
    } catch (error) {
      console.error(error);
      alert("Gagal mengubah status print.");
    } finally {
      setIsMarking(false);
    }
  };

  const handlePrintInvoice = (item: ArsipInvoiceSementara) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const itemsHtml = (item.invoiceItems || []).map((it) => `
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
    const emptyRows = Array.from({ length: Math.max(0, 8 - (item.invoiceItems || []).length) }, (_, i) => `
      <tr>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${(item.invoiceItems || []).length + i + 1}</td>
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
    const ppn = item.ppnNominal || 0;
    const ongkosKirim = item.ongkosKirim || 0;
    const totalPembayaran = item.jumlahTertagih || 0;
    const totalSubTotal = item.subtotal || 0;
    const sp = item.suratPengangkutan || {};
    const spItemsHtml = (sp.items || []).map((it: any, idx: number) => `
      <tr>
        <td style="text-align: center; padding: 5px 3px; font-size: 9px; border: 1px solid #000;">${idx + 1}</td>
        <td style="padding: 5px 3px; font-size: 9px; border: 1px solid #000;">${it.jenisPupuk || "-"}</td>
        <td style="text-align: center; padding: 5px 3px; font-size: 9px; border: 1px solid #000;">${it.pengambilanZAK || "0"} ZAK</td>
        <td style="text-align: right; padding: 5px 3px; font-size: 9px; border: 1px solid #000;">${it.totalKG || "0"} KG</td>
      </tr>
    `).join("");
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${item.nomorInvoice}</title>
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
          .sp-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 9px; }
          .sp-table th { background: #f0fdf4; font-size: 8px; padding: 4px 3px; border: 1px solid #000; font-weight: 700; text-align: center; }
          .sp-table td { border: 1px solid #000; padding: 4px 3px; vertical-align: top; }
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
          <div class="title-bar">I N V O I C E &nbsp; S E M E N T A R A</div>
          <div class="info-section">
            <div class="customer-box">
              <p class="customer-title">Kepada Yth,</p>
              <p class="customer-name">${item.namaCustomer || ""}</p>
              <p>${(item.alamatCustomer || "").replace(/\n/g, "<br>")}</p>
              ${item.npwp ? `<p style="margin-top: 3px;">NP/WP: ${item.npwp}</p>` : ""}
            </div>
            <div class="meta-box">
              <p><span style="font-weight: 600;">INVOICE NO. :</span> ${item.nomorInvoice}</p>
              <p><span style="font-weight: 600;">TANGGAL :</span> ${new Date(item.tanggalInvoice).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p><span style="font-weight: 600;">CUSTOMER ID :</span> ${item.customerId || "-"}</p>
              <p><span style="font-weight: 600;">NOMOR PI :</span> ${item.nomorPI || ""}</p>
              <p><span style="font-weight: 600;">NO. SP :</span> ${sp.nomorSeri || ""}</p>
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
              <tr><td style="border: none;"></td><td class="summary-label">DPP NILAI LAIN-LAIN</td><td class="summary-value">${formatRupiah(0)}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label">ONGKOS KIRIM</td><td class="summary-value">${ongkosKirim > 0 ? formatRupiah(ongkosKirim) : "Rp -"}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label">PPN</td><td class="summary-value">${ppn > 0 ? formatRupiah(ppn) : "Rp -"}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label">SUB TOTAL</td><td class="summary-value">${formatRupiah(totalSubTotal + ppn)}</td></tr>
              <tr><td style="border: none;"></td><td class="summary-label total-row">TOTAL PEMBAYARAN :</td><td class="summary-value total-row">${formatRupiah(totalPembayaran)}</td></tr>
            </table>
          </div>
          <div class="terbilang-box">
            <div class="terbilang-label">TERBILANG :</div>
            <div>${item.terbilang || numberToWords(Math.round(totalPembayaran))}</div>
          </div>
          <div style="margin-top: 8px;">
            <p style="font-size: 9px; font-weight: 700; margin-bottom: 4px;">DATA SURAT PENGANGKUTAN:</p>
            <table class="sp-table">
              <thead>
                <tr>
                  <th style="width: 24px;">NO</th>
                  <th>JENIS PUPUK</th>
                  <th style="width: 80px;">PENGAMBILAN</th>
                  <th style="width: 80px;">TOTAL KG</th>
                </tr>
              </thead>
              <tbody>${spItemsHtml}</tbody>
            </table>
            <div style="display: flex; justify-content: space-between; font-size: 9px; margin-top: 4px;">
              <span><strong>Driver:</strong> ${sp.driverUnit || "-"}</span>
              <span><strong>No Polisi:</strong> ${sp.nomorPolisi || "-"}</span>
              <span><strong>Tanggal SP:</strong> ${sp.tanggal || "-"}</span>
            </div>
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
                <p style="font-weight: 700;">${item.namaCustomer || ""}</p>
              </div>
              <div class="ttd-box" style="text-align: center;">
                <p style="font-weight: 600; text-align: left;">Diorder Oleh:</p>
                <p style="text-align: left;">PT. Bukit Agrochemical Baru</p>
                <div style="height: 10px;"></div>
                ${item.ttdOrderImage ? `<img src="${item.ttdOrderImage}" style="height: 35px; object-fit: contain; display: block; margin: 0 auto 2px auto;" />` : `<div style="height: 35px;"></div>`}
                <div style="border-top: 1px solid #000; padding-top: 2px; margin-top: 2px;">
                  ${item.ttdOrderImage ? `<p style="font-weight: 700; margin: 0;">${item.ttdOrderNama}</p>` : `<p style="font-weight: 700; margin: 0;">_________________</p>`}
                  ${item.ttdOrderImage ? `<p style="margin: 0; font-size: 8px;">${item.ttdOrderJabatan}</p>` : ""}
                </div>
              </div>
            </div>
            <div class="right-signature">
              <p style="margin-bottom: 30px;">Hormat kami,<br>PT. Bukit Agrochemical Baru</p>
              ${item.ttdHormatImage ? `<img src="${item.ttdHormatImage}" alt="TTD" style="height: 50px; object-fit: contain; margin: 0 auto; display: block;" />` : `<img src="/Picture4.png" alt="TTD" style="height: 50px; object-fit: contain; margin: 0 auto; display: block;" onerror="this.style.display=\'none\'" />`}
              <p style="font-weight: 700; margin-top: 4px; border-top: 1px solid #000; padding-top: 3px; display: inline-block;">${item.ttdHormatNama || "Sri Setyo Wibowo"}</p>
              <p>${item.ttdHormatJabatan || "Manager Keuangan"}</p>
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

  const columns = [
    {
      key: "status",
      header: "Status",
      width: "110px",
      render: (row: ArsipInvoiceSementara) => (
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${row.isPrinted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
          {row.isPrinted ? "SUDAH PRINT" : "BELUM PRINT"}
        </span>
      ),
    },
    {
      key: "tanggalInvoice",
      header: "Tanggal",
      width: "120px",
      render: (row: ArsipInvoiceSementara) => <span className="font-medium text-gray-800">{row.tanggalInvoice}</span>,
    },
    {
      key: "nomorInvoice",
      header: "Nomor Invoice",
      width: "180px",
      render: (row: ArsipInvoiceSementara) => <span className="font-mono font-bold text-green-700">{row.nomorInvoice}</span>,
    },
    {
      key: "nomorPI",
      header: "Nomor PI",
      width: "140px",
      render: (row: ArsipInvoiceSementara) => <span className="font-semibold text-blue-700">{row.nomorPI}</span>,
    },
    {
      key: "nomorSeriSP",
      header: "Nomor SP",
      width: "160px",
      render: (row: ArsipInvoiceSementara) => <span className="font-mono text-purple-700">{row.nomorSeriSP}</span>,
    },
    {
      key: "namaCustomer",
      header: "Customer",
      render: (row: ArsipInvoiceSementara) => row.namaCustomer,
    },
    {
      key: "jumlahTertagih",
      header: "Jumlah",
      width: "150px",
      render: (row: ArsipInvoiceSementara) => <span className="font-mono font-medium text-gray-900">{formatRupiah(row.jumlahTertagih)}</span>,
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "220px",
      render: (row: ArsipInvoiceSementara) => (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleDetail(row); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Detail">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handlePrintInvoice(row); }} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Print Invoice">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); row.isPrinted ? handleUnmarkPrinted(row) : handleMarkPrinted(row); }} className={`p-2 rounded-lg transition-colors ${row.isPrinted ? "text-orange-600 hover:bg-orange-50" : "text-green-600 hover:bg-green-50"}`} title={row.isPrinted ? "Batalkan Print" : "Tandai Sudah Print"}>
            {row.isPrinted ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            )}
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(row); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>
      ),
    },
  ];

  const tahunOptions = generateTahunOptions();

  const PaginationControls = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        pages.push(i);
      } else if (i === currentPage - 2 || i === currentPage + 2) {
        pages.push(-1);
      }
    }
    const uniquePages = pages.filter((p, idx, arr) => p !== -1 || arr[idx - 1] !== -1);
    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-500">
          Menampilkan {filteredData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} - {Math.min(currentPage * itemsPerPage, filteredData.length)} dari {filteredData.length} data
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            Sebelumnya
          </button>
          {uniquePages.map((p, idx) =>
            p === -1 ? (
              <span key={`dots-${idx}`} className="px-2 text-gray-400">...</span>
            ) : (
              <button
                key={p}
                onClick={() => setCurrentPage(p)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  p === currentPage ? "bg-green-600 text-white" : "border border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p}
              </button>
            )
          )}
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            Selanjutnya
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Header title="Arsip Invoice Sementara" subtitle="Daftar invoice BAGB-INV-S yang sudah diterbitkan" />
        {unprintedCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-bold">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            {unprintedCount} Belum Print
          </div>
        )}
      </div>
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Cari nomor invoice, PI, SP, customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              {bulanOptions.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              {tahunOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value="all">Semua</option>
              <option value="unprinted">Belum Print</option>
              <option value="printed">Sudah Print</option>
            </select>
            <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
              <option value={5}>5 / hal</option>
              <option value={10}>10 / hal</option>
              <option value={15}>15 / hal</option>
              <option value={20}>20 / hal</option>
              <option value={25}>25 / hal</option>
              <option value={30}>30 / hal</option>
              <option value={50}>50 / hal</option>
              <option value={100}>100 / hal</option>
            </select>
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-4">
          Total {filteredData.length} data ditemukan
        </div>
        <Table columns={columns} data={paginatedData} isLoading={isLoading} emptyMessage="Belum ada arsip invoice sementara" keyExtractor={(row) => row.id} onRowClick={handleDetail} />
        <PaginationControls />
      </Card>
      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Detail Invoice ${selectedItem?.nomorInvoice}`} size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
          {selectedItem && (
            <>
              <Button variant="primary" onClick={() => handlePrintInvoice(selectedItem)}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
                Print Invoice
              </Button>
              <Button variant={selectedItem.isPrinted ? "outline" : "primary"} onClick={() => selectedItem.isPrinted ? handleUnmarkPrinted(selectedItem) : handleMarkPrinted(selectedItem)} disabled={isMarking}>
                {selectedItem.isPrinted ? "Batalkan Print" : "Tandai Sudah Print"}
              </Button>
            </>
          )}
        </div>
      }>
        {selectedItem && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedItem.isPrinted ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {selectedItem.isPrinted ? "SUDAH PRINT" : "BELUM PRINT"}
              </span>
              {selectedItem.isPrinted && selectedItem.printedAt && (
                <span className="text-xs text-gray-500">Print pada: {selectedItem.printedAt.toLocaleString("id-ID")}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Nomor Invoice</p><p className="text-lg font-mono font-bold text-green-700">{selectedItem.nomorInvoice}</p></div>
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Tanggal Invoice</p><p className="text-lg font-bold text-gray-800">{selectedItem.tanggalInvoice}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nomor PI</p>
                <p className="font-semibold text-blue-700">{selectedItem.nomorPI}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nomor SP</p>
                <p className="font-mono font-semibold text-purple-700">{selectedItem.nomorSeriSP}</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
              <p className="font-semibold text-gray-800">{selectedItem.namaCustomer}</p>
              <p className="text-sm text-gray-600 mt-1">{selectedItem.alamatCustomer}</p>
              {selectedItem.npwp && <p className="text-sm text-gray-600 mt-1">NPWP: {selectedItem.npwp}</p>}
            </div>
            <div className="overflow-x-auto">
              <p className="text-sm font-semibold text-gray-700 mb-3">Item Invoice</p>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-green-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">No</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Nama Produk</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Produsen</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase border">Kemasan</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase border">FOT</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">Kuantitas</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">Harga Satuan</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">Sub Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedItem.invoiceItems || []).map((it, idx) => (
                    <tr key={idx} className="border-b">
                      <td className="px-4 py-3 text-sm text-gray-900 border">{it.no}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 border">{it.namaProduk}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 border">{it.produsen || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center border">{it.kemasan}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 text-center border">{it.fot || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono border">{it.kuantitas.toLocaleString("id-ID")} {it.satuan}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono border">{formatRupiah(it.hargaSatuan)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right font-mono border">{formatRupiah(it.subTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="flex justify-between py-1"><span className="text-sm text-gray-600">Subtotal</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.subtotal)}</span></div>
              {selectedItem.ppnNominal > 0 && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">PPN 11%</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ppnNominal)}</span></div>}
              {selectedItem.ongkosKirim > 0 && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">Ongkos Kirim</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ongkosKirim)}</span></div>}
              <div className="flex justify-between py-2 border-t border-green-200 mt-2"><span className="text-base font-bold text-green-800">Jumlah Tertagih</span><span className="text-lg font-mono font-bold text-green-700">{formatRupiah(selectedItem.jumlahTertagih)}</span></div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
              <p className="text-xs text-purple-600 uppercase tracking-wide font-semibold mb-3">Data Surat Pengangkutan</p>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div><p className="text-xs text-gray-500">Nomor Seri</p><p className="text-sm font-mono font-semibold text-purple-700">{selectedItem.suratPengangkutan?.nomorSeri || "-"}</p></div>
                <div><p className="text-xs text-gray-500">Tanggal</p><p className="text-sm font-semibold text-gray-800">{selectedItem.suratPengangkutan?.tanggal || "-"}</p></div>
                <div><p className="text-xs text-gray-500">Driver</p><p className="text-sm font-semibold text-gray-800">{selectedItem.suratPengangkutan?.driverUnit || "-"}</p></div>
                <div><p className="text-xs text-gray-500">No Polisi</p><p className="text-sm font-semibold text-gray-800">{selectedItem.suratPengangkutan?.nomorPolisi || "-"}</p></div>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-purple-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-800 uppercase border">No</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-800 uppercase border">Jenis Pupuk</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-800 uppercase border">Pengambilan ZAK</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-purple-800 uppercase border">Total KG</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedItem.suratPengangkutan?.items || []).map((it: any, idx: number) => (
                    <tr key={idx} className="border-b">
                      <td className="px-3 py-2 text-sm text-gray-900 border">{idx + 1}</td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 border">{it.jenisPupuk || "-"}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-center font-mono border">{it.pengambilanZAK || "0"}</td>
                      <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono border">{it.totalKG || "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Diorder Oleh</p>
                {selectedItem.ttdOrderImage && <img src={selectedItem.ttdOrderImage} alt="TTD" className="h-16 object-contain mx-auto mb-2" />}
                <p className="text-sm font-semibold text-gray-900">{selectedItem.ttdOrderNama || "-"}</p>
                <p className="text-xs text-gray-500">{selectedItem.ttdOrderJabatan || ""}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-center">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Hormat Kami</p>
                {selectedItem.ttdHormatImage && <img src={selectedItem.ttdHormatImage} alt="TTD" className="h-16 object-contain mx-auto mb-2" />}
                <p className="text-sm font-semibold text-gray-900">{selectedItem.ttdHormatNama || "-"}</p>
                <p className="text-xs text-gray-500">{selectedItem.ttdHormatJabatan || ""}</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Terbilang</p>
              <p className="text-sm font-semibold text-gray-800 uppercase">{selectedItem.terbilang}</p>
            </div>
          </div>
        )}
      </Modal>
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Konfirmasi Hapus" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-700">Apakah Anda yakin ingin menghapus invoice <span className="font-bold text-red-600">{deleteItem?.nomorInvoice}</span>?</p>
          <p className="text-xs text-gray-500">Tindakan ini tidak dapat dibatalkan.</p>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Batal</Button>
          <Button variant="danger" onClick={handleConfirmDelete} disabled={isDeleting}>
            {isDeleting ? "Menghapus..." : "Hapus"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}