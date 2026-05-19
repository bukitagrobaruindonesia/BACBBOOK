"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";

interface HargaItem {
  id: string;
  kodeBarang: string;
  namaProduk: string;
  jenisProduk: string;
  jenisUnit: "ZAK" | "BOTOL";
  hargaPerKg?: number;
  hargaPerZak?: number;
  hargaPerLiter?: number;
  hargaPerDus?: number;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export default function DaftarHargaPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<HargaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUnit, setFilterUnit] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "daftarHarga"), orderBy("kodeBarang", "asc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as HargaItem));
      setData(items);
    } catch (error) {
      console.error(error);
      alert("Gagal memuat data harga!");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus data harga ini?")) return;
    try {
      await deleteDoc(doc(db, "daftarHarga", id));
      alert("Data harga berhasil dihapus!");
      fetchData();
    } catch (error) {
      alert("Gagal menghapus data!");
      console.error(error);
    }
  };

  const formatRupiah = (value: number | undefined) => {
    if (value === undefined || value === null) return "-";
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const filteredData = data.filter((item) => {
    const matchSearch =
      item.kodeBarang.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.namaProduk.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.jenisProduk.toLowerCase().includes(searchTerm.toLowerCase());
    const matchUnit = filterUnit ? item.jenisUnit === filterUnit : true;
    return matchSearch && matchUnit;
  });

  const unitBadgeClass = (unit: string) => {
    if (unit === "ZAK") return "bg-blue-100 text-blue-700 border-blue-200";
    return "bg-pink-100 text-pink-700 border-pink-200";
  };

  return (
    <div className="space-y-6">
      <Header
        title="Daftar Harga Produk"
        subtitle="Lihat dan kelola harga produk pupuk"
      />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => router.push("/dashboard/input-harga")}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Input Harga Baru
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push("/")}
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Lihat Tampilan Publik
          </Button>
        </div>
        <div className="text-sm text-gray-500">
          Total {filteredData.length} produk
        </div>
      </div>

      <Card>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari kode, nama, atau jenis produk..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white min-w-[150px]"
          >
            <option value="">Semua Unit</option>
            <option value="ZAK">ZAK</option>
            <option value="BOTOL">BOTOL</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-700"></div>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-gray-400">
            <svg className="w-16 h-16 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="font-medium text-lg">Belum ada data harga produk</p>
            <p className="text-sm mt-1">Silakan input harga produk terlebih dahulu</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-3 font-bold text-gray-700 uppercase text-xs tracking-wider">Kode</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 uppercase text-xs tracking-wider">Nama Produk</th>
                  <th className="text-left py-3 px-3 font-bold text-gray-700 uppercase text-xs tracking-wider">Jenis</th>
                  <th className="text-center py-3 px-3 font-bold text-gray-700 uppercase text-xs tracking-wider">Unit</th>
                  <th className="text-right py-3 px-3 font-bold text-gray-700 uppercase text-xs tracking-wider">Harga per Unit Kecil</th>
                  <th className="text-right py-3 px-3 font-bold text-gray-700 uppercase text-xs tracking-wider">Harga per Unit Besar</th>
                  <th className="text-center py-3 px-3 font-bold text-gray-700 uppercase text-xs tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3">
                      <span className="font-mono font-semibold text-green-700 bg-green-50 px-2 py-1 rounded text-xs">
                        {item.kodeBarang}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-gray-800">{item.namaProduk}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-gray-600">{item.jenisProduk || "-"}</span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold border ${unitBadgeClass(item.jenisUnit)}`}>
                        {item.jenisUnit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-mono font-semibold text-gray-800">
                        {item.jenisUnit === "ZAK"
                          ? formatRupiah(item.hargaPerKg)
                          : formatRupiah(item.hargaPerLiter)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.jenisUnit === "ZAK" ? "per KG" : "per Liter"}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="font-mono font-semibold text-green-700">
                        {item.jenisUnit === "ZAK"
                          ? formatRupiah(item.hargaPerZak)
                          : formatRupiah(item.hargaPerDus)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.jenisUnit === "ZAK" ? "per ZAK" : "per Dus"}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/input-harga?id=${item.id}`)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus"
                        >
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
      </Card>
    </div>
  );
}