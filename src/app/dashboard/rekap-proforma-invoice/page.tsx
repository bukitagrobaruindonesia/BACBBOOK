"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  where,
  serverTimestamp,
  getDoc,
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
  totalHarga: number;
}

interface SuratMuatItem {
  nomorSubDO?: string;
  nomorPO?: string;
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
  nomorPI: string;
  nomorSIM?: string;
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
}

export default function RekapProformaInvoicePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<ProformaInvoice[]>([]);
  const [suratMuatMap, setSuratMuatMap] = useState<Record<string, SuratMuatInfo[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<ProformaInvoice | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditSuratModalOpen, setIsEditSuratModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSurat, setSelectedSurat] = useState<SuratMuatInfo | null>(null);
  const [stockList, setStockList] = useState<StockItem[]>([]);

  const [editForm, setEditForm] = useState({
    sisaPengambilanKG: "",
    statusPengangkutan: "pending",
  });

  const [editSuratForm, setEditSuratForm] = useState({
    tanggal: "",
    nomorSeri: "",
    nomorPolisi: "",
    driverUnit: "",
    nomorSIM: "",
    items: [] as EditSuratItem[],
  });

  useEffect(() => {
    fetchData();
    fetchSuratMuat();
    fetchStockGudang();
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

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        namaBarang: doc.data().namaBarang || "",
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

  const fetchSuratMuat = async () => {
    try {
      const q = query(collection(db, "suratPengangkutan"), where("jenisSurat", "==", "gudangInduk"));
      const snapshot = await getDocs(q);
      const map: Record<string, SuratMuatInfo[]> = {};
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        const piList: string[] = d.nomorPIList || [d.nomorPI] || [];
        const info: SuratMuatInfo = {
          id: docSnap.id,
          nomorSeri: d.nomorSeri || "",
          tanggal: d.tanggal || "",
          items: d.items || [],
          totalKG: d.totalPengambilanKG || 0,
          nomorPolisi: d.nomorPolisi || "",
          driverUnit: d.driverUnit || "",
          nomorPI: d.nomorPI || "",
          nomorSIM: d.nomorSIM || "",
        };
        piList.forEach((pi) => {
          if (!map[pi]) map[pi] = [];
          map[pi].push(info);
        });
      });
      setSuratMuatMap(map);
    } catch (error) {
      console.error(error);
    }
  };

  const getStockForProduct = (namaProduk: string) => {
    return stockList.find((s: StockItem) =>
      s.namaBarang.toUpperCase().includes(namaProduk.toUpperCase()) ||
      namaProduk.toUpperCase().includes(s.namaBarang.toUpperCase())
    );
  };

  const getSuratMuatForPI = (nomorPI: string) => {
    return suratMuatMap[nomorPI] || [];
  };

  const getTotalOrdered = (item: ProformaInvoice) => {
    return item.produkItems.reduce((sum: number, p: ProdukItem) => sum + (p.kuantitas || 0), 0);
  };

  const getTotalLoaded = (nomorPI: string) => {
    const suratList = getSuratMuatForPI(nomorPI);
    return suratList.reduce((sum: number, s: SuratMuatInfo) => sum + (s.totalKG || 0), 0);
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

  const getProdukLoadStatus = (item: ProformaInvoice) => {
    const suratList = getSuratMuatForPI(item.nomorPI);
    return item.produkItems.map((prod: ProdukItem) => {
      const ordered = prod.kuantitas || 0;
      let loaded = 0;
      suratList.forEach((surat: SuratMuatInfo) => {
        (surat.items || []).forEach((it: SuratMuatItem) => {
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

  const filteredData = data.filter((item: ProformaInvoice) =>
    item.nomorPI?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.namaCustomer?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatRupiah = (num: number) => {
    if (!num && num !== 0) return "Rp -";
    return "Rp " + num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const handleDetail = (item: ProformaInvoice) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleEdit = (item: ProformaInvoice) => {
    setSelectedItem(item);
    setEditForm({
      sisaPengambilanKG: item.sisaPengambilanKG !== undefined ? String(item.sisaPengambilanKG) : "",
      statusPengangkutan: item.statusPengangkutan || "pending",
    });
    setIsEditModalOpen(true);
  };

  const handleEditSurat = (surat: SuratMuatInfo) => {
    setSelectedSurat(surat);
    setEditSuratForm({
      tanggal: surat.tanggal,
      nomorSeri: surat.nomorSeri,
      nomorPolisi: surat.nomorPolisi,
      driverUnit: surat.driverUnit,
      nomorSIM: surat.nomorSIM || "",
      items: (surat.items || []).map((it: SuratMuatItem) => {
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
        };
      }),
    });
    setIsEditSuratModalOpen(true);
  };

  const handleUpdateStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "proformaInvoice", selectedItem.id), {
        sisaPengambilanKG: parseFloat(editForm.sisaPengambilanKG) || 0,
        statusPengangkutan: editForm.statusPengangkutan,
        updatedAt: serverTimestamp(),
      });
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSurat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurat || !selectedItem) return;
    setIsSubmitting(true);
    try {
      const oldItems = selectedSurat.items || [];
      const newItems = editSuratForm.items.map((it: EditSuratItem) => ({
        nomorSubDO: it.nomorSubDO,
        nomorPO: it.nomorPO,
        jenisPupuk: it.jenisPupuk,
        party: it.party,
        pengambilanZAK: parseFloat(it.pengambilanZAK) || 0,
        bobotPerUnit: it.bobotPerUnit,
        totalKG: (parseFloat(it.pengambilanZAK) || 0) * it.bobotPerUnit,
        sisa: it.sisa,
        fot: "",
      }));
      const totalPengambilanKG = newItems.reduce((sum: number, it: any) => sum + it.totalKG, 0);
      const updateData: any = {
        tanggal: editSuratForm.tanggal,
        nomorSeri: editSuratForm.nomorSeri.trim(),
        nomorPolisi: editSuratForm.nomorPolisi.trim(),
        driverUnit: editSuratForm.driverUnit.trim(),
        nomorSIM: editSuratForm.nomorSIM.trim() || null,
        items: newItems,
        totalPengambilanKG: totalPengambilanKG,
        updatedAt: serverTimestamp(),
      };
      await updateDoc(doc(db, "suratPengangkutan", selectedSurat.id), updateData);
      const transaksiQuery = query(collection(db, "transaksiBarangKeluar"), where("nomorSeri", "==", selectedSurat.nomorSeri));
      const transaksiSnapshot = await getDocs(transaksiQuery);
      if (!transaksiSnapshot.empty) {
        await updateDoc(doc(db, "transaksiBarangKeluar", transaksiSnapshot.docs[0].id), updateData);
      }

      const oldTotalKG = oldItems.reduce((sum: number, it: SuratMuatItem) => sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50)), 0);
      const delta = oldTotalKG - totalPengambilanKG;
      const piRef = doc(db, "proformaInvoice", selectedItem.id);
      const piSnap = await getDoc(piRef);
      if (piSnap.exists()) {
        const piData = piSnap.data();
        const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
        const newSisa = Math.max(0, currentSisa + delta);
        const totalOrdered = selectedItem.produkItems.reduce((sum: number, p: ProdukItem) => sum + (p.kuantitas || 0), 0);
        let newStatus = "pending";
        if (newSisa <= 0) newStatus = "complete";
        else if (newSisa < totalOrdered) newStatus = "partial";
        await updateDoc(piRef, {
          sisaPengambilanKG: newSisa,
          statusPengangkutan: newStatus,
          updatedAt: serverTimestamp(),
        });
      }

      const productMapOld: Record<string, number> = {};
      const productMapNew: Record<string, number> = {};
      oldItems.forEach((it: SuratMuatItem) => {
        const key = it.jenisPupuk;
        productMapOld[key] = (productMapOld[key] || 0) + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50));
      });
      newItems.forEach((it: any) => {
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
      setIsEditSuratModalOpen(false);
      fetchData();
      fetchSuratMuat();
      fetchStockGudang();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSurat = async (surat: SuratMuatInfo) => {
    if (!confirm(`Apakah Anda yakin ingin menghapus surat pengangkutan ${surat.nomorSeri}?`)) return;
    try {
      const totalKG = (surat.items || []).reduce((sum: number, it: SuratMuatItem) => sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50)), 0);
      const piRef = doc(db, "proformaInvoice", selectedItem!.id);
      const piSnap = await getDoc(piRef);
      if (piSnap.exists()) {
        const piData = piSnap.data();
        const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
        const newSisa = currentSisa + totalKG;
        const totalOrdered = selectedItem!.produkItems.reduce((sum: number, p: ProdukItem) => sum + (p.kuantitas || 0), 0);
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
      const transaksiQuery = query(collection(db, "transaksiBarangKeluar"), where("nomorSeri", "==", surat.nomorSeri));
      const transaksiSnapshot = await getDocs(transaksiQuery);
      if (!transaksiSnapshot.empty) {
        await deleteDoc(doc(db, "transaksiBarangKeluar", transaksiSnapshot.docs[0].id));
      }
      await deleteDoc(doc(db, "suratPengangkutan", surat.id));
      fetchData();
      fetchSuratMuat();
      fetchStockGudang();
    } catch (error) {
      console.error(error);
    }
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
    const exportData = filteredData.map((item: ProformaInvoice) => ({
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
      "Keterangan": item.keterangan,
      "Status Pengangkutan": getStatusPengangkutan(item),
      "Sisa (KG)": item.sisaPengambilanKG || 0,
      "Dibuat Oleh": item.createdBy,
    }));
    exportToExcel(exportData, `Rekap_Proforma_Invoice_${new Date().toISOString().split("T")[0]}`, "Rekap PI");
  };

  const handlePrintPDF = (item: ProformaInvoice) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const produkRows = (item.produkItems || []).map((p: ProdukItem, idx: number) => `
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
    const emptyRows = Array.from({ length: emptyRowsCount }, (_, i: number) => `
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
          <img src="/LogoAGRO.png" alt="Watermark" class="watermark" onerror="this.style.display='none'" />
          <div class="content-layer">
            <img src="/logo.png" alt="Header" class="header-img" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('afterbegin', '<div style=text-align:center;padding:10px;border:1px solid #ccc;margin-bottom:10px;>Logo tidak tersedia</div>');" />
            <div class="invoice-title">
              <h1>PROFORMA INVOICE</h1>
            </div>
            <div class="info-section">
              <p class="kepada-label">Kepada Yth,</p>
              <div class="info-row">
                <div class="customer-box">
                  <p class="customer-name">${item.namaCustomer || ""}</p>
                  <p class="customer-address">${(item.alamatCustomer || "").split("\n").join("<br>")}</p>
                </div>
                <div class="invoice-meta">
                  <div class="meta-row">
                    <span class="meta-label">Tanggal</span>
                    <span class="meta-colon">:</span>
                    <span class="meta-value">${item.tanggal || ""}</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-label">No Invoice</span>
                    <span class="meta-colon">:</span>
                    <span class="meta-value">${item.nomorPI || ""}</span>
                  </div>
                  <div class="meta-row">
                    <span class="meta-label">Metode Pembayaran</span>
                    <span class="meta-colon">:</span>
                    <span class="meta-value">${item.metodePembayaran || ""}</span>
                  </div>
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
              <tbody>
                ${produkRows}
                ${emptyRows}
              </tbody>
            </table>
            <div class="summary-row">
              <div class="terbilang-area">
                <div class="terbilang-title">Terbilang :</div>
                <div class="terbilang-text">${item.terbilang || "-"}</div>
              </div>
              <div class="calc-area">
                <div class="calc-line">
                  <span class="calc-name">Subtotal</span>
                  <span class="calc-amount">${formatRupiah(item.subtotal)}</span>
                </div>
                ${(item.uangMuka || 0) > 0 ? `
                <div class="calc-line">
                  <span class="calc-name">Uang Muka</span>
                  <span class="calc-amount">${formatRupiah(item.uangMuka)}</span>
                </div>
                ` : ""}
                ${item.includePPN ? `
                <div class="calc-line">
                  <span class="calc-name">PPN 11%</span>
                  <span class="calc-amount">${formatRupiah(item.ppnNominal)}</span>
                </div>
                ` : ""}
                ${(item.ongkosKirim || 0) > 0 ? `
                <div class="calc-line">
                  <span class="calc-name">Ongkos Kirim</span>
                  <span class="calc-amount">${formatRupiah(item.ongkosKirim)}</span>
                </div>
                ` : ""}
                <div class="calc-line">
                  <span class="calc-name-bold">Jumlah Tertagih</span>
                  <span class="calc-amount-bold">${formatRupiah(item.jumlahTertagih)}</span>
                </div>
                <div class="due-date">
                  <span class="due-label">Tanggal Jatuh Tempo : </span>
                  <span class="due-value">${item.tanggalJatuhTempo || ""}</span>
                </div>
                <div class="created-info">
                  Dibuat: ${createdAtStr}
                </div>
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
    const itemsHtml = (surat.items || [])
      .map(
        (it: SuratMuatItem, idx: number) => `
        <tr>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorSubDO || "-"}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorPO || "-"}</td>
          <td style="padding: 6px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.jenisPupuk || ""}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.party || "-"}</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.pengambilanZAK || "-"} ZAK</td>
          <td style="text-align: center; padding: 6px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.sisa || "-"}</td>
        </tr>
      `
      )
      .join("");
    const piBadge = selectedItem
      ? `<span style="display: inline-block; background: #dcfce7; padding: 2px 8px; border-radius: 4px; margin-right: 4px; font-size: 10px; font-weight: 600;">${selectedItem.nomorPI}</span>`
      : '<span style="font-size: 10px; color: #666;">-</span>';
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
          <div style="margin-bottom: 8px; font-size: 10px;">
            <span style="font-weight: 600;">Nomor Proforma Invoice : </span>${piBadge}
          </div>
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
              <img src="/Picture2.png" alt="TTD" class="signature-img" onerror="this.style.display='none'" />
              <p class="signature-name">HENDRA PRAMASYANTO</p>
            </div>
            <div class="signature-box">
              <p class="signature-title">Diangkut oleh,<br>Driver</p>
              <div style="height: 50px;"></div>
              <p class="signature-name">${surat.driverUnit || ""}</p>
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
      key: "statusPengangkutan",
      header: "Status Muat",
      width: "320px",
      render: (row: ProformaInvoice) => {
        const produkStatus = getProdukLoadStatus(row);
        const isComplete = produkStatus.every((p: any) => p.status === "complete");
        const isPartial = produkStatus.some((p: any) => p.status === "partial" || p.status === "complete");
        const badge = isComplete
          ? { class: "bg-green-100 text-green-700", label: "Selesai Dimuat" }
          : isPartial
          ? { class: "bg-yellow-100 text-yellow-700", label: "Sebagian Dimuat" }
          : { class: "bg-gray-100 text-gray-600", label: "Belum Dimuat" };
        return (
          <div className="flex flex-col gap-2">
            <span className={`px-2 py-1 rounded-md text-xs font-bold ${badge.class}`}>
              {badge.label}
            </span>
            <div className="space-y-1">
              {produkStatus.map((p: any, i: number) => (
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
              <button
                onClick={(e) => { e.stopPropagation(); router.push("/dashboard/surat-pengangkutan"); }}
                className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-semibold transition-colors flex items-center gap-1"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
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
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button onClick={(e) => { e.stopPropagation(); handleEdit(row); }} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Status">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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

  const handleSuratItemChange = (idx: number, field: string, value: string) => {
    setEditSuratForm((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[idx], [field]: value };
      if (field === "pengambilanZAK") {
        const zak = parseFloat(value) || 0;
        const maxZAK = item.maxZAK || 0;
        if (maxZAK > 0) {
          if (zak >= maxZAK) {
            item.pengambilanZAK = String(maxZAK);
            item.sisa = "0";
          } else {
            item.sisa = String(Math.max(0, maxZAK - zak));
          }
        }
      }
      newItems[idx] = item;
      return { ...prev, items: newItems };
    });
  };

  const addSuratItem = () => {
    setEditSuratForm((prev) => ({
      ...prev,
      items: [...prev.items, { nomorSubDO: "", nomorPO: "", jenisPupuk: "", party: "", pengambilanZAK: "", bobotPerUnit: 50, sisa: "", maxZAK: 0 }],
    }));
  };

  const removeSuratItem = (idx: number) => {
    setEditSuratForm((prev) => ({
      ...prev,
      items: prev.items.filter((_: EditSuratItem, i: number) => i !== idx),
    }));
  };

  return (
    <div className="space-y-6">
      <Header title="Rekap Proforma Invoice" subtitle="Kelola dan lihat riwayat proforma invoice beserta status pengangkutan" />

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

        <Table columns={columns} data={filteredData} isLoading={isLoading} emptyMessage="Belum ada data proforma invoice" keyExtractor={(row: ProformaInvoice) => row.id} onRowClick={handleDetail} />
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
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Status Pengangkutan</p>
                {(() => {
                  const status = getStatusPengangkutan(selectedItem);
                  const badge = getStatusBadge(status);
                  return (
                    <span className={`px-3 py-1 rounded-lg text-xs font-bold ${badge.class}`}>
                      {badge.label}
                    </span>
                  );
                })()}
              </div>
              <div className="space-y-2">
                {getProdukLoadStatus(selectedItem).map((p: any, i: number) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">{p.namaProduk}</span>
                    <span className="font-mono text-gray-900">{p.loaded.toLocaleString()} / {p.ordered.toLocaleString()} KG</span>
                  </div>
                ))}
              </div>
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
                      <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase border">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getSuratMuatForPI(selectedItem.nomorPI).map((surat: SuratMuatInfo, idx: number) => (
                      <tr key={idx} className="border-b">
                        <td className="px-4 py-3 text-sm text-gray-900 border">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm font-mono font-bold text-green-700 border">{surat.nomorSeri}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border">{surat.tanggal}</td>
                        <td className="px-4 py-3 text-sm text-gray-800 border">
                          {surat.items.map((it: SuratMuatItem, i: number) => (
                            <div key={i}>{it.jenisPupuk} ({it.pengambilanZAK} ZAK)</div>
                          ))}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono border">
                          {surat.items.reduce((sum: number, it: SuratMuatItem) => sum + (it.pengambilanZAK || 0), 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right font-mono border">{surat.totalKG.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border">{surat.nomorPolisi}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border">{surat.driverUnit}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 border">
                          <div className="flex items-center gap-2 justify-center">
                            <button onClick={() => handlePrintSuratPDF(surat)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Print Surat">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                              </svg>
                            </button>
                            <button onClick={() => handleEditSurat(surat)} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Edit Surat">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => handleDeleteSurat(surat)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus Surat">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
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
                    <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(selectedItem.produkItems || []).map((p: ProdukItem, idx: number) => (
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

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Status Pengangkutan" size="md" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleUpdateStatus} isLoading={isSubmitting}>Simpan</Button>
        </div>
      }>
        <form onSubmit={handleUpdateStatus} className="space-y-6">
          <div className="grid grid-cols-1 gap-6">
            <Input label="Sisa Pengambilan (KG)" type="number" value={editForm.sisaPengambilanKG} onChange={(e) => setEditForm((prev) => ({ ...prev, sisaPengambilanKG: e.target.value }))} placeholder="0" />
            <Select label="Status Pengangkutan" value={editForm.statusPengangkutan} onChange={(e) => setEditForm((prev) => ({ ...prev, statusPengangkutan: e.target.value }))} options={[
              { value: "pending", label: "Belum Dimuat" },
              { value: "partial", label: "Sebagian Dimuat" },
              { value: "complete", label: "Selesai Dimuat" },
            ]} />
          </div>
          {selectedItem && (
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Informasi Saat Ini</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p><span className="text-gray-500">Total Dipesan:</span> <span className="font-medium">{getTotalOrdered(selectedItem).toLocaleString()} KG</span></p>
                <p><span className="text-gray-500">Sudah Dimuat:</span> <span className="font-medium">{getTotalLoaded(selectedItem.nomorPI).toLocaleString()} KG</span></p>
                <p><span className="text-gray-500">Sisa:</span> <span className="font-medium">{Math.max(0, getTotalOrdered(selectedItem) - getTotalLoaded(selectedItem.nomorPI)).toLocaleString()} KG</span></p>
                <p><span className="text-gray-500">Status:</span> <span className="font-medium">{getStatusBadge(getStatusPengangkutan(selectedItem)).label}</span></p>
              </div>
            </div>
          )}
        </form>
      </Modal>

      <Modal isOpen={isEditSuratModalOpen} onClose={() => setIsEditSuratModalOpen(false)} title={`Edit Surat Muat - ${selectedSurat?.nomorSeri}`} size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsEditSuratModalOpen(false)}>Batal</Button>
          <Button variant="primary" onClick={handleUpdateSurat} isLoading={isSubmitting}>Simpan Perubahan</Button>
        </div>
      }>
        <form onSubmit={handleUpdateSurat} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Tanggal" type="date" value={editSuratForm.tanggal} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, tanggal: e.target.value }))} required />
            <Input label="Nomor Seri" type="text" value={editSuratForm.nomorSeri} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, nomorSeri: e.target.value }))} required />
            <Input label="Nomor Polisi" type="text" value={editSuratForm.nomorPolisi} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, nomorPolisi: e.target.value }))} required />
            <Input label="Driver Unit" type="text" value={editSuratForm.driverUnit} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, driverUnit: e.target.value }))} required />
            <Input label="Nomor SIM" type="text" value={editSuratForm.nomorSIM} onChange={(e) => setEditSuratForm((prev) => ({ ...prev, nomorSIM: e.target.value }))} className="md:col-span-2" />
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-700">Item Pengangkutan</h4>
            {editSuratForm.items.map((item: EditSuratItem, idx: number) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="text-sm font-semibold text-gray-700">Item {idx + 1}</h5>
                  {editSuratForm.items.length > 1 && (
                    <button type="button" onClick={() => removeSuratItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
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
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Item
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}