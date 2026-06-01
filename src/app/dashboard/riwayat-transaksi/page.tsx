"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
  where,
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

interface UnifiedTransaksi {
  id: string;
  jenis: string;
  tanggal: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  jumlahZAK: number;
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
  }>;
  totalPengambilanKG?: number;
  nomorPIList?: string[];
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

interface ProformaInvoiceItem {
  id: string;
  nomorPI: string;
  produkItems: Array<{ namaProduk: string; kuantitas: number }>;
  sisaPengambilanKG?: number;
  statusPengangkutan?: string;
}

interface ExistingSurat {
  id: string;
  nomorSeri: string;
}

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
  const regex = /^BAGB-SP\/\d{4}\/(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII)\/\d{4}$/;
  return regex.test(value.trim());
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
    }>,
  });

  useEffect(() => {
    fetchData();
    fetchStockGudang();
    fetchProformaInvoice();
    fetchExistingSurat();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const masukQuery = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const masukSnapshot = await getDocs(masukQuery);
      const masukData = masukSnapshot.docs.map((doc) => ({
        id: doc.id,
        jenis: "barangMasuk",
        tanggal: doc.data().tanggal,
        kodeBarang: doc.data().kodeBarang,
        namaBarang: doc.data().namaBarang,
        unit: doc.data().unit,
        jumlahZAK: doc.data().jumlahZAK,
        fot: doc.data().fot,
        createdBy: doc.data().createdBy,
        createdAt: doc.data().createdAt?.toDate(),
        sopirNopol: doc.data().sopirNopol,
        botolPerDus: doc.data().botolPerDus,
        bobotPerBotol: doc.data().bobotPerBotol,
      } as UnifiedTransaksi));

      const keluarQuery = query(collection(db, "transaksiBarangKeluar"), orderBy("createdAt", "desc"));
      const keluarSnapshot = await getDocs(keluarQuery);
      const keluarData = keluarSnapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          jenis: d.jenis || "barangKeluar",
          tanggal: d.tanggal,
          kodeBarang: d.kodeBarang || "",
          namaBarang: d.namaBarang || "",
          unit: d.unit || "ZAK",
          jumlahZAK: d.jumlahZAK || 0,
          fot: d.fot || "",
          createdBy: d.createdBy,
          createdAt: d.createdAt?.toDate(),
          namaCustomer: d.namaCustomer,
          nomorPI: d.nomorPI,
          nomorInvoice: d.nomorInvoice,
          nomorSuratPengangkutan: d.nomorSuratPengangkutan,
          botolPerDus: d.botolPerDus,
          bobotPerBotol: d.bobotPerBotol,
          nomorSeri: d.nomorSeri,
          items: d.items,
          totalPengambilanKG: d.totalPengambilanKG,
          nomorPIList: d.nomorPIList,
          driverUnit: d.driverUnit,
          nomorPolisi: d.nomorPolisi,
          nomorSIM: d.nomorSIM,
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
      });
      setFotList(Array.from(fotSet).sort());
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
    } catch (error) {
      console.error(error);
    }
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
    } catch (error) {
      console.error(error);
    }
  };

  const checkNomorSeriExists = (value: string, excludeNomorSeri?: string) => {
    if (!value.trim()) {
      setNomorSeriError("");
      return false;
    }
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
      (item.driverUnit && item.driverUnit.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchJenis = filterJenis === "semua" ? true :
      filterJenis === "suratPengangkutan" ?
        (item.jenis === "suratPengangkutanGudangInduk" || item.jenis === "suratPengangkutanDO") :
        item.jenis === filterJenis;
    const matchFot = filterFot ? item.fot === filterFot : true;
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
      } else {
        await handleUpdateRegular();
      }
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRegular = async () => {
    let collectionName = "";
    if (selectedItem!.jenis === "barangMasuk") collectionName = "transaksiBarangMasuk";
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
    if (editForm.unit === "BOTOL") {
      updateData.botolPerDus = botolPerDus;
      updateData.bobotPerBotol = bobotPerBotol;
    }
    if (selectedItem!.jenis === "barangMasuk") {
      updateData.sopirNopol = editForm.sopirNopol.trim();
    } else if (selectedItem!.jenis === "barangKeluar") {
      updateData.namaCustomer = editForm.namaCustomer.trim();
      updateData.nomorPI = editForm.nomorPI.trim();
      updateData.nomorInvoice = editForm.nomorInvoice.trim();
      updateData.nomorSuratPengangkutan = editForm.nomorSuratPengangkutan.trim();
    }
    await updateDoc(doc(db, collectionName, selectedItem!.id), updateData);
  };

  const handleUpdateSuratPengangkutan = async () => {
    const newNomorSeri = editSuratForm.nomorSeri.trim();
    if (checkNomorSeriExists(newNomorSeri, selectedItem!.nomorSeri)) {
      throw new Error("Nomor seri sudah ada");
    }

    const oldItems = selectedItem!.items || [];
    const newItems = editSuratForm.items.map((it) => ({
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
        const oldTotalKG = oldItems.reduce((sum, it) => sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50)), 0);
        const delta = oldTotalKG - totalPengambilanKG;
        const piRef = doc(db, "proformaInvoice", pi.id);
        const piSnap = await getDoc(piRef);
        if (piSnap.exists()) {
          const piData = piSnap.data();
          const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
          const newSisa = Math.max(0, currentSisa + delta);
          const totalOrdered = pi.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
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
    fetchExistingSurat();
  };

  const handleDelete = async (item: UnifiedTransaksi) => {
    let collectionName = "";
    if (item.jenis === "barangMasuk") collectionName = "transaksiBarangMasuk";
    else collectionName = "transaksiBarangKeluar";
    const jenisLabel = item.jenis === "barangMasuk" ? "Barang Masuk" :
      item.jenis === "suratPengangkutanGudangInduk" ? "Surat Pengangkutan Gudang Induk" :
      item.jenis === "suratPengangkutanDO" ? "Surat Pengangkutan DO" : "Barang Keluar";
    if (!confirm(`Apakah Anda yakin ingin menghapus data ${jenisLabel} ini?`)) return;
    try {
      if (item.jenis === "suratPengangkutanGudangInduk" && item.nomorPI) {
        const pi = getPIByNomor(item.nomorPI);
        if (pi) {
          const totalKG = (item.items || []).reduce((sum, it) => sum + ((it.pengambilanZAK || 0) * (it.bobotPerUnit || 50)), 0);
          const piRef = doc(db, "proformaInvoice", pi.id);
          const piSnap = await getDoc(piRef);
          if (piSnap.exists()) {
            const piData = piSnap.data();
            const currentSisa = piData.sisaPengambilanKG !== undefined ? piData.sisaPengambilanKG : 0;
            const newSisa = currentSisa + totalKG;
            const totalOrdered = pi.produkItems.reduce((sum, p) => sum + (p.kuantitas || 0), 0);
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
      if (item.jenis === "suratPengangkutanGudangInduk" || item.jenis === "suratPengangkutanDO") {
        const suratQuery = query(collection(db, "suratPengangkutan"), where("nomorSeri", "==", item.nomorSeri || ""));
        const suratSnapshot = await getDocs(suratQuery);
        if (!suratSnapshot.empty) {
          await deleteDoc(doc(db, "suratPengangkutan", suratSnapshot.docs[0].id));
        }
      }
      await deleteDoc(doc(db, collectionName, item.id));
      fetchData();
      fetchExistingSurat();
    } catch (error) {
      console.error(error);
    }
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((item) => ({
      "Jenis Transaksi": item.jenis === "barangMasuk" ? "Barang Masuk" :
        item.jenis === "suratPengangkutanGudangInduk" ? "Surat Pengangkutan Gudang Induk" :
        item.jenis === "suratPengangkutanDO" ? "Surat Pengangkutan DO" : "Barang Keluar",
      "Tanggal": item.tanggal,
      "Nomor Seri": item.nomorSeri || "-",
      "Kode Barang": item.kodeBarang || "-",
      "Nama Barang": item.namaBarang || "-",
      "Unit": item.unit || "-",
      "Jumlah": item.jumlahZAK || 0,
      "Total KG": item.totalPengambilanKG || (item.items ? item.items.reduce((sum, it) => sum + (it.totalKG || 0), 0) : 0),
      "FOT": item.fot || "-",
      "Customer": item.namaCustomer || "-",
      "No PI": item.nomorPI || (item.nomorPIList ? item.nomorPIList.join("; ") : "-"),
      "No Invoice": item.nomorInvoice || "-",
      "Driver Unit": item.driverUnit || "-",
      "No Polisi": item.nomorPolisi || "-",
      "No Surat Pengangkutan": item.nomorSuratPengangkutan || item.nomorSeri || "-",
      "Total Pengambilan KG": item.totalPengambilanKG || 0,
      "Dibuat Oleh": item.createdBy,
      "Tanggal Dibuat": item.createdAt ? new Date(item.createdAt).toLocaleDateString("id-ID") : "-",
    }));
    exportToExcel(exportData, `Riwayat_Transaksi_${new Date().toISOString().split("T")[0]}`, "Riwayat Transaksi");
  };

  const handlePrintSuratPDF = (item: UnifiedTransaksi) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = (item.items || [])
      .map(
        (it, idx) => `
        <tr>
          <td style="text-align: center; padding: 8px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${idx + 1}</td>
          <td style="text-align: center; padding: 8px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorSubDO || "-"}</td>
          <td style="text-align: center; padding: 8px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.nomorPO || "-"}</td>
          <td style="padding: 8px 8px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${it.jenisPupuk || ""}</td>
          <td style="text-align: center; padding: 8px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.party || "-"}</td>
          <td style="text-align: center; padding: 8px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.pengambilanZAK || "0"} ZAK</td>
          <td style="text-align: right; padding: 8px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top; font-weight: 600;">${(it.totalKG || 0).toLocaleString("id-ID")} KG</td>
          <td style="text-align: center; padding: 8px 4px; font-size: 10px; border: 1px solid #000; vertical-align: top;">${it.sisa || "-"}</td>
        </tr>
      `
      )
      .join("");

    const piListHtml = item.nomorPIList && item.nomorPIList.length > 0
      ? item.nomorPIList.map((pi) => `<span style="display: inline-block; background: #dcfce7; padding: 3px 10px; border-radius: 4px; margin-right: 6px; margin-bottom: 4px; font-size: 10px; font-weight: 600; border: 1px solid #16a34a;">${pi}</span>`).join("")
      : (item.nomorPI ? `<span style="display: inline-block; background: #dcfce7; padding: 3px 10px; border-radius: 4px; margin-right: 6px; font-size: 10px; font-weight: 600; border: 1px solid #16a34a;">${item.nomorPI}</span>` : '<span style="font-size: 10px; color: #666;">-</span>');

    const totalZAK = (item.items || []).reduce((sum, it) => sum + (it.pengambilanZAK || 0), 0);
    const totalKG = getTotalKGForSurat(item);

    const jenisBarangList = (item.items || [])
      .map((it) => it.jenisPupuk)
      .filter(Boolean)
      .join(", ");

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Surat Pengangkutan ${item.nomorSeri}</title>
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
          .info-box { border: 1px solid #000; padding: 10px; margin-bottom: 10px; background: #f9fafb; }
          .info-box-title { font-size: 9px; color: #666; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
          .info-box-value { font-size: 11px; font-weight: 700; color: #000; }
          .recipient-box { border: 1px solid #000; padding: 8px 10px; margin-bottom: 10px; }
          .recipient-title { font-size: 9px; color: #333; margin-bottom: 2px; }
          .recipient-name { font-size: 11px; font-weight: 700; }
          .recipient-address { font-size: 9px; color: #333; line-height: 1.5; margin-top: 2px; }
          .salutation { font-size: 10px; margin-bottom: 8px; }
          .salutation p { margin-bottom: 2px; }
          .table-section { margin-bottom: 10px; }
          .table-title { text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; }
          .data-table { width: 100%; border-collapse: collapse; }
          .data-table th { background: #f0fdf4; font-size: 9px; padding: 6px 3px; border: 1px solid #000; font-weight: 700; text-align: center; }
          .data-table td { border: 1px solid #000; padding: 6px 3px; vertical-align: top; }
          .summary-box { display: flex; justify-content: space-between; border: 1px solid #000; border-top: none; padding: 8px 10px; background: #f0fdf4; }
          .summary-item { text-align: center; }
          .summary-label { font-size: 9px; color: #333; margin-bottom: 2px; }
          .summary-value { font-size: 12px; font-weight: 700; color: #000; }
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
              <span>Lamandau, ${new Date(item.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
            <div class="info-row" style="margin-top: 6px;">
              <span class="info-label">Nomor Seri : <span style="font-size: 12px;">${item.nomorSeri || "-"}</span></span>
            </div>
          </div>

          <div class="info-box">
            <div class="info-box-title">Nomor Proforma Invoice</div>
            <div class="info-box-value">${piListHtml}</div>
          </div>

          <div class="info-box" style="margin-bottom: 10px;">
            <div class="info-box-title">Jenis Barang / Pupuk yang Diangkut</div>
            <div class="info-box-value">${jenisBarangList || "-"}</div>
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

          <div class="table-section">
            <div class="table-title">DASAR PENGANGKUTAN</div>
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 30px;">NO</th>
                  <th style="width: 90px;">NOMOR SUB DO</th>
                  <th style="width: 90px;">NOMOR PO</th>
                  <th>JENIS PUPUK</th>
                  <th style="width: 60px;">PARTY</th>
                  <th style="width: 80px;">PENGAMBILAN<br>ZAK</th>
                  <th style="width: 90px;">TOTAL KG</th>
                  <th style="width: 60px;">SISA</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>
            <div class="summary-box">
              <div class="summary-item">
                <div class="summary-label">Total ZAK</div>
                <div class="summary-value">${totalZAK.toLocaleString("id-ID")} ZAK</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total KG</div>
                <div class="summary-value">${totalKG.toLocaleString("id-ID")} KG</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Jenis Barang</div>
                <div class="summary-value">${(item.items || []).length} Jenis</div>
              </div>
            </div>
          </div>

          <div class="table-section">
            <div class="table-title">DATA UNIT ANGKUTAN</div>
            <table class="data-table">
              <tbody>
                <tr>
                  <td style="padding: 8px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600; width: 120px;">NO. POLISI :</td>
                  <td style="padding: 8px 8px; font-size: 10px; border: 1px solid #000; font-weight: 700;">${item.nomorPolisi || "-"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">DRIVER UNIT :</td>
                  <td style="padding: 8px 8px; font-size: 10px; border: 1px solid #000; font-weight: 700;">${item.driverUnit || "-"}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 8px; font-size: 10px; border: 1px solid #000; font-weight: 600;">NOMOR SIM :</td>
                  <td style="padding: 8px 8px; font-size: 10px; border: 1px solid #000;">${item.nomorSIM || "-"}</td>
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
              <p class="signature-name">${item.driverUnit || ""}</p>
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
    { value: "suratPengangkutan", label: "Surat Pengangkutan" },
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
    if (jenis === "suratPengangkutanGudangInduk") return "bg-green-100 text-green-700";
    if (jenis === "suratPengangkutanDO") return "bg-purple-100 text-purple-700";
    return "bg-orange-100 text-orange-700";
  };

  const getJenisLabel = (jenis: string) => {
    if (jenis === "barangMasuk") return "MASUK";
    if (jenis === "suratPengangkutanGudangInduk") return "GUDANG INDUK";
    if (jenis === "suratPengangkutanDO") return "DO";
    return "KELUAR";
  };

  const getTotalKGForSurat = (item: UnifiedTransaksi) => {
    if (item.totalPengambilanKG) return item.totalPengambilanKG;
    if (item.items) return item.items.reduce((sum, it) => sum + (it.totalKG || 0), 0);
    return 0;
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
      header: "Nomor Seri",
      width: "180px",
      render: (row: UnifiedTransaksi) => (
        row.nomorSeri ? (
          <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded text-xs">{row.nomorSeri}</span>
        ) : (
          <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded text-xs">{row.kodeBarang || "-"}</span>
        )
      ),
    },
    {
      key: "namaBarang",
      header: "Nama Barang / Info",
      render: (row: UnifiedTransaksi) => (
        <div className="text-sm">
          {row.jenis === "suratPengangkutanGudangInduk" || row.jenis === "suratPengangkutanDO" ? (
            <div>
              <p className="font-semibold text-gray-800">{row.items && row.items[0] ? row.items[0].jenisPupuk : "Surat Pengangkutan"}</p>
              {row.nomorPIList && row.nomorPIList.length > 0 && (
                <p className="text-xs text-gray-500">PI: {row.nomorPIList.join(", ")}</p>
              )}
              {getTotalKGForSurat(row) > 0 && <p className="text-xs text-gray-500">{getTotalKGForSurat(row).toLocaleString()} KG</p>}
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
      render: (row: UnifiedTransaksi) => (
        <span className={`px-2 py-1 rounded-md text-xs font-bold ${
          row.unit === "ZAK" ? "bg-blue-100 text-blue-700" :
          row.unit === "DUS" ? "bg-purple-100 text-purple-700" :
          row.unit === "BOTOL" ? "bg-pink-100 text-pink-700" :
          "bg-gray-100 text-gray-700"
        }`}>
          {row.unit || "-"}
        </span>
      ),
    },
    {
      key: "jumlah",
      header: "Jumlah",
      width: "120px",
      render: (row: UnifiedTransaksi) => (
        <span className="font-mono font-bold text-gray-700">
          {row.jenis === "suratPengangkutanGudangInduk" || row.jenis === "suratPengangkutanDO"
            ? `${getTotalKGForSurat(row).toLocaleString()} KG`
            : `${row.jumlahZAK.toLocaleString()} ${row.unit === "KG" ? "KG" : "ZAK"}`
          }
        </span>
      ),
    },
    {
      key: "fot",
      header: "FOT",
      width: "100px",
      render: (row: UnifiedTransaksi) => (
        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded">{row.fot || "-"}</span>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "150px",
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
  const isBotol = editForm.unit === "BOTOL";
  const isSuratEdit = selectedItem?.jenis === "suratPengangkutanGudangInduk" || selectedItem?.jenis === "suratPengangkutanDO";

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
      items: prev.items.filter((_, i) => i !== idx),
    }));
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
            <input type="text" placeholder="Cari kode, nama barang, FOT, customer, nomor seri..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all" />
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold">Total Transaksi</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{filteredData.length}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs text-green-600 uppercase tracking-wide font-semibold">Barang Masuk</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{getTotalMasuk()}</p>
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
        </div>
      }>
        {selectedItem && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold ${getJenisBadgeClass(selectedItem.jenis)}`}>
                {selectedItem.jenis === "barangMasuk" ? "TRANSAKSI BARANG MASUK" :
                 selectedItem.jenis === "suratPengangkutanGudangInduk" ? "SURAT PENGANGKUTAN GUDANG INDUK" :
                 selectedItem.jenis === "suratPengangkutanDO" ? "SURAT PENGANGKUTAN DO" :
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
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Sub DO</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">PO</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Jenis Pupuk</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Party</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">ZAK</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase border">Total KG</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase border">Sisa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedItem.items || []).map((item, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="px-4 py-3 text-sm text-gray-900 border">{idx + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{item.nomorSubDO || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{item.nomorPO || "-"}</td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 border">{item.jenisPupuk}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{item.party || "-"}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono border">{item.pengambilanZAK || 0}</td>
                          <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right font-mono border">{(item.totalKG || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 border">{item.sisa || "-"}</td>
                        </tr>
                      ))}
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
            ) : (
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
            )}
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

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={isSuratEdit ? "Edit Surat Pengangkutan" : `Edit ${selectedItem?.jenis === "barangMasuk" ? "Transaksi Barang Masuk" : "Transaksi Barang Keluar"}`} size="lg" footer={
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
                <input
                  type="text"
                  value={editSuratForm.nomorSeri}
                  onChange={handleNomorSeriChangeEdit}
                  className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all font-mono text-sm ${nomorSeriError ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                />
                {nomorSeriError && (
                  <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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