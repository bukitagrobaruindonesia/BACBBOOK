"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, doc, updateDoc, serverTimestamp } from "firebase/firestore";
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
  hargaPerZakDus: number;
  bobotPerUnit: number;
  jumlahIsiBotol: number;
  totalHarga: number;
  includePPN?: boolean;
  ppnNominal?: number;
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
  statusPemesanan?: string;
  statusPelunasan?: string;
  jumlahUangDibayar?: number;
  tanggalPembayaran?: string;
  cc?: string;
}

const formatRupiah = (num: number) => {
  if (!num && num !== 0) return "Rp -";
  return "Rp " + num.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

export default function PembatalanPemesananPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<ProformaInvoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedItem, setSelectedItem] = useState<ProformaInvoice | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const q = query(collection(db, "proformaInvoice"), orderBy("updatedAt", "desc"));
      const snapshot = await getDocs(q);
      const items = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          tanggal: d.tanggal || "",
          nomorPI: d.nomorPI || "",
          namaCustomer: d.namaCustomer || "",
          alamatCustomer: d.alamatCustomer || "",
          npwp: d.npwp || "",
          metodePembayaran: d.metodePembayaran || "Transfer",
          produkItems: d.produkItems || [],
          uangMuka: d.uangMuka || 0,
          includePPN: d.includePPN || false,
          ppnNominal: d.ppnNominal || 0,
          ongkosKirim: d.ongkosKirim || 0,
          subtotal: d.subtotal || 0,
          jumlahTertagih: d.jumlahTertagih || 0,
          terbilang: d.terbilang || "",
          tanggalJatuhTempo: d.tanggalJatuhTempo || "",
          keterangan: d.keterangan || "",
          ttdNama: d.ttdNama || "",
          ttdJabatan: d.ttdJabatan || "",
          ttdImage: d.ttdImage || "",
          createdBy: d.createdBy || "",
          createdAt: d.createdAt?.toDate(),
          updatedAt: d.updatedAt?.toDate(),
          statusPemesanan: d.statusPemesanan || "Aktif",
          statusPelunasan: d.statusPelunasan || "Belum Lunas",
          jumlahUangDibayar: d.jumlahUangDibayar || 0,
          tanggalPembayaran: d.tanggalPembayaran || "",
          cc: d.cc || "",
        } as ProformaInvoice;
      }).filter((item) => item.statusPemesanan === "Batal");
      setData(items);
    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  const handleRestore = async (item: ProformaInvoice) => {
    if (!confirm("Apakah Anda yakin ingin mengaktifkan kembali pemesanan ini?")) return;
    setIsRestoring(true);
    try {
      await updateDoc(doc(db, "proformaInvoice", item.id), {
        statusPemesanan: "Aktif",
        updatedAt: serverTimestamp(),
      });
      fetchData();
    } catch (error) { console.error(error); alert("Gagal mengaktifkan kembali pemesanan."); } finally { setIsRestoring(false); }
  };

  const handleDetail = (item: ProformaInvoice) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleExportExcel = () => {
    const exportData = filteredData.map((item) => ({
      "Tanggal PI": item.tanggal,
      "Nomor PI": item.nomorPI,
      "Nama Customer": item.namaCustomer,
      "Alamat": item.alamatCustomer,
      "NPWP": item.npwp || "",
      "Metode Pembayaran": item.metodePembayaran,
      "Subtotal": item.subtotal,
      "Total PPN": item.ppnNominal,
      "Uang Muka": item.uangMuka || 0,
      "Ongkos Kirim": item.ongkosKirim || 0,
      "Jumlah Tertagih": item.jumlahTertagih,
      "Terbilang": item.terbilang,
      "Jatuh Tempo": item.tanggalJatuhTempo,
      "Keterangan": item.keterangan,
      "Status Pelunasan": item.statusPelunasan || "Belum Lunas",
      "Jumlah Dibayar": item.jumlahUangDibayar || 0,
      "Tanggal Pembayaran": item.tanggalPembayaran || "",
      "Dibuat Oleh": item.createdBy,
      "Produk Count": item.produkItems.length,
      "Status Pemesanan": item.statusPemesanan || "Batal",
    }));
    exportToExcel(exportData, `Pembatalan_Pemesanan_${new Date().toISOString().split("T")[0]}`, "Pembatalan Pemesanan");
  };

  const filteredData = data.filter((item) => {
    return item.nomorPI?.toLowerCase().includes(searchTerm.toLowerCase()) || item.namaCustomer?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const columns = [
    { key: "tanggal", header: "Tanggal", width: "120px", render: (row: ProformaInvoice) => <span className="font-medium text-gray-800">{row.tanggal}</span> },
    { key: "nomorPI", header: "Nomor PI", width: "150px", render: (row: ProformaInvoice) => <span className="font-semibold text-green-700">{row.nomorPI}</span> },
    { key: "namaCustomer", header: "Customer", render: (row: ProformaInvoice) => row.namaCustomer },
    { key: "jumlahTertagih", header: "Jumlah", width: "160px", render: (row: ProformaInvoice) => <span className="font-mono font-medium text-gray-900">{formatRupiah(row.jumlahTertagih)}</span> },
    { key: "statusPelunasan", header: "Status Pelunasan", width: "140px", render: (row: ProformaInvoice) => <span className={`px-2 py-1 rounded-md text-xs font-bold border ${row.statusPelunasan === "Lunas" ? "bg-green-100 text-green-700 border-green-200" : row.statusPelunasan === "Cicilan" ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-red-100 text-red-700 border-red-200"}`}>{row.statusPelunasan || "Belum Lunas"}</span> },
    { key: "aksi", header: "Aksi", width: "140px", render: (row: ProformaInvoice) => (
      <div className="flex items-center gap-2">
        <button onClick={(e) => { e.stopPropagation(); handleDetail(row); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Detail"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
        <button onClick={(e) => { e.stopPropagation(); handleRestore(row); }} disabled={isRestoring} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Aktifkan Kembali"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-6">
      <Header title="Pembatalan Pemesanan" subtitle="Daftar proforma invoice yang telah dibatalkan" />
      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Cari nomor PI, customer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 focus:scale-[1.02] focus:shadow-lg focus:z-20 focus:relative focus:border-green-500 focus:ring-2 focus:ring-green-200" />
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleExportExcel}>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Export Excel
            </Button>
          </div>
        </div>
        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredData.length} dari {data.length} data pembatalan
        </div>
        <Table columns={columns} data={filteredData} isLoading={isLoading} emptyMessage="Belum ada data pembatalan pemesanan" keyExtractor={(row) => row.id} onRowClick={handleDetail} />
      </Card>

      <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Detail Pembatalan Pemesanan" size="lg" footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setIsDetailModalOpen(false)}>Tutup</Button>
          {selectedItem && <Button variant="primary" onClick={() => handleRestore(selectedItem)} disabled={isRestoring} isLoading={isRestoring}>Aktifkan Kembali</Button>}
        </div>
      }>
        {selectedItem && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Nomor PI</p><p className="text-lg font-bold text-green-700">{selectedItem.nomorPI}</p></div>
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Tanggal</p><p className="text-lg font-bold text-gray-800">{selectedItem.tanggal}</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Customer</p><p className="font-semibold text-gray-800">{selectedItem.namaCustomer}</p><p className="text-sm text-gray-600 mt-1">{selectedItem.alamatCustomer}</p>{selectedItem.npwp && <p className="text-sm text-gray-600 mt-1">NPWP: {selectedItem.npwp}</p>}{selectedItem.cc && <p className="text-sm text-gray-600 mt-1">CC: {selectedItem.cc}</p>}</div>
              <div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide">Metode Pembayaran</p><p className="font-semibold text-gray-800">{selectedItem.metodePembayaran}</p><p className="text-xs text-gray-500 uppercase tracking-wide mt-3">Jatuh Tempo</p><p className="font-semibold text-red-600">{selectedItem.tanggalJatuhTempo}</p></div>
            </div>
            <div className="p-4 bg-red-50 rounded-xl border border-red-200"><p className="text-xs text-red-600 uppercase tracking-wide font-semibold mb-2">Status Pemesanan</p><span className="px-3 py-1.5 rounded-lg text-sm font-bold bg-red-100 text-red-700">Batal</span></div>
            <div className="overflow-x-auto"><table className="w-full"><thead><tr className="bg-green-50"><th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">No</th><th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Produk</th><th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">FOT</th><th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase">Produsen</th><th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Kuantitas</th><th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Harga</th><th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Harga/ZAK</th><th className="px-4 py-3 text-right text-xs font-semibold text-green-800 uppercase">Total</th></tr></thead><tbody className="divide-y divide-gray-100">{(selectedItem.produkItems || []).map((p, idx) => (<tr key={idx}><td className="px-4 py-3 text-sm text-gray-900">{idx + 1}</td><td className="px-4 py-3 text-sm font-medium text-gray-900">{p.namaProduk}</td><td className="px-4 py-3 text-sm text-gray-600">{p.fot}</td><td className="px-4 py-3 text-sm text-gray-600">{p.produsen || "-"}</td><td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{p.kuantitas?.toLocaleString("id-ID")} {p.satuan}</td><td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{formatRupiah(p.hargaSatuan)}</td><td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">{formatRupiah(p.hargaPerZakDus)}</td><td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right font-mono">{formatRupiah(p.totalHarga)}</td></tr>))}</tbody></table></div>
            <div className="grid grid-cols-2 gap-4"><div className="p-4 bg-gray-50 rounded-xl"><p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Terbilang</p><p className="text-sm font-semibold text-gray-800 uppercase">{selectedItem.terbilang}</p></div><div className="p-4 bg-green-50 rounded-xl border border-green-100"><div className="flex justify-between py-1"><span className="text-sm text-gray-600">Subtotal</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.subtotal)}</span></div>{selectedItem.includePPN && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">PPN 11%</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ppnNominal)}</span></div>}{(selectedItem.uangMuka || 0) > 0 && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">Uang Muka</span><span className="text-sm font-mono font-medium text-red-600">- {formatRupiah(selectedItem.uangMuka)}</span></div>}{(selectedItem.ongkosKirim || 0) > 0 && <div className="flex justify-between py-1"><span className="text-sm text-gray-600">Ongkos Kirim</span><span className="text-sm font-mono font-medium">{formatRupiah(selectedItem.ongkosKirim)}</span></div>}<div className="flex justify-between py-2 border-t border-green-200 mt-2"><span className="text-base font-bold text-green-800">Jumlah Tertagih</span><span className="text-lg font-mono font-bold text-green-700">{formatRupiah(selectedItem.jumlahTertagih)}</span></div></div></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
