"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, deleteDoc, where } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Table from "@/app/components/ui/Table";
import Button from "@/app/components/ui/Button";
import Modal from "@/app/components/ui/Modal";
import Card from "@/app/components/ui/Card";
import { exportToExcel } from "@/app/utils/exportExcel";

interface ProdukItem {
  namaProduk: string;
  fot: string;
  produsen: string;
  kuantitas: number;
  satuan: string;
  hargaSatuan: number;
  totalHarga: number;
}

interface SuratPengangkutan {
  id: string;
  jenisSurat: string;
  nomorSeri: string;
  tanggal: string;
  nomorPIList: string[];
  items: Array<{
    nomorSubDO: string;
    nomorPO: string;
    jenisPupuk: string;
    party: string;
    pengambilanMT: number;
    pengambilanZAK: number;
    sisa: string;
  }>;
  sopirNopolList: Array<{
    namaSopir: string;
    nopol: string;
    nomorSIM: string;
  }>;
  totalPengambilanKG: number;
  createdAt: any;
}

interface ProformaInvoice {
  id: string;
  tanggal: string;
  nomorPI: string;
  namaCustomer: string;
  alamatCustomer: string;
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
  createdAt: any;
  updatedAt: any;
  sisaPengambilanKG?: number;
  statusPengangkutan?: string;
}

export default function RekapProformaInvoicePage() {
  const { user } = useAuth();
  const [data, setData] = useState<ProformaInvoice[]>([]);
  const [suratList, setSuratList] = useState<SuratPengangkutan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<ProformaInvoice | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSuratModalOpen, setIsSuratModalOpen] = useState(false);
  const [selectedSuratList, setSelectedSuratList] = useState<SuratPengangkutan[]>([]);

  useEffect(() => {
    fetchData();
    fetchSuratPengangkutan();
  }, []);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as ProformaInvoice));
      setData(items);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuratPengangkutan = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      } as SuratPengangkutan));
      setSuratList(items);
    } catch (error) {
      console.error(error);
    }
  };

  const getSuratForPI = (nomorPI: string) => {
    return suratList.filter((s) => s.nomorPIList && s.nomorPIList.includes(nomorPI));
  };

  const getTotalLoadedForPI = (nomorPI: string) => {
    return suratList
      .filter((s) => s.nomorPIList && s.nomorPIList.includes(nomorPI))
      .reduce((sum, s) => sum + (s.totalPengambilanKG || 0), 0);
  };

  const filteredData = data.filter((item) =>
    item.nomorPI?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.namaCustomer?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatRupiah = (num: number) => {
    if (!num && num !== 0) return "Rp -";
    return "Rp " + num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleDetail = (item: ProformaInvoice) => {
    setSelectedItem(item);
    const surats = getSuratForPI(item.nomorPI);
    setSelectedSuratList(surats);
    setIsDetailModalOpen(true);
  };

  const handleViewSurat = (item: ProformaInvoice) => {
    setSelectedItem(item);
    const surats = getSuratForPI(item.nomorPI);
    setSelectedSuratList(surats);
    setIsSuratModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data ini?")) return;
    try {
      await deleteDoc(doc(db, "proformaInvoice", id));
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((item) => {
      const totalOrdered = item.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
      const totalLoaded = getTotalLoadedForPI(item.nomorPI);
      return {
        "Tanggal": item.tanggal,
        "Nomor PI": item.nomorPI,
        "Nama Customer": item.namaCustomer,
        "Alamat": item.alamatCustomer,
        "Metode Pembayaran": item.metodePembayaran,
        "Subtotal": item.subtotal,
        "PPN 11%": item.includePPN ? item.ppnNominal : 0,
        "Uang Muka": item.uangMuka || 0,
        "Ongkos Kirim": item.ongkosKirim || 0,
        "Jumlah Tertagih": item.jumlahTertagih,
        "Terbilang": item.terbilang,
        "Jatuh Tempo": item.tanggalJatuhTempo,
        "Total Dipesan (KG)": totalOrdered,
        "Total Dimuat (KG)": totalLoaded,
        "Sisa (KG)": totalOrdered - totalLoaded,
        "Status": item.statusPengangkutan || "belum_dimuat",
        "Keterangan": item.keterangan,
        "Dibuat Oleh": item.createdBy,
      };
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

    const totalOrdered = item.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
    const totalLoaded = getTotalLoadedForPI(item.nomorPI);
    const remaining = totalOrdered - totalLoaded;

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
          .invoice-title { text-align: center; margin: 8px 0 10px 0; padding: 5px 0; background: #dcfce7; border-top: 2px solid #16a34a; border-bottom: 2px solid #16a34a; }
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
          .data-table th { background: #ffedd5; color: #000; font-size: 9px; padding: 5px 3px; font-weight: 700; border: 1px solid #000; text-align: center; }
          .data-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: top; }
          .summary-row { display: flex; border: 1px solid #000; border-top: none; }
          .terbilang-area { flex: 1; padding: 8px 10px; border-right: 1px solid #000; }
          .terbilang-title { font-size: 9px; color: #333; margin-bottom: 3px; font-weight: 600; }
          .terbilang-text { font-size: 10px; color: #000; font-weight: 700; text-transform: uppercase; line-height: 1.4; }
          .calc-area { width: 250px; padding: 0; }
          .calc-line { display: flex; justify-content: space-between; padding: 3px 10px; border-bottom: 1px solid #ddd; font-size: 9px; }
          .calc-line:last-child { border-bottom: none; background: #f0fdf4; border-top: 1px solid #16a34a; padding: 5px 10px; }
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
          .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
          @media print { .print-bar { display: none !important; } }
          .pengangkutan-info { background: #f0fdf4; border: 1px solid #16a34a; padding: 8px 10px; margin-bottom: 10px; font-size: 9px; }
          .pengangkutan-info p { margin-bottom: 2px; }
        </style>
      </head>
      <body>
        <div class="print-bar no-print">
          <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
        </div>
        <div class="page">
          <img src="/LogoAGRO.png" alt="Watermark" class="watermark" onerror="this.style.display='none'" />
          <div class="content-layer">
            <img src="/logo.png" alt="Header" class="header-img" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '<div style=\'text-align:center;padding:10px;border:1px solid #ccc;margin-bottom:10px;\'>Logo tidak tersedia</div>');" />
            <div class="invoice-title"><h1>PROFORMA INVOICE</h1></div>
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
                </div>
              </div>
            </div>
            <div class="pengangkutan-info">
              <p><strong>Info Pengangkutan:</strong></p>
              <p>Total Dipesan: ${totalOrdered.toLocaleString("id-ID")} KG</p>
              <p>Total Dimuat: ${totalLoaded.toLocaleString("id-ID")} KG</p>
              <p>Sisa: ${remaining.toLocaleString("id-ID")} KG</p>
              <p>Status: ${item.statusPengangkutan === "complete" ? "Selesai" : item.statusPengangkutan === "partial" ? "Partial" : "Belum Dimuat"}</p>
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
                <div class="created-info">Dibuat: ${item.createdAt ? item.createdAt.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}</div>
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

  const handlePrintSuratPDF = (surat: SuratPengangkutan) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = (surat.items || [])
      .map(
        (item, idx) => `
      <tr>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.nomorSubDO || "-"}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.nomorPO || "-"}</td>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${item.jenisPupuk || ""}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.party || "-"}</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.pengambilanMT || "-"} MT</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.pengambilanZAK || "-"} ZAK</td>
        <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${item.sisa || "-"}</td>
      </tr>
    `
      )
      .join("");

    const sopirHtml = (surat.sopirNopolList || [])
      .map(
        (s, idx) => `
      <tr>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${idx + 1}</td>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">${s.namaSopir || ""}</td>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${s.nopol || ""}</td>
        <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000;">${s.nomorSIM || "-"}</td>
      </tr>
    `
      )
      .join("");

    const piListHtml = surat.nomorPIList && surat.nomorPIList.length > 0
      ? surat.nomorPIList.map((pi) => `<span style="display: inline-block; background: #dcfce7; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 10px;">${pi}</span>`).join("")
      : "-";

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
              <span>Lamandau, ${new Date(surat.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Nomor Seri : ${surat.nomorSeri}</span>
            </div>
          </div>
          <div class="recipient-box">
            <p class="recipient-title">Kepada Yth :</p>
            <p class="recipient-name">Bapak Kepala Gudang Induk</p>
            <p class="recipient-name">PT Bukit Agrochemical Baru</p>
            <p class="recipient-address">Desa Sungai Rangit<br>Pangkalan Lada, Kalimantan Tengah</p>
          </div>
          <div class="salutation">
            <p>Dengan Hormat,</p>
            <p>Dengan ini mohon dimuatkan pupuk dengan rincian sebagai berikut :</p>
          </div>
          ${surat.jenisSurat === "gudangInduk" ? `
          <div style="margin-bottom: 8px; font-size: 10px;">
            <span style="font-weight: 600;">Nomor Proforma Invoice : </span>${piListHtml}
          </div>
          ` : ""}
          <div class="table-section">
            <div class="table-title">DASAR PENGANGKUTAN</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 30px;">NO</th>
                  <th style="width: 100px;">NOMOR SUB DO</th>
                  <th style="width: 100px;">NOMOR PO</th>
                  <th>JENIS PUPUK</th>
                  <th style="width: 60px;">PARTY</th>
                  <th style="width: 80px;">PENGAMBILAN<br>MT</th>
                  <th style="width: 80px;">PENGAMBILAN<br>ZAK</th>
                  <th style="width: 60px;">SISA</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
          </div>
          <div class="table-section">
            <div class="table-title">DATA UNIT ANGKUTAN</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 40px;">NO</th>
                  <th>NAMA SOPIR</th>
                  <th style="width: 120px;">NO. POLISI</th>
                  <th style="width: 120px;">NOMOR SIM</th>
                </tr>
              </thead>
              <tbody>${sopirHtml}</tbody>
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
              <img src="/Picture2.png" alt="TTD" class="signature-img" onerror="this.style.display='none'" />
              <p class="signature-name">HENDRA PRAMASYANTO</p>
            </div>
            <div class="signature-box">
              <p class="signature-title">Diangkut oleh,<br>Driver</p>
              <div style="height: 50px;"></div>
              <p class="signature-name">${surat.sopirNopolList && surat.sopirNopolList[0] ? surat.sopirNopolList[0].namaSopir : ""}</p>
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
      key: "jumlahTertagih",
      header: "Jumlah",
      width: "160px",
      render: (row: ProformaInvoice) => <span className="font-mono font-medium text-gray-900">{formatRupiah(row.jumlahTertagih)}</span>,
    },
    {
      key: "pengangkutan",
      header: "Pengangkutan",
      width: "140px",
      render: (row: ProformaInvoice) => {
        const totalOrdered = row.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
        const totalLoaded = getTotalLoadedForPI(row.nomorPI);
        const remaining = totalOrdered - totalLoaded;
        const surats = getSuratForPI(row.nomorPI);
        return (
          <div className="text-xs">
            <span className={`px-2 py-1 rounded-md font-medium ${
              remaining <= 0 ? "bg-green-100 text-green-800" :
              totalLoaded > 0 ? "bg-amber-100 text-amber-800" :
              "bg-gray-100 text-gray-600"
            }`}>
              {remaining <= 0 ? "Selesai" : totalLoaded > 0 ? "Partial" : "Belum"}
            </span>
            {surats.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">{surats.length} surat</p>
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
      width: "220px",
      render: (row: ProformaInvoice) => (
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleDetail(row); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Detail">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleViewSurat(row); }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Lihat Surat Pengangkutan">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handlePrintPDF(row); }} className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Print PDF">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Header title="Rekap Proforma Invoice" subtitle="Kelola dan lihat riwayat proforma invoice" />

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Cari nomor PI, customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
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

        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredData.length} dari {data.length} data
        </div>

        <Table columns={columns} data={filteredData} isLoading={isLoading} emptyMessage="Belum ada data proforma invoice" keyExtractor={(row) => row.id} onRowClick={handleDetail} />
      </Card>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detail Proforma Invoice" size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
          <Button variant="primary" onClick={() => selectedItem && handlePrintPDF(selectedItem)}>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print PDF
          </Button>
        </div>
      }>
        {selectedItem && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Nomor PI</p>
                <p className="text-lg font-bold text-green-700">{selectedItem.nomorPI}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Tanggal</p>
                <p className="text-lg font-bold text-gray-800">{selectedItem.tanggal}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p>
                <p className="font-semibold text-gray-800">{selectedItem.namaCustomer}</p>
                <p className="text-sm text-gray-600 mt-1">{selectedItem.alamatCustomer}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Metode Pembayaran</p>
                <p className="font-semibold text-gray-800">{selectedItem.metodePembayaran}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-3">Jatuh Tempo</p>
                <p className="font-semibold text-red-600">{selectedItem.tanggalJatuhTempo}</p>
              </div>
            </div>

            {selectedSuratList.length > 0 && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-xs text-green-600 uppercase tracking-wide font-semibold mb-3">Surat Pengangkutan Terkait</p>
                <div className="space-y-2">
                  {selectedSuratList.map((surat) => (
                    <div key={surat.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-green-100">
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{surat.nomorSeri}</p>
                        <p className="text-xs text-gray-500">{surat.tanggal} - {surat.totalPengambilanKG?.toLocaleString()} KG</p>
                      </div>
                      <button
                        onClick={() => handlePrintSuratPDF(surat)}
                        className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Print Surat"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
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
                <p className="text-xs text-gray-500 uppercase tracking-wide mt-3 mb-1">Total Kuantitas</p>
                <p className="text-sm font-semibold text-gray-800">{(selectedItem.produkItems || []).reduce((sum, p) => sum + (p.kuantitas || 0), 0).toLocaleString("id-ID")} kg</p>
              </div>
              <div className="p-4 bg-green-50 rounded-xl border border-green-100">
                <div className="flex justify-between py-1">
                  <span className="text-sm text-gray-600">Subtotal</span>
                  <span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.subtotal)}</span>
                </div>
                {selectedItem.includePPN && (
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-gray-600">PPN 11%</span>
                    <span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ppnNominal)}</span>
                  </div>
                )}
                {(selectedItem.uangMuka || 0) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-gray-600">Uang Muka</span>
                    <span className="text-sm font-mono font-medium text-red-600">- {formatRupiah(selectedItem.uangMuka)}</span>
                  </div>
                )}
                {(selectedItem.ongkosKirim || 0) > 0 && (
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-gray-600">Ongkos Kirim</span>
                    <span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ongkosKirim)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-t border-green-200 mt-2">
                  <span className="text-base font-bold text-green-800">Jumlah Tertagih</span>
                  <span className="text-lg font-mono font-bold text-green-700">{formatRupiah(selectedItem.jumlahTertagih)}</span>
                </div>
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

      <Modal isOpen={isSuratModalOpen} onClose={() => setIsSuratModalOpen(false)} title={`Surat Pengangkutan - ${selectedItem?.nomorPI}`} size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsSuratModalOpen(false)}>Tutup</Button>
        </div>
      }>
        {selectedItem && selectedSuratList.length > 0 ? (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Nomor PI</p>
              <p className="text-lg font-bold text-blue-700">{selectedItem.nomorPI}</p>
              <p className="text-sm text-blue-600 mt-1">{selectedItem.namaCustomer}</p>
            </div>
            <div className="space-y-3">
              {selectedSuratList.map((surat) => (
                <div key={surat.id} className="p-4 border border-gray-200 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">{surat.nomorSeri}</p>
                      <p className="text-xs text-gray-500">{surat.tanggal}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                      surat.jenisSurat === "gudangInduk" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {surat.jenisSurat === "gudangInduk" ? "Gudang Induk" : "DO"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <p><span className="text-gray-500">Total Dimuat:</span> <span className="font-medium">{surat.totalPengambilanKG?.toLocaleString()} KG</span></p>
                    <p><span className="text-gray-500">Jumlah Item:</span> <span className="font-medium">{surat.items?.length || 0}</span></p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => handlePrintSuratPDF(surat)}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print PDF
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">Belum ada surat pengangkutan untuk Proforma Invoice ini</p>
          </div>
        )}
      </Modal>
    </div>
  );
}