"use client";

import React, { useState, useEffect } from "react";
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Select from "@/app/components/ui/Select";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

interface StockItem {
  id: string;
  kodeBarang: string;
  namaBarang: string;
  unit: string;
  bobotPerUnit: number;
  botolPerDus?: number;
  stokAkhirUnit: number;
  stokAkhirKG: number;
}

interface UnreplacedRusak {
  transaksiId: string;
  fot: string;
  kodeBarang: string;
  namaBarang: string;
  unitMasuk: string;
  rusakUnit: string;
  rusakJumlah: number;
  rusakKeterangan: string;
  rusakIndex: number;
  tanggalTransaksi: string;
  fotoUrls?: string[];
  sudahDiganti: number;
  sisaRusak: number;
  jumlahTidakDiganti: number;
  status: string;
}

export default function PenggantiBarangRusakPage() {
  const { user } = useAuth();
  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [unreplacedRusakList, setUnreplacedRusakList] = useState<UnreplacedRusak[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [penggantianForm, setPenggantianForm] = useState({
    transaksiId: "",
    rusakIndex: 0,
    tanggal: new Date().toISOString().split("T")[0],
    jumlahZAK: "",
    jumlahTidakDiganti: "",
    fotoUrls: [] as string[],
    maxJumlah: 0,
    unitRusak: "ZAK",
  });

  const [fotoLoading, setFotoLoading] = useState(false);

  useEffect(() => {
    fetchStockGudang();
    fetchUnreplacedRusak();
  }, []);

  const fetchStockGudang = async () => {
    try {
      const q = query(collection(db, "stockGudang"), orderBy("namaBarang", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        kodeBarang: doc.data().kodeBarang || "",
        namaBarang: doc.data().namaBarang || "",
        unit: doc.data().unit || "ZAK",
        bobotPerUnit: doc.data().bobotPerUnit || 50,
        botolPerDus: doc.data().botolPerDus ?? undefined,
        stokAkhirUnit: doc.data().stokAkhirUnit || 0,
        stokAkhirKG: doc.data().stokAkhirKG || 0,
      } as StockItem));
      setStockList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchUnreplacedRusak = async () => {
    try {
      const q = query(collection(db, "transaksiBarangMasuk"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const list: UnreplacedRusak[] = [];
      snapshot.docs.forEach((docSnap) => {
        const d = docSnap.data();
        if (d.adaBarangRusak && Array.isArray(d.barangRusak)) {
          d.barangRusak.forEach((r: any, idx: number) => {
            const sudahDiganti = r.jumlahDiganti || 0;
            const jumlahTidakDiganti = r.jumlahTidakDiganti || 0;
            const sisaRusak = (r.jumlah || 0) - sudahDiganti - jumlahTidakDiganti;
            if (sisaRusak > 0) {
              list.push({
                transaksiId: docSnap.id,
                fot: d.fot || "",
                kodeBarang: d.kodeBarang || "",
                namaBarang: d.namaBarang || "",
                unitMasuk: d.unit || "ZAK",
                rusakUnit: r.unit || "ZAK",
                rusakJumlah: r.jumlah || 0,
                rusakKeterangan: r.keterangan || "",
                rusakIndex: idx,
                tanggalTransaksi: d.tanggal || "",
                fotoUrls: r.fotoUrls || [],
                sudahDiganti: sudahDiganti,
                sisaRusak: sisaRusak,
                jumlahTidakDiganti: jumlahTidakDiganti,
                status: r.status || "belum diganti",
              });
            }
          });
        }
      });
      setUnreplacedRusakList(list);
    } catch (error) {
      console.error(error);
    }
  };

  const compressImage = (file: File, maxSizeMB: number = 2): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          const maxDimension = 1920;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Canvas context failed")); return; }
          ctx.drawImage(img, 0, 0, width, height);
          let quality = 0.9;
          let result = canvas.toDataURL("image/jpeg", quality);
          const maxBytes = maxSizeMB * 1024 * 1024;
          while (result.length > maxBytes && quality > 0.1) {
            quality -= 0.1;
            result = canvas.toDataURL("image/jpeg", quality);
          }
          resolve(result);
        };
        img.onerror = () => reject(new Error("Image load failed"));
        img.src = event.target?.result as string;
      };
      reader.onerror = () => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  };

  const handlePenggantianFotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setFotoLoading(true);
    try {
      const newPhotos: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await compressImage(files[i], 2);
        newPhotos.push(compressed);
      }
      setPenggantianForm((prev) => ({ ...prev, fotoUrls: [...prev.fotoUrls, ...newPhotos] }));
    } catch (error) {
      console.error(error);
    } finally {
      setFotoLoading(false);
      e.target.value = "";
    }
  };

  const removePenggantianFoto = (idx: number) => {
    setPenggantianForm((prev) => ({ ...prev, fotoUrls: prev.fotoUrls.filter((_, i) => i !== idx) }));
  };

  const handleSubmitPenggantian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!penggantianForm.transaksiId) {
      setErrors((prev) => ({ ...prev, penggantian: "Pilih barang rusak yang akan diganti" }));
      return;
    }
    if (!penggantianForm.jumlahZAK || parseFloat(penggantianForm.jumlahZAK) <= 0) {
      setErrors((prev) => ({ ...prev, penggantianJumlah: "Jumlah penggantian tidak valid" }));
      return;
    }
    const jumlahInput = parseFloat(penggantianForm.jumlahZAK) || 0;
    const jumlahTidakInput = parseFloat(penggantianForm.jumlahTidakDiganti) || 0;
    if (penggantianForm.maxJumlah > 0 && jumlahInput > penggantianForm.maxJumlah) {
      setErrors((prev) => ({ ...prev, penggantianJumlah: `Jumlah penggantian tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
      return;
    }
    if (penggantianForm.maxJumlah > 0 && jumlahTidakInput > penggantianForm.maxJumlah) {
      setErrors((prev) => ({ ...prev, penggantianTidakDiganti: `Jumlah tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
      return;
    }
    if (jumlahInput + jumlahTidakInput > penggantianForm.maxJumlah) {
      setErrors((prev) => ({ ...prev, penggantianTotal: `Total diganti + tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
      return;
    }

    setIsSubmitting(true);
    setSuccessMessage("");

    try {
      const selectedRusak = unreplacedRusakList.find((r) => r.transaksiId === penggantianForm.transaksiId && r.rusakIndex === penggantianForm.rusakIndex);
      if (!selectedRusak) {
        setErrors((prev) => ({ ...prev, penggantian: "Data barang rusak tidak ditemukan" }));
        setIsSubmitting(false);
        return;
      }

      const jumlahPenggantian = parseFloat(penggantianForm.jumlahZAK) || 0;
      const jumlahTidakDiganti = parseFloat(penggantianForm.jumlahTidakDiganti) || 0;
      const stock = stockList.find((s) => s.kodeBarang === selectedRusak.kodeBarang && s.namaBarang === selectedRusak.namaBarang);
      const bobotPerUnit = stock ? stock.bobotPerUnit : 50;
      let totalKG = 0;
      let addUnit = 0;

      if (selectedRusak.unitMasuk === "KG") {
        totalKG = jumlahPenggantian;
        addUnit = 0;
      } else if (selectedRusak.unitMasuk === "BOTOL") {
        const dusPerZak = 10;
        const totalBotol = jumlahPenggantian * dusPerZak * (stock?.botolPerDus || 20);
        totalKG = (totalBotol * 50) / 1000;
        addUnit = jumlahPenggantian;
      } else if (selectedRusak.unitMasuk === "DUS") {
        const totalBotol = jumlahPenggantian * (stock?.botolPerDus || 20);
        totalKG = (totalBotol * 50) / 1000;
        addUnit = jumlahPenggantian;
      } else {
        totalKG = jumlahPenggantian * bobotPerUnit;
        addUnit = jumlahPenggantian;
      }

      const penggantianData: any = {
        tanggal: penggantianForm.tanggal,
        kodeBarang: selectedRusak.kodeBarang,
        namaBarang: selectedRusak.namaBarang,
        unit: selectedRusak.unitMasuk,
        jumlahZAK: jumlahPenggantian,
        totalKG: totalKG,
        fot: selectedRusak.fot,
        isPenggantianRusak: true,
        referensiTransaksiId: selectedRusak.transaksiId,
        referensiRusakIndex: selectedRusak.rusakIndex,
        fotoUrls: penggantianForm.fotoUrls.length > 0 ? penggantianForm.fotoUrls : null,
        createdBy: user?.nama || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "transaksiBarangMasuk"), penggantianData);

      const transaksiRef = doc(db, "transaksiBarangMasuk", selectedRusak.transaksiId);
      const transaksiSnap = await getDoc(transaksiRef);
      if (transaksiSnap.exists()) {
        const tData = transaksiSnap.data();
        const barangRusakArray = tData.barangRusak || [];
        if (barangRusakArray[selectedRusak.rusakIndex]) {
          const currentSudahDiganti = barangRusakArray[selectedRusak.rusakIndex].jumlahDiganti || 0;
          const currentTidakDiganti = barangRusakArray[selectedRusak.rusakIndex].jumlahTidakDiganti || 0;
          const newSudahDiganti = currentSudahDiganti + jumlahPenggantian;
          const newTidakDiganti = currentTidakDiganti + jumlahTidakDiganti;
          const totalRusak = barangRusakArray[selectedRusak.rusakIndex].jumlah || 0;
          const newSisa = totalRusak - newSudahDiganti - newTidakDiganti;
          let newStatus = "belum diganti";
          if (newSisa <= 0) newStatus = "selesai";
          else if (newSudahDiganti > 0) newStatus = "sebagian diganti";

          barangRusakArray[selectedRusak.rusakIndex] = {
            ...barangRusakArray[selectedRusak.rusakIndex],
            status: newStatus,
            jumlahDiganti: newSudahDiganti,
            jumlahTidakDiganti: newTidakDiganti,
            sisaRusak: newSisa > 0 ? newSisa : 0,
            tanggalPenggantian: penggantianForm.tanggal,
            penggantianFotoUrls: penggantianForm.fotoUrls.length > 0 ? penggantianForm.fotoUrls : null,
          };
          await updateDoc(transaksiRef, {
            barangRusak: barangRusakArray,
            updatedAt: serverTimestamp(),
          });
        }
      }

      if (stock) {
        const stockRef = doc(db, "stockGudang", stock.id);
        const stockSnap = await getDoc(stockRef);
        if (stockSnap.exists()) {
          const sData = stockSnap.data();
          const currentMasukUnit = sData.barangMasukUnit || 0;
          const currentMasukKG = sData.barangMasukKG || 0;
          const currentStokUnit = sData.stokAkhirUnit || 0;
          const currentStokKG = sData.stokAkhirKG || 0;

          await updateDoc(stockRef, {
            barangMasukUnit: currentMasukUnit + addUnit,
            barangMasukKG: currentMasukKG + totalKG,
            stokAkhirUnit: currentStokUnit + addUnit,
            stokAkhirKG: currentStokKG + totalKG,
            updatedAt: serverTimestamp(),
          });
        }
      }

      const remainingAfter = selectedRusak.sisaRusak - jumlahPenggantian - jumlahTidakDiganti;
      let msg = `Penggantian berhasil! ${jumlahPenggantian} ${selectedRusak.rusakUnit} telah masuk ke stok.`;
      if (jumlahTidakDiganti > 0) msg += ` ${jumlahTidakDiganti} ${selectedRusak.rusakUnit} ditandai tidak diganti.`;
      if (remainingAfter > 0) msg += ` Sisa ${remainingAfter} ${selectedRusak.rusakUnit} masih menunggu penggantian.`;
      else msg += " Semua barang rusak selesai.";
      setSuccessMessage(msg);
      setPenggantianForm({
        transaksiId: "",
        rusakIndex: 0,
        tanggal: new Date().toISOString().split("T")[0],
        jumlahZAK: "",
        jumlahTidakDiganti: "",
        fotoUrls: [],
        maxJumlah: 0,
        unitRusak: "ZAK",
      });
      fetchStockGudang();
      fetchUnreplacedRusak();
      setTimeout(() => setSuccessMessage(""), 7000);
    } catch (error) {
      console.error(error);
      setErrors((prev) => ({ ...prev, penggantianSubmit: "Gagal menyimpan penggantian. Silakan coba lagi." }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const unreplacedOptions = [
    { value: "", label: "Pilih barang rusak yang akan diganti..." },
    ...unreplacedRusakList.map((r) => ({
      value: `${r.transaksiId}_${r.rusakIndex}`,
      label: `${r.namaBarang} | Total: ${r.rusakJumlah} ${r.rusakUnit} | Sudah: ${r.sudahDiganti} ${r.rusakUnit} | Sisa: ${r.sisaRusak} ${r.rusakUnit} | ${r.rusakKeterangan} | ${r.tanggalTransaksi}`,
    })),
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Header
        title="Pengganti Barang Rusak"
        subtitle="Input penggantian barang rusak / cacat"
      />

      {successMessage && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3 text-blue-700">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {errors.penggantianSubmit && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">{errors.penggantianSubmit}</span>
        </div>
      )}

      <Card title={`Barang Rusak Belum Diganti (${unreplacedRusakList.length})`}>
        {unreplacedRusakList.length === 0 ? (
          <p className="text-sm text-gray-500">Tidak ada barang rusak yang menunggu penggantian</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-red-50">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">No</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Nama Barang</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Kode</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Total Rusak</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Sudah Diganti</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Tidak Diganti</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-red-800 uppercase border">Sisa</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Keterangan</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-red-800 uppercase border">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {unreplacedRusakList.map((r, idx) => (
                  <tr key={`${r.transaksiId}_${r.rusakIndex}`} className="border-b hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-900 border">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-gray-900 border">{r.namaBarang}</td>
                    <td className="px-3 py-2 text-sm font-mono text-gray-600 border">{r.kodeBarang}</td>
                    <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono border">{r.rusakJumlah.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-green-700 text-right font-mono border font-semibold">{r.sudahDiganti.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 text-right font-mono border">{r.jumlahTidakDiganti.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-red-700 text-right font-mono border font-bold">{r.sisaRusak.toLocaleString("id-ID")} {r.rusakUnit}</td>
                    <td className="px-3 py-2 text-sm text-gray-700 border">{r.rusakKeterangan}</td>
                    <td className="px-3 py-2 text-sm text-gray-600 border">{r.tanggalTransaksi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Form Penggantian Barang Rusak">
        <form onSubmit={handleSubmitPenggantian} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Pilih Barang Rusak"
              value={penggantianForm.transaksiId ? `${penggantianForm.transaksiId}_${penggantianForm.rusakIndex}` : ""}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  const [tid, ridx] = val.split("_");
                  const selected = unreplacedRusakList.find((r) => r.transaksiId === tid && r.rusakIndex === parseInt(ridx));
                  setPenggantianForm((prev) => ({
                    ...prev,
                    transaksiId: tid,
                    rusakIndex: parseInt(ridx) || 0,
                    jumlahZAK: selected ? String(selected.sisaRusak) : "",
                    jumlahTidakDiganti: "",
                    maxJumlah: selected ? selected.sisaRusak : 0,
                    unitRusak: selected ? selected.rusakUnit : "ZAK",
                  }));
                  setErrors((prev) => { const n = { ...prev }; delete n.penggantianJumlah; delete n.penggantian; return n; });
                } else {
                  setPenggantianForm((prev) => ({ ...prev, transaksiId: "", rusakIndex: 0, jumlahZAK: "", maxJumlah: 0, unitRusak: "ZAK" }));
                }
              }}
              options={unreplacedOptions}
              required
            />
            {penggantianForm.maxJumlah > 0 && (
              <p className="text-xs text-amber-700 font-semibold pt-6">
                Sisa yang bisa diganti: {penggantianForm.maxJumlah} {penggantianForm.unitRusak}
              </p>
            )}
            <Input
              label="Tanggal Penggantian"
              type="date"
              value={penggantianForm.tanggal}
              onChange={(e) => setPenggantianForm((prev) => ({ ...prev, tanggal: e.target.value }))}
              required
            />
            <Input
              label={`Jumlah Diganti (max: ${penggantianForm.maxJumlah} ${penggantianForm.unitRusak})`}
              type="number"
              value={penggantianForm.jumlahZAK}
              onChange={(e) => {
                const val = e.target.value;
                const num = parseFloat(val) || 0;
                const tidakNum = parseFloat(penggantianForm.jumlahTidakDiganti) || 0;
                if (penggantianForm.maxJumlah > 0 && num > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianJumlah: `Jumlah diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah} ${penggantianForm.unitRusak}` }));
                } else if (penggantianForm.maxJumlah > 0 && num + tidakNum > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianTotal: `Total diganti + tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
                } else {
                  setErrors((prev) => { const n = { ...prev }; delete n.penggantianJumlah; delete n.penggantianTotal; return n; });
                }
                setPenggantianForm((prev) => ({ ...prev, jumlahZAK: val }));
              }}
              placeholder={`Maksimal ${penggantianForm.maxJumlah} ${penggantianForm.unitRusak}`}
              error={errors.penggantianJumlah || errors.penggantianTotal}
              required
            />
            <Input
              label={`Jumlah Tidak Diganti`}
              type="number"
              value={penggantianForm.jumlahTidakDiganti}
              onChange={(e) => {
                const val = e.target.value;
                const num = parseFloat(val) || 0;
                const digantiNum = parseFloat(penggantianForm.jumlahZAK) || 0;
                if (penggantianForm.maxJumlah > 0 && num > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianTidakDiganti: `Jumlah tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
                } else if (penggantianForm.maxJumlah > 0 && num + digantiNum > penggantianForm.maxJumlah) {
                  setErrors((prev) => ({ ...prev, penggantianTotal: `Total diganti + tidak diganti tidak boleh melebihi sisa ${penggantianForm.maxJumlah}` }));
                } else {
                  setErrors((prev) => { const n = { ...prev }; delete n.penggantianTidakDiganti; delete n.penggantianTotal; return n; });
                }
                setPenggantianForm((prev) => ({ ...prev, jumlahTidakDiganti: val }));
              }}
              placeholder="0"
              error={errors.penggantianTidakDiganti || errors.penggantianTotal}
            />
          </div>

          <div className="space-y-2">
            <label className="relative cursor-pointer inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-xs font-medium">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tambah Foto Penggantian
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePenggantianFotoUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={fotoLoading}
              />
            </label>
            {fotoLoading && (
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Memproses...
              </span>
            )}
            {penggantianForm.fotoUrls.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {penggantianForm.fotoUrls.map((foto, idx) => (
                  <div key={idx} className="relative group">
                    <img src={foto} alt={`Penggantian ${idx + 1}`} className="w-full h-20 object-cover rounded border border-gray-200" />
                    <button
                      type="button"
                      onClick={() => removePenggantianFoto(idx)}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {errors.penggantian && <p className="text-sm text-red-600">{errors.penggantian}</p>}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => {
              setPenggantianForm({
                transaksiId: "",
                rusakIndex: 0,
                tanggal: new Date().toISOString().split("T")[0],
                jumlahZAK: "",
                jumlahTidakDiganti: "",
                fotoUrls: [],
                maxJumlah: 0,
                unitRusak: "ZAK",
              });
              setErrors({});
            }}>
              Reset
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Simpan Penggantian
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
