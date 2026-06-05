"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, addDoc } from "firebase/firestore";
import { db } from "@/app/lib/firebase";
import Header from "@/app/components/ui/Header";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";
import Modal from "@/app/components/ui/Modal";
import Input from "@/app/components/ui/Input";

interface CustomerData {
  id: string;
  customerId: string;
  namaCustomer: string;
  alamatCustomer: string;
  npwp: string;
  createdAt: any;
  updatedAt: any;
}

interface ProformaInvoiceData {
  id: string;
  namaCustomer: string;
  produkItems: Array<{
    namaProduk: string;
    kuantitas: number;
    satuan: string;
  }>;
  nomorPI: string;
  createdAt: any;
}

interface CustomerAggregate {
  customer: CustomerData;
  produkDipesan: string[];
  totalBarang: number;
  nomorPIList: string[];
  tanggalPembuatan: string;
}

export default function RiwayatCustomerPage() {
  const [customerList, setCustomerList] = useState<CustomerData[]>([]);
  const [piList, setPiList] = useState<ProformaInvoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newCustomerNpwp, setNewCustomerNpwp] = useState("");
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editCustomerNpwp, setEditCustomerNpwp] = useState("");
  const [editCustomerId, setEditCustomerId] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [customerSnap, piSnap] = await Promise.all([
        getDocs(query(collection(db, "customers"), orderBy("namaCustomer", "asc"))),
        getDocs(query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc"))),
      ]);

      const customers = customerSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate(),
      } as CustomerData));

      const pis = piSnap.docs.map((doc) => ({
        id: doc.id,
        namaCustomer: doc.data().namaCustomer || "",
        produkItems: doc.data().produkItems || [],
        nomorPI: doc.data().nomorPI || "",
        createdAt: doc.data().createdAt?.toDate(),
      } as ProformaInvoiceData));

      setCustomerList(customers);
      setPiList(pis);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const getCustomerAggregate = (customer: CustomerData): CustomerAggregate => {
    const customerPIs = piList.filter((pi) => pi.namaCustomer.trim().toLowerCase() === customer.namaCustomer.trim().toLowerCase());
    const produkSet = new Set<string>();
    let totalBarang = 0;
    const nomorPIList: string[] = [];
    let tanggalPembuatan = "-";

    customerPIs.forEach((pi) => {
      if (pi.nomorPI && !nomorPIList.includes(pi.nomorPI)) nomorPIList.push(pi.nomorPI);
      pi.produkItems?.forEach((item) => {
        if (item.namaProduk) produkSet.add(item.namaProduk);
        totalBarang += Number(item.kuantitas) || 0;
      });
      if (pi.createdAt && tanggalPembuatan === "-") {
        tanggalPembuatan = pi.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
      }
    });

    if (customer.createdAt && tanggalPembuatan === "-") {
      tanggalPembuatan = customer.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
    }

    return {
      customer,
      produkDipesan: Array.from(produkSet),
      totalBarang,
      nomorPIList,
      tanggalPembuatan,
    };
  };

  const filteredCustomers = customerList.filter((c) => {
    const agg = getCustomerAggregate(c);
    const term = searchTerm.toLowerCase();
    return (
      c.namaCustomer.toLowerCase().includes(term) ||
      c.alamatCustomer.toLowerCase().includes(term) ||
      c.customerId?.toLowerCase().includes(term) ||
      c.npwp?.toLowerCase().includes(term) ||
      agg.produkDipesan.some((p) => p.toLowerCase().includes(term)) ||
      agg.nomorPIList.some((n) => n.toLowerCase().includes(term))
    );
  });

  const generateCustomerId = async (): Promise<string> => {
    try {
      const q = query(collection(db, "customers"), orderBy("customerId", "asc"));
      const snapshot = await getDocs(q);
      const ids = snapshot.docs
        .map((d) => d.data().customerId)
        .filter((id): id is string => typeof id === "string" && id.startsWith("BAGB-CS-"))
        .map((id) => parseInt(id.replace("BAGB-CS-", ""), 10))
        .filter((n) => !isNaN(n))
        .sort((a, b) => a - b);

      if (ids.length === 0) return "BAGB-CS-001";

      let nextId = 1;
      for (const id of ids) {
        if (id !== nextId) {
          return `BAGB-CS-${String(nextId).padStart(3, "0")}`;
        }
        nextId++;
      }
      return `BAGB-CS-${String(nextId).padStart(3, "0")}`;
    } catch (error) {
      console.error(error);
      return "BAGB-CS-001";
    }
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerAddress.trim()) return;
    try {
      const customerId = await generateCustomerId();
      await addDoc(collection(db, "customers"), {
        customerId,
        namaCustomer: newCustomerName.trim(),
        alamatCustomer: newCustomerAddress.trim(),
        npwp: newCustomerNpwp.trim() || "",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewCustomerName("");
      setNewCustomerAddress("");
      setNewCustomerNpwp("");
      setIsAddModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditCustomer = (customer: CustomerData) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.namaCustomer);
    setEditCustomerAddress(customer.alamatCustomer);
    setEditCustomerNpwp(customer.npwp || "");
    setEditCustomerId(customer.customerId || "");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer || !editCustomerName.trim() || !editCustomerAddress.trim()) return;
    try {
      await updateDoc(doc(db, "customers", editingCustomer.id), {
        namaCustomer: editCustomerName.trim(),
        alamatCustomer: editCustomerAddress.trim(),
        npwp: editCustomerNpwp.trim(),
        customerId: editCustomerId.trim() || editingCustomer.customerId,
        updatedAt: serverTimestamp(),
      });
      setEditingCustomer(null);
      setEditCustomerName("");
      setEditCustomerAddress("");
      setEditCustomerNpwp("");
      setEditCustomerId("");
      setIsEditModalOpen(false);
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus customer ini?")) return;
    try {
      await deleteDoc(doc(db, "customers", id));
      fetchData();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-6">
      <Header title="Riwayat Customer" subtitle="Kelola daftar customer dan riwayat pemesanan" />

      <Card>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-96">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Cari nama, alamat, ID, produk, atau nomor PI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Customer
          </Button>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredCustomers.length} dari {customerList.length} customer
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-green-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-16">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Customer ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Nama Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Alamat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">NPWP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Tanggal</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Produk Dipesan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Total Barang</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Nomor PI</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase tracking-wider w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((customer, index) => {
                  const agg = getCustomerAggregate(customer);
                  return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {customer.customerId || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{customer.namaCustomer}</span>
                          <button
                            onClick={() => handleCopyToClipboard(customer.namaCustomer)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy nama"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 max-w-xs truncate">{customer.alamatCustomer}</span>
                          <button
                            onClick={() => handleCopyToClipboard(customer.alamatCustomer)}
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
                            title="Copy alamat"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.npwp || "-"}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{agg.tanggalPembuatan}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {agg.produkDipesan.length > 0 ? agg.produkDipesan.map((p, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              {p}
                            </span>
                          )) : <span className="text-sm text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{agg.totalBarang > 0 ? agg.totalBarang.toLocaleString("id-ID") : "-"}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {agg.nomorPIList.length > 0 ? agg.nomorPIList.map((n, i) => (
                            <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              {n}
                            </span>
                          )) : <span className="text-sm text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleEditCustomer(customer)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(customer.id)}
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
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center">
                      <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <p className="text-sm text-gray-500">Belum ada data customer</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setNewCustomerName(""); setNewCustomerAddress(""); setNewCustomerNpwp(""); }}
        title="Tambah Customer Baru"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsAddModalOpen(false); setNewCustomerName(""); setNewCustomerAddress(""); setNewCustomerNpwp(""); }}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleAddCustomer} disabled={!newCustomerName.trim() || !newCustomerAddress.trim()}>
              Simpan
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nama Customer"
            type="text"
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            placeholder="Masukkan nama customer"
            required
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Alamat Customer <span className="text-red-500">*</span>
            </label>
            <textarea
              value={newCustomerAddress}
              onChange={(e) => setNewCustomerAddress(e.target.value)}
              rows={3}
              placeholder="Masukkan alamat lengkap customer"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none"
            />
          </div>
          <Input
            label="NPWP (Opsional)"
            type="text"
            value={newCustomerNpwp}
            onChange={(e) => setNewCustomerNpwp(e.target.value)}
            placeholder="Contoh: 123456789012345"
          />
        </div>
      </Modal>

      <Modal
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingCustomer(null); }}
        title="Edit Customer"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingCustomer(null); }}>
              Batal
            </Button>
            <Button variant="primary" onClick={handleSaveEdit} disabled={!editCustomerName.trim() || !editCustomerAddress.trim()}>
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Customer ID"
            type="text"
            value={editCustomerId}
            onChange={(e) => setEditCustomerId(e.target.value)}
            placeholder="Contoh: BAGB-CS-001"
          />
          <Input
            label="Nama Customer"
            type="text"
            value={editCustomerName}
            onChange={(e) => setEditCustomerName(e.target.value)}
            placeholder="Masukkan nama customer"
            required
          />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Alamat Customer <span className="text-red-500">*</span>
            </label>
            <textarea
              value={editCustomerAddress}
              onChange={(e) => setEditCustomerAddress(e.target.value)}
              rows={3}
              placeholder="Masukkan alamat lengkap customer"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none"
            />
          </div>
          <Input
            label="NPWP (Opsional)"
            type="text"
            value={editCustomerNpwp}
            onChange={(e) => setEditCustomerNpwp(e.target.value)}
            placeholder="Contoh: 123456789012345"
          />
        </div>
      </Modal>
    </div>
  );
}