"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Table from "@/app/components/ui/Table";

interface StockItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  bobotPerUnit: number;
  botolPerDus?: number;
  stokAkhirUnit: number;
  stokAkhirKG: number;
  barangKeluarUnit: number;
  barangKeluarKG: number;
}

interface BackupItem {
  stockId: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  bobotPerUnit: number;
  botolPerDus: number;
  pengambilanUnit: string;
  totalKG: number;
  nomorPI: string;
}

interface BackupDoc {
  id: string;
  nomorSeri: string;
  tanggal: string;
  driverUnit: string;
  nomorPolisi: string;
  nomorSIM: string;
  items: Array<{
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
  fotoUrls: string[];
  totalPengambilanKG: number;
  createdBy: string;
  createdAt?: Date;
}

const compressImage = (file: File, maxSizeMB: number = 2): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    if (file.size <= maxSizeMB * 1024 * 1024) {
      resolve(file);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        const maxDim = 1920;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        let quality = 0.9;
        const tryCompress = () => {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error("Gagal kompres foto"));
              return;
            }
            if (blob.size <= maxSizeMB * 1024 * 1024 || quality <= 0.1) {
              resolve(blob);
            } else {
              quality -= 0.1;
              tryCompress();
            }
          }, "image/jpeg", quality);
        };
        tryCompress();
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function BarangKeluarBackupPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [backupList, setBackupList] = useState<BackupDoc[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [nomorSeriError, setNomorSeriError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nomorSeri: "",
    tanggal: new Date().toISOString().split("T")[0],
    driverUnit: "",
    nomorPolisi: "",
    nomorSIM: "",
    items: [{ stockId: "", kodeBarang: "", namaBarang: "", unit: "", bobotPerUnit: 0, botolPerDus: 0, pengambilanUnit: "", nomorPI: "", totalKG: 0 }] as BackupItem[],
  });

  const [fotoFiles, setFotoFiles] = useState<File[]>([]);
  const [fotoPreviews, setFotoPreviews] = useState<string[]>([]);
  const [existingFotoUrls, setExistingFotoUrls] = useState<string[]>([]);

  useEffect(() => {
    fetchStockList();
    fetchBackupList();
  }, []);

  const fetchStockList = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
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

  const fetchBackupList = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "transaksiBarangKeluar"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs
        .filter((doc) => doc.data().jenis === "barangKeluarBackup")
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            nomorSeri: d.nomorSeri || "",
            tanggal: d.tanggal || "",
            driverUnit: d.driverUnit || "",
            nomorPolisi: d.nomorPolisi || "",
            nomorSIM: d.nomorSIM || "",
            items: d.items || [],
            fotoUrls: d.fotoUrls || [],
            totalPengambilanKG: d.totalPengambilanKG || 0,
            createdBy: d.createdBy || "",
            createdAt: d.createdAt?.toDate(),
          } as BackupDoc;
        });
      setBackupList(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkNomorSeriExists = async (nomorSeri: string, excludeId?: string | null) => {
    if (!nomorSeri.trim()) return false;
    const q1 = query(collection(db, "suratPengangkutan"), where("nomorSeri", "==", nomorSeri.trim()));
    const q2 = query(collection(db, "transaksiBarangKeluar"), where("nomorSeri", "==", nomorSeri.trim()));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    if (!snap1.empty) return true;
    if (!snap2.empty) {
      if (excludeId) {
        return snap2.docs.some((d) => d.id !== excludeId);
      }
      return true;
    }
    return false;
  };

  const handleNomorSeriBlur = async () => {
    if (!formData.nomorSeri.trim()) {
      setNomorSeriError("");
      return;
    }
    const exists = await checkNomorSeriExists(formData.nomorSeri.trim(), editId);
    if (exists) {
      setNomorSeriError("Nomor seri sudah terdaftar di riwayat transaksi");
    } else {
      setNomorSeriError("");
    }
  };

  const handleItemChange = (idx: number, field: string, value: string) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const item = { ...newItems[idx], [field]: value };
      if (field === "stockId" && value) {
        const stock = stockList.find((s) => s.id === value);
        if (stock) {
          item.kodeBarang = stock.kodeBarang;
          item.namaBarang = stock.namaBarang;
          item.unit = stock.unit;
          item.bobotPerUnit = stock.bobotPerUnit || 0;
          item.botolPerDus = stock.botolPerDus || 20;
        }
      }
      if ((field === "pengambilanUnit" || field === "stockId") && item.stockId) {
        const qty = parseFloat(item.pengambilanUnit) || 0;
        if (item.unit === "ZAK") {
          item.totalKG = qty * (item.bobotPerUnit || 50);
        } else if (item.unit === "KG") {
          item.totalKG = qty;
        } else {
          item.totalKG = 0;
        }
      }
      newItems[idx] = item;
      return { ...prev, items: newItems };
    });
  };

  const addItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { stockId: "", kodeBarang: "", namaBarang: "", unit: "", bobotPerUnit: 0, botolPerDus: 0, pengambilanUnit: "", nomorPI: "", totalKG: 0 },
      ],
    }));
  };

  const removeItem = (idx: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setFotoFiles((prev) => [...prev, ...files]);
    const newPreviews = files.map((file) => URL.createObjectURL(file));
    setFotoPreviews((prev) => [...prev, ...newPreviews]);
  };

  const removeFoto = (idx: number) => {
    setFotoFiles((prev) => prev.filter((_, i) => i !== idx));
    setFotoPreviews((prev) => {
      const removed = prev[idx];
      const newPreviews = prev.filter((_, i) => i !== idx);
      if (removed && removed.startsWith("blob:")) {
        URL.revokeObjectURL(removed);
      }
      return newPreviews;
    });
  };

  const removeExistingFoto = (idx: number) => {
    setExistingFotoUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadPhotos = async (files: File[], docId: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const compressed = await compressImage(file);
      const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, "_")}`;
      const storageRef = ref(storage, `barangKeluarBackup/${docId}/${fileName}`);
      await uploadBytes(storageRef, compressed);
      const url = await getDownloadURL(storageRef);
      urls.push(url);
    }
    return urls;
  };

  const updateStockFromItems = async (
    items: Array<{ stockId: string; unit: string; pengambilanUnit: number; totalKG: number; botolPerDus: number }>,
    isReverse: boolean
  ) => {
    for (const item of items) {
      if (!item.stockId) continue;
      const stockRef = doc(db, "stockGudang", item.stockId);
      const stockSnap = await getDoc(stockRef);
      if (!stockSnap.exists()) continue;
      const sData = stockSnap.data();
      const factor = isReverse ? -1 : 1;

      const updates: any = { updatedAt: serverTimestamp() };

      if (item.unit === "ZAK") {
        const qty = item.pengambilanUnit || 0;
        const kg = item.totalKG || 0;
        updates.barangKeluarUnit = Math.max(0, (sData.barangKeluarUnit || 0) + qty * factor);
        updates.barangKeluarKG = Math.max(0, (sData.barangKeluarKG || 0) + kg * factor);
        updates.stokAkhirUnit = Math.max(0, (sData.stokAkhirUnit || 0) - qty * factor);
        updates.stokAkhirKG = Math.max(0, (sData.stokAkhirKG || 0) - kg * factor);
      } else if (item.unit === "KG") {
        const kg = item.totalKG || 0;
        updates.barangKeluarKG = Math.max(0, (sData.barangKeluarKG || 0) + kg * factor);
        updates.stokAkhirKG = Math.max(0, (sData.stokAkhirKG || 0) - kg * factor);
      } else if (item.unit === "DUS") {
        const botolPerDus = item.botolPerDus || sData.botolPerDus || 20;
        const botolQty = item.pengambilanUnit || 0;
        const dusQty = botolQty / botolPerDus;
        updates.barangKeluarUnit = Math.max(0, (sData.barangKeluarUnit || 0) + dusQty * factor);
        updates.stokAkhirUnit = Math.max(0, (sData.stokAkhirUnit || 0) - dusQty * factor);
        updates.stokAkhirKG = 0;
        updates.barangKeluarKG = 0;
      } else if (item.unit === "BOTOL") {
        const qty = item.pengambilanUnit || 0;
        updates.barangKeluarUnit = Math.max(0, (sData.barangKeluarUnit || 0) + qty * factor);
        updates.stokAkhirUnit = Math.max(0, (sData.stokAkhirUnit || 0) - qty * factor);
        updates.stokAkhirKG = 0;
        updates.barangKeluarKG = 0;
      }

      await updateDoc(stockRef, updates);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nomorSeri.trim()) newErrors.nomorSeri = "Nomor seri wajib diisi";
    if (!formData.tanggal) newErrors.tanggal = "Tanggal wajib diisi";
    if (!formData.driverUnit.trim()) newErrors.driverUnit = "Driver wajib diisi";
    if (!formData.nomorPolisi.trim()) newErrors.nomorPolisi = "Nomor polisi wajib diisi";

    formData.items.forEach((item, idx) => {
      if (!item.stockId) newErrors[`item_${idx}_stock`] = `Produk wajib dipilih`;
      if (!item.pengambilanUnit || parseFloat(item.pengambilanUnit) <= 0) newErrors[`item_${idx}_qty`] = `Jumlah wajib diisi`;
      if (!item.nomorPI.trim()) newErrors[`item_${idx}_pi`] = `Nomor PI wajib diisi`;
    });

    if (!isEditing && fotoFiles.length === 0 && existingFotoUrls.length === 0) {
      newErrors.foto = "Foto wajib diunggah minimal 1";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      nomorSeri: "",
      tanggal: new Date().toISOString().split("T")[0],
      driverUnit: "",
      nomorPolisi: "",
      nomorSIM: "",
      items: [{ stockId: "", kodeBarang: "", namaBarang: "", unit: "", bobotPerUnit: 0, botolPerDus: 0, pengambilanUnit: "", nomorPI: "", totalKG: 0 }],
    });
    fotoPreviews.forEach((url) => {
      if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    });
    setFotoFiles([]);
    setFotoPreviews([]);
    setExistingFotoUrls([]);
    setIsEditing(false);
    setEditId(null);
    setErrors({});
    setNomorSeriError("");
    setSuccessMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (nomorSeriError) return;
    setIsSubmitting(true);

    try {
      const itemsData = formData.items.map((item) => ({
        stockId: item.stockId,
        kodeBarang: item.kodeBarang,
        namaBarang: item.namaBarang,
        unit: item.unit,
        bobotPerUnit: item.bobotPerUnit,
        botolPerDus: item.botolPerDus || 20,
        pengambilanUnit: parseFloat(item.pengambilanUnit) || 0,
        totalKG: item.totalKG,
        nomorPI: item.nomorPI.trim(),
      }));

      const totalPengambilanKG = itemsData.reduce((sum, it) => sum + it.totalKG, 0);

      const docData: any = {
        jenis: "barangKeluarBackup",
        nomorSeri: formData.nomorSeri.trim().toUpperCase(),
        tanggal: formData.tanggal,
        driverUnit: formData.driverUnit.trim(),
        nomorPolisi: formData.nomorPolisi.trim().toUpperCase(),
        nomorSIM: formData.nomorSIM.trim() || null,
        items: itemsData,
        totalPengambilanKG: totalPengambilanKG,
        fotoUrls: [],
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "transaksiBarangKeluar"), docData);

      let fotoUrls: string[] = [];
      if (fotoFiles.length > 0) {
        fotoUrls = await uploadPhotos(fotoFiles, docRef.id);
        await updateDoc(docRef, { fotoUrls });
      }

      await updateStockFromItems(itemsData, false);

      resetForm();
      fetchBackupList();
      setSuccessMessage("Data barang keluar backup berhasil disimpan!");
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (item: BackupDoc) => {
    setIsEditing(true);
    setEditId(item.id);
    setFormData({
      nomorSeri: item.nomorSeri,
      tanggal: item.tanggal,
      driverUnit: item.driverUnit,
      nomorPolisi: item.nomorPolisi,
      nomorSIM: item.nomorSIM,
      items: item.items.map((it) => ({
        stockId: it.stockId,
        kodeBarang: it.kodeBarang,
        namaBarang: it.namaBarang,
        unit: it.unit,
        bobotPerUnit: it.bobotPerUnit,
        botolPerDus: it.botolPerDus || 0,
        pengambilanUnit: String(it.pengambilanUnit),
        nomorPI: it.nomorPI,
        totalKG: it.totalKG,
      })),
    });
    setExistingFotoUrls(item.fotoUrls || []);
    setFotoFiles([]);
    setFotoPreviews([]);
    setNomorSeriError("");
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || !editId) return;
    if (nomorSeriError) return;
    setIsSubmitting(true);

    try {
      const oldDocRef = doc(db, "transaksiBarangKeluar", editId);
      const oldSnap = await getDoc(oldDocRef);
      const oldData = oldSnap.data();
      const oldItems = oldData?.items || [];

      const newItemsData = formData.items.map((item) => ({
        stockId: item.stockId,
        kodeBarang: item.kodeBarang,
        namaBarang: item.namaBarang,
        unit: item.unit,
        bobotPerUnit: item.bobotPerUnit,
        botolPerDus: item.botolPerDus || 20,
        pengambilanUnit: parseFloat(item.pengambilanUnit) || 0,
        totalKG: item.totalKG,
        nomorPI: item.nomorPI.trim(),
      }));

      const totalPengambilanKG = newItemsData.reduce((sum, it) => sum + it.totalKG, 0);

      let allFotoUrls = [...existingFotoUrls];
      if (fotoFiles.length > 0) {
        const newUrls = await uploadPhotos(fotoFiles, editId);
        allFotoUrls = [...allFotoUrls, ...newUrls];
      }

      await updateDoc(oldDocRef, {
        nomorSeri: formData.nomorSeri.trim().toUpperCase(),
        tanggal: formData.tanggal,
        driverUnit: formData.driverUnit.trim(),
        nomorPolisi: formData.nomorPolisi.trim().toUpperCase(),
        nomorSIM: formData.nomorSIM.trim() || null,
        items: newItemsData,
        totalPengambilanKG: totalPengambilanKG,
        fotoUrls: allFotoUrls,
        updatedAt: serverTimestamp(),
      });

      await updateStockFromItems(oldItems, true);
      await updateStockFromItems(newItemsData, false);

      resetForm();
      fetchBackupList();
      setSuccessMessage("Data barang keluar backup berhasil diperbarui!");
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal memperbarui data. Silakan coba lagi." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item: BackupDoc) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data barang keluar backup ini?")) return;
    try {
      await updateStockFromItems(item.items, true);
      await deleteDoc(doc(db, "transaksiBarangKeluar", item.id));
      fetchBackupList();
      setSuccessMessage("Data berhasil dihapus!");
    } catch (error) {
      console.error(error);
      setErrors({ submit: "Gagal menghapus data. Silakan coba lagi." });
    }
  };

  const handlePrint = (item: BackupDoc) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const itemsHtml = item.items
      .map(
        (it, idx) => {
          let qtyDisplay = it.pengambilanUnit.toLocaleString("id-ID");
          let unitDisplay = it.unit;
          if (it.unit === "DUS") {
            const dusQty = it.pengambilanUnit / (it.botolPerDus || 20);
            qtyDisplay = `${dusQty.toLocaleString("id-ID", { maximumFractionDigits: 2 })} DUS (${it.pengambilanUnit.toLocaleString("id-ID")} botol)`;
            unitDisplay = "DUS";
          } else if (it.unit === "BOTOL") {
            qtyDisplay = `${it.pengambilanUnit.toLocaleString("id-ID")} botol`;
            unitDisplay = "BOTOL";
          }
          return `<tr>
            <td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${idx + 1}</td>
            <td style="padding:6px 8px;font-size:10px;border:1px solid #000;vertical-align:top;font-weight:600;">${it.kodeBarang || "-"}</td>
            <td style="padding:6px 8px;font-size:10px;border:1px solid #000;vertical-align:top;">${it.namaBarang || "-"}</td>
            <td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${unitDisplay}</td>
            <td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${qtyDisplay}</td>
            <td style="text-align:center;padding:6px 4px;font-size:10px;border:1px solid #000;vertical-align:top;">${it.totalKG > 0 ? it.totalKG.toLocaleString("id-ID") + " KG" : "-"}</td>
            <td style="padding:6px 8px;font-size:10px;border:1px solid #000;vertical-align:top;">${it.nomorPI || "-"}</td>
          </tr>`;
        }
      )
      .join("");

    const piList = item.items.map((it) => it.nomorPI).filter((v, i, a) => v && a.indexOf(v) === i);
    const piListHtml = piList.join(", ") || "-";

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Barang Keluar Backup ${item.nomorSeri}</title>
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
    .table-section { margin-bottom: 10px; }
    .table-title { text-align: center; background: #dcfce7; border: 1px solid #000; border-bottom: none; padding: 4px 0; font-size: 10px; font-weight: 700; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table th { background: #f0fdf4; font-size: 9px; padding: 5px 3px; border: 1px solid #000; font-weight: 700; text-align: center; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .data-table td { border: 1px solid #000; padding: 5px 3px; vertical-align: top; }
    .notes-section { margin-top: 10px; font-size: 9px; }
    .signature-row { display: flex; justify-content: space-between; margin-top: auto; padding-top: 20px; align-items: flex-end; }
    .signature-box { width: 45%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; }
    .signature-title { font-size: 9px; margin-bottom: 4px; min-height: 28px; line-height: 1.4; }
    .signature-name { font-size: 10px; font-weight: 700; margin-top: 0; border-top: 1px solid #000; padding-top: 3px; display: block; width: 90%; margin-left: auto; margin-right: auto; }
    .footer-img { width: 100%; display: block; margin-top: auto; padding-top: 10px; }
    .print-btn { background: #16a34a; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; margin: 10px; }
    .print-bar { text-align: center; padding: 10px; background: #f3f4f6; position: sticky; top: 0; z-index: 100; }
    @media print { .print-bar { display: none !important; } }
  </style>
</head>
<body>
  <div class="print-bar no-print"><button class="print-btn" onclick="window.print()">Print / Save as PDF</button></div>
  <div class="page">
    <img src="/Picture3.png" alt="Header" class="header-img" onerror="this.style.display='none'" />
    <div class="title-bar">BARANG KELUAR BACKUP</div>
    <div class="info-section">
      <div class="info-row"><span class="info-label">Nomor Seri</span> <span>${item.nomorSeri || "-"}</span></div>
      <div class="info-row"><span class="info-label">Tanggal</span> <span>${new Date(item.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span></div>
      <div class="info-row"><span class="info-label">Driver</span> <span>${item.driverUnit || "-"}</span></div>
      <div class="info-row"><span class="info-label">Nomor Polisi</span> <span>${item.nomorPolisi || "-"}</span></div>
      <div class="info-row"><span class="info-label">Nomor SIM</span> <span>${item.nomorSIM || "-"}</span></div>
      <div class="info-row"><span class="info-label">Nomor PI</span> <span>${piListHtml}</span></div>
    </div>
    <div class="table-section">
      <div class="table-title">RINCIAN BARANG KELUAR</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:30px;">NO</th>
            <th style="width:100px;">KODE BARANG</th>
            <th>NAMA BARANG</th>
            <th style="width:60px;">UNIT</th>
            <th style="width:80px;">JUMLAH</th>
            <th style="width:80px;">TOTAL KG</th>
            <th style="width:100px;">NO PI</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
    </div>
    <div class="notes-section">
      <p style="font-weight:700;">Keterangan:</p>
      <p>Dokumen ini merupakan backup barang keluar untuk stok gudang induk.</p>
      <p>Total pengambilan: ${item.totalPengambilanKG > 0 ? item.totalPengambilanKG.toLocaleString("id-ID") + " KG" : "-"}</p>
    </div>
    <div class="signature-row">
      <div class="signature-box">
        <p class="signature-title">Dibuat oleh,<br>PT. BUKIT AGROCHEMICAL BARU</p>
        <div style="min-height:60px;margin-bottom:4px;"></div>
        <p class="signature-name">${item.createdBy || ""}</p>
      </div>
      <div class="signature-box">
        <p class="signature-title">Driver,<br>Unit Angkut</p>
        <div style="min-height:60px;margin-bottom:4px;"></div>
        <p class="signature-name">${item.driverUnit || ""}</p>
      </div>
    </div>
    <img src="/Picture1.png" alt="Footer" class="footer-img" onerror="this.style.display='none'" />
  </div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const stockOptions = [
    { value: "", label: "Pilih produk..." },
    ...stockList.map((s) => ({ value: s.id, label: `${s.kodeBarang} - ${s.namaBarang} (${s.unit})` })),
  ];

  const columns = [
    {
      key: "nomorSeri",
      header: "Nomor Seri",
      width: "150px",
      render: (row: BackupDoc) => (
        <span className="font-mono font-bold text-green-700 bg-green-50 px-2 py-1 rounded text-xs block">{row.nomorSeri}</span>
      ),
    },
    {
      key: "tanggal",
      header: "Tanggal",
      width: "120px",
      render: (row: BackupDoc) => <span className="font-medium text-gray-800">{row.tanggal}</span>,
    },
    {
      key: "driver",
      header: "Driver / Polisi",
      width: "150px",
      render: (row: BackupDoc) => (
        <div className="space-y-1">
          <p className="text-sm font-medium text-gray-800">{row.driverUnit}</p>
          <p className="text-xs font-mono text-gray-500">{row.nomorPolisi}</p>
        </div>
      ),
    },
    {
      key: "items",
      header: "Item / Total",
      render: (row: BackupDoc) => (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-800">{row.items.length} produk</p>
          <p className="text-xs text-gray-500">
            {row.totalPengambilanKG > 0 ? `${row.totalPengambilanKG.toLocaleString("id-ID")} KG` : "DUS/BOTOL"}
          </p>
          {row.items.map((it, i) => (
            <p key={i} className="text-xs text-gray-400">
              {it.unit === "DUS"
                ? `${(it.pengambilanUnit / (it.botolPerDus || 20)).toLocaleString("id-ID", { maximumFractionDigits: 2 })} DUS (${it.pengambilanUnit.toLocaleString("id-ID")} botol)`
                : it.unit === "BOTOL"
                ? `${it.pengambilanUnit.toLocaleString("id-ID")} botol`
                : `${it.pengambilanUnit.toLocaleString("id-ID")} ${it.unit}`}
            </p>
          ))}
        </div>
      ),
    },
    {
      key: "foto",
      header: "Foto",
      width: "80px",
      render: (row: BackupDoc) => (
        <span className="px-2 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700">
          {row.fotoUrls?.length || 0} Foto
        </span>
      ),
    },
    {
      key: "aksi",
      header: "Aksi",
      width: "150px",
      render: (row: BackupDoc) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePrint(row)}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Print"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>
          <button
            onClick={() => handleEditClick(row)}
            className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => handleDelete(row)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Hapus"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Header title="Barang Keluar Backup" subtitle="Form backup barang keluar untuk stok gudang induk" />

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

      <form onSubmit={isEditing ? handleUpdate : handleSubmit} className="space-y-6">
        <Card title={isEditing ? "Edit Barang Keluar Backup" : "Input Barang Keluar Backup"}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nomor Seri SP</label>
              <input
                type="text"
                value={formData.nomorSeri}
                onChange={(e) => setFormData((prev) => ({ ...prev, nomorSeri: e.target.value }))}
                onBlur={handleNomorSeriBlur}
                placeholder="Contoh: BAGB-SP/2026/VI/0001"
                className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all font-mono text-sm ${nomorSeriError ? "border-red-500 bg-red-50" : "border-gray-300"}`}
                required
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

            <Input
              label="Tanggal"
              type="date"
              value={formData.tanggal}
              onChange={(e) => setFormData((prev) => ({ ...prev, tanggal: e.target.value }))}
              required
            />

            <Input
              label="Driver Unit"
              type="text"
              value={formData.driverUnit}
              onChange={(e) => setFormData((prev) => ({ ...prev, driverUnit: e.target.value }))}
              placeholder="Nama driver"
              required
            />

            <Input
              label="Nomor Polisi"
              type="text"
              value={formData.nomorPolisi}
              onChange={(e) => setFormData((prev) => ({ ...prev, nomorPolisi: e.target.value }))}
              placeholder="Contoh: KT 1234 XY"
              required
            />

            <Input
              label="Nomor SIM (Opsional)"
              type="text"
              value={formData.nomorSIM}
              onChange={(e) => setFormData((prev) => ({ ...prev, nomorSIM: e.target.value }))}
              placeholder="Nomor SIM driver"
            />
          </div>

          <div className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700">Daftar Produk yang Dimuat</h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Tambah Produk
              </Button>
            </div>

            {formData.items.map((item, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-gray-700">Produk {idx + 1}</h4>
                  {formData.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <Select
                      label="Pilih Produk"
                      value={item.stockId}
                      onChange={(e) => handleItemChange(idx, "stockId", e.target.value)}
                      options={stockOptions}
                    />
                    {errors[`item_${idx}_stock`] && (
                      <p className="mt-1 text-sm text-red-600">{errors[`item_${idx}_stock`]}</p>
                    )}
                  </div>

                  <Input
                    label="Nomor PI"
                    type="text"
                    value={item.nomorPI}
                    onChange={(e) => handleItemChange(idx, "nomorPI", e.target.value)}
                    placeholder="Ketik nomor PI"
                    required
                  />

                  <Input
                    label={item.unit === "DUS" ? "Jumlah (BOTOL)" : item.unit === "BOTOL" ? "Jumlah (BOTOL)" : `Jumlah (${item.unit || "unit"})`}
                    type="number"
                    value={item.pengambilanUnit}
                    onChange={(e) => handleItemChange(idx, "pengambilanUnit", e.target.value)}
                    placeholder={item.unit === "DUS" ? "Contoh: 5 (botol)" : item.unit === "BOTOL" ? "Contoh: 5 (botol)" : "0"}
                    required
                  />
                </div>
                {item.stockId && (
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md font-mono">{item.kodeBarang}</span>
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md">{item.namaBarang}</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md font-mono">Unit: {item.unit}</span>
                    {item.unit === "ZAK" && (
                      <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-md font-mono">Bobot: {item.bobotPerUnit} KG/ZAK</span>
                    )}
                    {item.unit === "DUS" && (
                      <span className="px-2 py-1 bg-pink-100 text-pink-700 rounded-md font-mono">{item.botolPerDus || 20} botol/DUS</span>
                    )}
                    {item.unit === "DUS" && item.pengambilanUnit && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md font-mono">
                        {(parseFloat(item.pengambilanUnit) || 0) / (item.botolPerDus || 20)} DUS
                        ({parseFloat(item.pengambilanUnit) || 0} botol)
                      </span>
                    )}
                    {item.totalKG > 0 && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-md font-mono">Total: {item.totalKG.toLocaleString("id-ID")} KG</span>
                    )}
                  </div>
                )}
                {errors[`item_${idx}_qty`] && (
                  <p className="mt-2 text-sm text-red-600">{errors[`item_${idx}_qty`]}</p>
                )}
                {errors[`item_${idx}_pi`] && (
                  <p className="mt-1 text-sm text-red-600">{errors[`item_${idx}_pi`]}</p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <label className="block text-sm font-medium text-gray-700 mb-2">Foto Dokumentasi</label>
            <div className="flex flex-wrap gap-3 mb-3">
              {existingFotoUrls.map((url, idx) => (
                <div key={`existing_${idx}`} className="relative group">
                  <img src={url} alt={`Foto ${idx + 1}`} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => removeExistingFoto(idx)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              {fotoPreviews.map((url, idx) => (
                <div key={`preview_${idx}`} className="relative group">
                  <img src={url} alt={`Preview ${idx + 1}`} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                  <button
                    type="button"
                    onClick={() => removeFoto(idx)}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <label className="w-24 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors">
                <svg className="w-6 h-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[10px] text-gray-500">Tambah Foto</span>
                <input type="file" accept="image/*" multiple onChange={handleFotoChange} className="hidden" />
              </label>
            </div>
            {errors.foto && <p className="text-sm text-red-600">{errors.foto}</p>}
            <p className="text-xs text-gray-500">Foto akan otomatis dikompres jika lebih dari 2MB</p>
          </div>

          <div className="mt-8 flex items-center justify-end gap-4">
            {isEditing && (
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal Edit
              </Button>
            )}
            <Button type="submit" variant="primary" size="lg" isLoading={isSubmitting} disabled={!!nomorSeriError}>
              {isEditing ? "Update Data" : "Simpan Data"}
            </Button>
          </div>
        </Card>
      </form>

      <Card title={`Riwayat Barang Keluar Backup (${backupList.length})`}>
        <Table
          columns={columns}
          data={backupList}
          isLoading={isLoading}
          emptyMessage="Belum ada data barang keluar backup"
          keyExtractor={(row) => row.id}
        />
      </Card>
    </div>
  );
}