"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  where,
} from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

interface ProformaInvoice {
  id: string;
  nomorPI: string;
  namaCustomer: string;
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
  pengambilanMT: string;
  pengambilanZAK: string;
  sisa: string;
}

interface SopirItem {
  id: number;
  namaSopir: string;
  nopol: string;
  nomorSIM: string;
}

interface LoadedPI {
  nomorPI: string;
  totalLoaded: number;
  totalOrdered: number;
}

export default function SuratPengangkutanPage() {
  const { user } = useAuth();
  const [piList, setPiList] = useState<ProformaInvoice[]>([]);
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [loadedPIList, setLoadedPIList] = useState<LoadedPI[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [jenisSurat, setJenisSurat] = useState<"gudangInduk" | "do" | "">("");
  const [showJenisModal, setShowJenisModal] = useState(true);
  const [nomorSeri, setNomorSeri] = useState("");

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    namaKabupaten: "Lamandau",
    nomorPIList: [] as string[],
    nomorSubDO: "",
    nomorPO: "",
    jenisPupuk: "",
    party: "",
    pengambilanMT: "",
    pengambilanZAK: "",
    sisa: "",
    nomorPolisi: "",
    driverUnit: "",
    nomorSIM: "",
  });

  const [items, setItems] = useState<SuratPengangkutanItem[]>([
    {
      id: 1,
      nomorSubDO: "",
      nomorPO: "",
      jenisPupuk: "",
      party: "",
      pengambilanMT: "",
      pengambilanZAK: "",
      sisa: "",
    },
  ]);

  const [sopirList, setSopirList] = useState<SopirItem[]>([
    { id: 1, namaSopir: "", nopol: "", nomorSIM: "" },
  ]);

  useEffect(() => {
    fetchProformaInvoice();
    fetchStockGudang();
    fetchLoadedPI();
    generateNomorSeri();
  }, []);

  const generateNomorSeri = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(1000 + Math.random() * 9000);
    setNomorSeri(`BAGB-IV/${year}/${month}/${day}.${random}`);
  };

  const fetchProformaInvoice = async () => {
    try {
      const q = query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        nomorPI: doc.data().nomorPI || "",
        namaCustomer: doc.data().namaCustomer || "",
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
      } as StockItem));
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchLoadedPI = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), where("jenisSurat", "==", "gudangInduk"));
      const snapshot = await getDocs(q);
      const loadedMap: Record<string, number> = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const piArray = data.nomorPIList || [];
        const items = data.items || [];
        piArray.forEach((pi: string) => {
          const totalKG = items.reduce((sum: number, item: any) => {
            const mt = parseFloat(item.pengambilanMT) || 0;
            const zak = parseFloat(item.pengambilanZAK) || 0;
            return sum + mt * 1000 + zak * 50;
          }, 0);
          loadedMap[pi] = (loadedMap[pi] || 0) + totalKG;
        });
      });

      const loadedArray: LoadedPI[] = [];
      piList.forEach((pi) => {
        const totalOrdered = pi.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
        const totalLoaded = loadedMap[pi.nomorPI] || 0;
        loadedArray.push({
          nomorPI: pi.nomorPI,
          totalLoaded: totalLoaded,
          totalOrdered: totalOrdered,
        });
      });
      setLoadedPIList(loadedArray);
    } catch (error) {
      console.error(error);
    }
  };

  const getAvailablePIOptions = () => {
    return piList
      .filter((pi) => {
        const loaded = loadedPIList.find((l) => l.nomorPI === pi.nomorPI);
        if (!loaded) return true;
        return loaded.totalLoaded < loaded.totalOrdered;
      })
      .map((pi) => ({
        value: pi.nomorPI,
        label: `${pi.nomorPI} - ${pi.namaCustomer} (${pi.tanggal})`,
      }));
  };

  const getSelectedPIInfo = () => {
    if (formData.nomorPIList.length === 0) return null;
    const selectedPIs = piList.filter((pi) => formData.nomorPIList.includes(pi.nomorPI));
    const totalOrdered = selectedPIs.reduce((sum, pi) => {
      return sum + pi.produkItems.reduce((s, p) => s + (p.kuantitas || 0), 0);
    }, 0);
    const totalLoaded = loadedPIList
      .filter((l) => formData.nomorPIList.includes(l.nomorPI))
      .reduce((sum, l) => sum + l.totalLoaded, 0);
    return { totalOrdered, totalLoaded, remaining: totalOrdered - totalLoaded };
  };

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
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
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
        pengambilanMT: "",
        pengambilanZAK: "",
        sisa: "",
      },
    ]);
  };

  const removeItem = (id: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleSopirChange = (id: number, field: keyof SopirItem, value: string) => {
    setSopirList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const addSopir = () => {
    const newId = sopirList.length > 0 ? Math.max(...sopirList.map((s) => s.id)) + 1 : 1;
    setSopirList((prev) => [...prev, { id: newId, namaSopir: "", nopol: "", nomorSIM: "" }]);
  };

  const removeSopir = (id: number) => {
    if (sopirList.length <= 1) return;
    setSopirList((prev) => prev.filter((item) => item.id !== id));
  };

  const handlePILinkChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions).map((o) => o.value);
    setFormData((prev) => ({ ...prev, nomorPIList: selectedOptions }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.namaKabupaten.trim()) newErrors.namaKabupaten = "Nama kabupaten wajib diisi";
    if (!formData.driverUnit.trim()) newErrors.driverUnit = "Driver unit wajib diisi";
    if (!formData.nomorPolisi.trim()) newErrors.nomorPolisi = "Nomor polisi wajib diisi";

    if (jenisSurat === "gudangInduk") {
      if (formData.nomorPIList.length === 0) newErrors.nomorPI = "Nomor PI wajib dipilih";
    }

    if (jenisSurat === "do") {
      if (!formData.nomorSubDO.trim()) newErrors.nomorSubDO = "Nomor Sub DO wajib diisi";
      if (!formData.nomorPO.trim()) newErrors.nomorPO = "Nomor PO wajib diisi";
      if (!formData.party.trim()) newErrors.party = "Party wajib diisi";
    }

    items.forEach((item, idx) => {
      if (!item.jenisPupuk.trim()) newErrors[`jenisPupuk_${idx}`] = "Jenis pupuk wajib diisi";
      if (jenisSurat === "do" && !item.party.trim()) {
        newErrors[`party_${idx}`] = "Party wajib diisi";
      }
      if (!item.pengambilanMT.trim() && !item.pengambilanZAK.trim()) {
        newErrors[`pengambilan_${idx}`] = "Pengambilan wajib diisi";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const totalPengambilanKG = items.reduce((sum, item) => {
        const mt = parseFloat(item.pengambilanMT) || 0;
        const zak = parseFloat(item.pengambilanZAK) || 0;
        return sum + mt * 1000 + zak * 50;
      }, 0);

      const suratData: any = {
        jenisSurat,
        tanggal: formData.tanggal,
        namaKabupaten: formData.namaKabupaten,
        nomorSeri,
        items: items.map((item) => ({
          nomorSubDO: item.nomorSubDO,
          nomorPO: item.nomorPO,
          jenisPupuk: item.jenisPupuk,
          party: item.party,
          pengambilanMT: parseFloat(item.pengambilanMT) || 0,
          pengambilanZAK: parseFloat(item.pengambilanZAK) || 0,
          sisa: item.sisa,
        })),
        sopirNopolList: sopirList
          .filter((s) => s.namaSopir.trim() || s.nopol.trim())
          .map((s) => ({
            namaSopir: s.namaSopir.trim(),
            nopol: s.nopol.trim(),
            nomorSIM: s.nomorSIM.trim() || null,
          })),
        nomorPolisi: formData.nomorPolisi.trim(),
        driverUnit: formData.driverUnit.trim(),
        nomorSIM: formData.nomorSIM.trim() || null,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (jenisSurat === "gudangInduk") {
        suratData.nomorPIList = formData.nomorPIList;
        suratData.totalPengambilanKG = totalPengambilanKG;

        const selectedPIs = piList.filter((pi) => formData.nomorPIList.includes(pi.nomorPI));
        selectedPIs.forEach((pi) => {
          const piLoaded = loadedPIList.find((l) => l.nomorPI === pi.nomorPI);
          const totalOrdered = pi.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
          const alreadyLoaded = piLoaded?.totalLoaded || 0;
          const remaining = totalOrdered - alreadyLoaded - totalPengambilanKG;

          if (remaining > 0) {
            const piRef = doc(db, "proformaInvoice", pi.id);
            updateDoc(piRef, {
              sisaPengambilanKG: remaining,
              statusPengangkutan: "partial",
              updatedAt: serverTimestamp(),
            });
          } else {
            const piRef = doc(db, "proformaInvoice", pi.id);
            updateDoc(piRef, {
              sisaPengambilanKG: 0,
              statusPengangkutan: "complete",
              updatedAt: serverTimestamp(),
            });
          }
        });

        stockList.forEach((stock) => {
          const stockRef = doc(db, "stockGudang", stock.id);
          const currentStokUnit = stock.stokAkhirUnit || 0;
          const currentStokKG = stock.stokAkhirKG || 0;
          const minusUnit = Math.ceil(totalPengambilanKG / (stock.bobotPerUnit || 50));
          updateDoc(stockRef, {
            barangKeluarUnit: (stock.barangKeluarUnit || 0) + minusUnit,
            barangKeluarKG: (stock.barangKeluarKG || 0) + totalPengambilanKG,
            stokAkhirUnit: currentStokUnit - minusUnit,
            stokAkhirKG: currentStokKG - totalPengambilanKG,
            updatedAt: serverTimestamp(),
          });
        });
      }

      await addDoc(collection(db, "suratPengangkutan"), suratData);

      const transaksiData = {
        tanggal: formData.tanggal,
        jenis: jenisSurat === "gudangInduk" ? "suratPengangkutanGudangInduk" : "suratPengangkutanDO",
        nomorSeri,
        items: suratData.items,
        sopirNopolList: suratData.sopirNopolList,
        nomorPolisi: formData.nomorPolisi,
        driverUnit: formData.driverUnit,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "transaksiBarangKeluar"), transaksiData);

      setSuccessMessage("Surat pengangkutan berhasil dibuat!");
      resetForm();
      generateNomorSeri();
      fetchLoadedPI();
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
      nomorPIList: [],
      nomorSubDO: "",
      nomorPO: "",
      jenisPupuk: "",
      party: "",
      pengambilanMT: "",
      pengambilanZAK: "",
      sisa: "",
      nomorPolisi: "",
      driverUnit: "",
      nomorSIM: "",
    });
    setItems([
      {
        id: 1,
        nomorSubDO: "",
        nomorPO: "",
        jenisPupuk: "",
        party: "",
        pengambilanMT: "",
        pengambilanZAK: "",
        sisa: "",
      },
    ]);
    setSopirList([{ id: 1, namaSopir: "", nopol: "", nomorSIM: "" }]);
    setErrors({});
  };

  const handlePrintPDF = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const piInfo = getSelectedPIInfo();
    const itemsHtml = items
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

    const sopirHtml = sopirList
      .filter((s) => s.namaSopir.trim() || s.nopol.trim())
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

    const piListHtml =
      jenisSurat === "gudangInduk" && formData.nomorPIList.length > 0
        ? formData.nomorPIList.map((pi) => `<span style="display: inline-block; background: #dcfce7; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 10px;">${pi}</span>`).join("")
        : "-";

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
          ${jenisSurat === "gudangInduk" ? `
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
              <tbody>
                ${itemsHtml}
              </tbody>
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
              <tbody>
                ${sopirHtml}
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;" colspan="2">NO. POLISI : ${formData.nomorPolisi}</td>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;" colspan="2">DRIVER UNIT : ${formData.driverUnit}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;" colspan="4">NOMOR SIM : ${formData.nomorSIM || "-"}</td>
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
              <img src="/Picture2.png" alt="TTD" class="signature-img" onerror="this.style.display='none'" />
              <p class="signature-name">HENDRA PRAMASYANTO</p>
            </div>
            <div class="signature-box">
              <p class="signature-title">Diangkut oleh,<br>Driver</p>
              <div style="height: 50px;"></div>
              <p class="signature-name">${formData.driverUnit}</p>
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
              onClick={() => { setJenisSurat("gudangInduk"); setShowJenisModal(false); }}
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
              onClick={() => { setJenisSurat("do"); setShowJenisModal(false); }}
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
                  <p className="text-sm text-gray-500">Untuk pengiriman langsung tanpa referensi Proforma Invoice</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const piOptions = getAvailablePIOptions();
  const selectedPIInfo = getSelectedPIInfo();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <Header
          title={`Surat Pengangkutan - ${jenisSurat === "gudangInduk" ? "Gudang Induk" : "DO"}`}
          subtitle="Buat surat pengangkutan untuk pemuatan barang"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setShowJenisModal(true); setJenisSurat(""); resetForm(); }}
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
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Seri</label>
              <div className="px-4 py-3 bg-gray-100 rounded-xl font-mono text-sm text-gray-700 border border-gray-200">
                {nomorSeri}
              </div>
            </div>
          </div>
        </Card>

        {jenisSurat === "gudangInduk" && (
          <Card title="Proforma Invoice">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pilih Nomor Proforma Invoice (bisa lebih dari satu)
                </label>
                <select
                  multiple
                  value={formData.nomorPIList}
                  onChange={handlePILinkChange}
                  className="w-full h-40 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                >
                  {piOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-2">Tahan Ctrl/Cmd untuk memilih multiple PI</p>
                {errors.nomorPI && <p className="mt-1 text-sm text-red-600">{errors.nomorPI}</p>}
              </div>

              {selectedPIInfo && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total Dipesan</p>
                    <p className="text-xl font-bold text-blue-700 font-mono">{selectedPIInfo.totalOrdered.toLocaleString()} KG</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                    <p className="text-xs text-amber-600 uppercase tracking-wide font-semibold">Sudah Dimuat</p>
                    <p className="text-xl font-bold text-amber-700 font-mono">{selectedPIInfo.totalLoaded.toLocaleString()} KG</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                    <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Sisa</p>
                    <p className="text-xl font-bold text-green-700 font-mono">{selectedPIInfo.remaining.toLocaleString()} KG</p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <Card title="Dasar Pengangkutan">
          <div className="space-y-4">
            {items.map((item, idx) => (
              <div key={item.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Item {idx + 1}</h4>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Nomor SUB DO"
                    type="text"
                    value={item.nomorSubDO}
                    onChange={(e) => handleItemChange(item.id, "nomorSubDO", e.target.value)}
                    placeholder={jenisSurat === "do" ? "Wajib" : "Opsional"}
                    error={errors[`nomorSubDO_${idx}`]}
                    required={jenisSurat === "do"}
                  />
                  <Input
                    label="Nomor PO"
                    type="text"
                    value={item.nomorPO}
                    onChange={(e) => handleItemChange(item.id, "nomorPO", e.target.value)}
                    placeholder={jenisSurat === "do" ? "Wajib" : "Opsional"}
                    error={errors[`nomorPO_${idx}`]}
                    required={jenisSurat === "do"}
                  />
                  <Input
                    label="Jenis Pupuk"
                    type="text"
                    value={item.jenisPupuk}
                    onChange={(e) => handleItemChange(item.id, "jenisPupuk", e.target.value)}
                    placeholder="Contoh: MAHKOTA NPK"
                    error={errors[`jenisPupuk_${idx}`]}
                    required
                  />
                  <Input
                    label="Party"
                    type="text"
                    value={item.party}
                    onChange={(e) => handleItemChange(item.id, "party", e.target.value)}
                    placeholder={jenisSurat === "do" ? "Wajib" : "Opsional"}
                    error={errors[`party_${idx}`]}
                    required={jenisSurat === "do"}
                  />
                  <Input
                    label="Pengambilan (MT)"
                    type="number"
                    value={item.pengambilanMT}
                    onChange={(e) => handleItemChange(item.id, "pengambilanMT", e.target.value)}
                    placeholder="Contoh: 16.6"
                    />
                  <Input
                    label="Pengambilan (ZAK)"
                    type="number"
                    value={item.pengambilanZAK}
                    onChange={(e) => handleItemChange(item.id, "pengambilanZAK", e.target.value)}
                    placeholder="Contoh: 5"
                  />
                  <Input
                    label="Sisa"
                    type="text"
                    value={item.sisa}
                    onChange={(e) => handleItemChange(item.id, "sisa", e.target.value)}
                    placeholder="Opsional"
                    className="md:col-span-3"
                  />
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

        <Card title="Data Unit Angkutan">
          <div className="space-y-4">
            {sopirList.map((sopir, idx) => (
              <div key={sopir.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">
                    {idx === 0 ? "Sopir Utama" : `Sopir ${idx + 1}`}
                  </h4>
                  {sopirList.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSopir(sopir.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Nama Sopir"
                    type="text"
                    value={sopir.namaSopir}
                    onChange={(e) => handleSopirChange(sopir.id, "namaSopir", e.target.value)}
                    placeholder="Contoh: FUAD"
                  />
                  <Input
                    label="Nomor Polisi"
                    type="text"
                    value={sopir.nopol}
                    onChange={(e) => handleSopirChange(sopir.id, "nopol", e.target.value)}
                    placeholder="Contoh: S 9701 JH"
                  />
                  <Input
                    label="Nomor SIM"
                    type="text"
                    value={sopir.nomorSIM}
                    onChange={(e) => handleSopirChange(sopir.id, "nomorSIM", e.target.value)}
                    placeholder="Opsional"
                  />
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSopir}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Sopir
            </Button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <Input
                label="Nomor Polisi Kendaraan"
                type="text"
                name="nomorPolisi"
                value={formData.nomorPolisi}
                onChange={handleChange}
                placeholder="Contoh: S 9701 JH"
                error={errors.nomorPolisi}
                required
              />
              <Input
                label="Driver Unit"
                type="text"
                name="driverUnit"
                value={formData.driverUnit}
                onChange={handleChange}
                placeholder="Contoh: FUAD"
                error={errors.driverUnit}
                required
              />
              <Input
                label="Nomor SIM (Opsional)"
                type="text"
                name="nomorSIM"
                value={formData.nomorSIM}
                onChange={handleChange}
                placeholder="Contoh: 1234567890"
                className="md:col-span-2"
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-4 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              resetForm();
              generateNomorSeri();
            }}
          >
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