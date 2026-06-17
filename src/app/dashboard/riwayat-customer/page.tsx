"use client";

import React, { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, serverTimestamp, addDoc, runTransaction, onSnapshot } from "firebase/firestore";
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

interface ProdukItemPI {
  namaProduk: string;
  kuantitas: number;
  satuan: string;
}

interface ProformaInvoiceData {
  id: string;
  namaCustomer: string;
  produkItems: ProdukItemPI[];
  nomorPI: string;
  tanggal: string;
  createdAt: any;
  statusPemesanan?: string;
}

interface PIDetail {
  nomorPI: string;
  tanggal: string;
  items: ProdukItemPI[];
}

interface CustomerRow {
  customer: CustomerData;
  piList: PIDetail[];
  tanggalRegistrasi: string;
}

const CUSTOMER_COUNTER_REF = doc(db, "counters", "customerCounter");

export default function RiwayatCustomerPage() {
  const [customerList, setCustomerList] = useState<CustomerData[]>([]);
  const [piList, setPiList] = useState<ProformaInvoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTahun, setFilterTahun] = useState("");
  const [filterBulan, setFilterBulan] = useState("");
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
  const [editCustomerIdError, setEditCustomerIdError] = useState("");
  const [addCustomerIdError, setAddCustomerIdError] = useState("");

  useEffect(() => {
    const unsubscribeCustomers = onSnapshot(
      query(collection(db, "customers"), orderBy("namaCustomer", "asc")),
      (snapshot) => {
        const customers = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          updatedAt: doc.data().updatedAt?.toDate(),
        } as CustomerData));
        setCustomerList(customers);
      },
      (error) => console.error(error)
    );

    const unsubscribePI = onSnapshot(
      query(collection(db, "proformaInvoice"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const pis = snapshot.docs.map((doc) => ({
          id: doc.id,
          namaCustomer: doc.data().namaCustomer || "",
          produkItems: doc.data().produkItems || [],
          nomorPI: doc.data().nomorPI || "",
          tanggal: doc.data().tanggal || "",
          statusPemesanan: doc.data().statusPemesanan || "Aktif",
          createdAt: doc.data().createdAt?.toDate(),
        } as ProformaInvoiceData));
        setPiList(pis);
        setIsLoading(false);
      },
      (error) => {
        console.error(error);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeCustomers();
      unsubscribePI();
    };
  }, []);

  const fetchData = () => {
    // Real-time update handled by onSnapshot
  };


const getCustomerRows = (): CustomerRow[] => {
    return customerList.map((customer) => {
      let customerPIs = piList.filter((pi) => pi.namaCustomer.trim().toLowerCase() === customer.namaCustomer.trim().toLowerCase());
      if (filterTahun) {
        customerPIs = customerPIs.filter((pi) => {
          if (!pi.tanggal) return false;
          const d = new Date(pi.tanggal);
          return String(d.getFullYear()) === filterTahun;
        });
      }
      if (filterBulan) {
        customerPIs = customerPIs.filter((pi) => {
          if (!pi.tanggal) return false;
          const d = new Date(pi.tanggal);
          return String(d.getMonth() + 1) === filterBulan;
        });
      }
      const piDetails: PIDetail[] = customerPIs.map((pi) => ({
        nomorPI: pi.nomorPI,
        tanggal: pi.tanggal ? new Date(pi.tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-",
        items: pi.produkItems?.map((item) => ({
          namaProduk: item.namaProduk || "",
          kuantitas: Number(item.kuantitas) || 0,
          satuan: item.satuan || "",
        })) || [],
      }));
      const tanggalRegistrasi = customer.createdAt
        ? customer.createdAt.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "-";
      return { customer, piList: piDetails, tanggalRegistrasi };
    });
  };

  const tahunOptions = Array.from(new Set(piList.map((pi) => pi.tanggal ? new Date(pi.tanggal).getFullYear() : null).filter((y): y is number => y !== null))).sort((a, b) => b - a);
  const bulanOptions = [
    { value: "1", label: "Januari" },
    { value: "2", label: "Februari" },
    { value: "3", label: "Maret" },
    { value: "4", label: "April" },
    { value: "5", label: "Mei" },
    { value: "6", label: "Juni" },
    { value: "7", label: "Juli" },
    { value: "8", label: "Agustus" },
    { value: "9", label: "September" },
    { value: "10", label: "Oktober" },
    { value: "11", label: "November" },
    { value: "12", label: "Desember" },
  ];

  const filteredRows = getCustomerRows().filter((row) => {
    const term = searchTerm.toLowerCase();
    const c = row.customer;
    const piMatch = row.piList.some((pi) =>
      pi.nomorPI.toLowerCase().includes(term) ||
      pi.items.some((item) => item.namaProduk.toLowerCase().includes(term))
    );
    return (
      c.namaCustomer.toLowerCase().includes(term) ||
      c.alamatCustomer.toLowerCase().includes(term) ||
      c.customerId?.toLowerCase().includes(term) ||
      c.npwp?.toLowerCase().includes(term) ||
      piMatch
    );
  });

  const getUniqueCustomerId = async (): Promise<string> => {
    const maxRetries = 10;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(CUSTOMER_COUNTER_REF);
          let lastNum = 0;
          if (counterDoc.exists()) {
            lastNum = counterDoc.data().lastNumber || 0;
          }
          let candidateNum = lastNum + 1;
          let candidateId = `BAGB-CS-${String(candidateNum).padStart(3, "0")}`;
          const idRef = doc(db, "customerIdLocks", candidateId);
          const idDoc = await transaction.get(idRef);
          if (idDoc.exists()) {
            let searchNum = candidateNum + 1;
            let found = false;
            while (searchNum <= candidateNum + 100 && !found) {
              const testId = `BAGB-CS-${String(searchNum).padStart(3, "0")}`;
              const testRef = doc(db, "customerIdLocks", testId);
              const testDoc = await transaction.get(testRef);
              if (!testDoc.exists()) {
                candidateNum = searchNum;
                candidateId = testId;
                found = true;
              }
              searchNum++;
            }
            if (!found) {
              throw new Error("No available customer ID found");
            }
          }
          transaction.set(idRef, { createdAt: serverTimestamp(), used: true });
          transaction.set(CUSTOMER_COUNTER_REF, { lastNumber: candidateNum });
          return candidateId;
        });
        return result;
      } catch (error: any) {
        if (attempt === maxRetries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
      }
    }
    throw new Error("Failed to generate unique customer ID after retries");
  };

  const handleAddCustomer = async () => {
    if (!newCustomerName.trim() || !newCustomerAddress.trim()) return;
    setAddCustomerIdError("");
    try {
      const customerId = await getUniqueCustomerId();
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
    } catch (error: any) {
      setAddCustomerIdError("Gagal menyimpan. ID mungkin sedang digunakan akun lain. Silakan coba lagi.");
    }
  };

  const handleEditCustomer = (customer: CustomerData) => {
    setEditingCustomer(customer);
    setEditCustomerName(customer.namaCustomer);
    setEditCustomerAddress(customer.alamatCustomer);
    setEditCustomerNpwp(customer.npwp || "");
    setEditCustomerId(customer.customerId || "");
    setEditCustomerIdError("");
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingCustomer || !editCustomerName.trim() || !editCustomerAddress.trim()) return;
    const newId = editCustomerId.trim().toUpperCase();
    const oldId = editingCustomer.customerId?.trim().toUpperCase() || "";
    setEditCustomerIdError("");

    if (newId && newId !== oldId) {
      try {
        await runTransaction(db, async (transaction) => {
          const lockRef = doc(db, "customerIdLocks", newId);
          const lockDoc = await transaction.get(lockRef);
          if (lockDoc.exists()) {
            throw new Error("Customer ID sudah digunakan oleh customer lain");
          }
          const customerRef = doc(db, "customers", editingCustomer.id);
          const customerDoc = await transaction.get(customerRef);
          if (!customerDoc.exists()) {
            throw new Error("Customer tidak ditemukan");
          }
          transaction.set(lockRef, { createdAt: serverTimestamp(), used: true });
          transaction.update(customerRef, {
            namaCustomer: editCustomerName.trim(),
            alamatCustomer: editCustomerAddress.trim(),
            npwp: editCustomerNpwp.trim(),
            customerId: newId,
            updatedAt: serverTimestamp(),
          });
        });
      } catch (error: any) {
        setEditCustomerIdError(error.message || "Gagal menyimpan, ID mungkin sedang digunakan akun lain");
        return;
      }
    } else {
      try {
        await updateDoc(doc(db, "customers", editingCustomer.id), {
          namaCustomer: editCustomerName.trim(),
          alamatCustomer: editCustomerAddress.trim(),
          npwp: editCustomerNpwp.trim(),
          customerId: newId || oldId,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        setEditCustomerIdError("Gagal menyimpan perubahan");
        return;
      }
    }

    setEditingCustomer(null);
    setEditCustomerName("");
    setEditCustomerAddress("");
    setEditCustomerNpwp("");
    setEditCustomerId("");
    setEditCustomerIdError("");
    setIsEditModalOpen(false);
    fetchData();
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
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-72">
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
            <div className="flex items-center gap-2">
              <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white">
                <option value="">Semua Tahun</option>
                {tahunOptions.map((t) => (<option key={t} value={String(t)}>{t}</option>))}
              </select>
              <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="px-3 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white">
                <option value="">Semua Bulan</option>
                {bulanOptions.map((b) => (<option key={b.value} value={b.value}>{b.label}</option>))}
              </select>
              {(filterTahun || filterBulan) && (
                <button onClick={() => { setFilterTahun(""); setFilterBulan(""); }} className="px-3 py-3 text-sm text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-red-200">
                  Reset
                </button>
              )}
            </div>
          </div>
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Customer
          </Button>
        </div>

        <div className="text-sm text-gray-500 mb-4">
          Menampilkan {filteredRows.length} dari {customerList.length} customer
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider w-12">No</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Customer ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Nama Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Alamat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">NPWP</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Tanggal Registrasi</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-green-800 uppercase tracking-wider">Riwayat Pemesanan</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-green-800 uppercase tracking-wider w-40">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row, index) => (
                  <tr key={row.customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-gray-900 align-top">{index + 1}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {row.customer.customerId || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{row.customer.namaCustomer}</span>
                        <button onClick={() => handleCopyToClipboard(row.customer.namaCustomer)} className="text-gray-400 hover:text-gray-600 transition-colors" title="Copy nama">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 max-w-xs truncate">{row.customer.alamatCustomer}</span>
                        <button onClick={() => handleCopyToClipboard(row.customer.alamatCustomer)} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0" title="Copy alamat">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 align-top">{row.customer.npwp || "-"}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 align-top">{row.tanggalRegistrasi}</td>
                    <td className="px-4 py-3 align-top">
                      {row.piList.length > 0 ? (
                        <div className="space-y-3">
                          {row.piList.map((pi, piIdx) => (
                            <div key={piIdx} className="bg-gray-50 rounded-lg p-2.5 border border-gray-100">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">
                                  {pi.nomorPI}
                                </span>
                                <span className="text-xs text-gray-500">{pi.tanggal}</span>
                              </div>
                              <div className="space-y-0.5">
                                {pi.items.map((item, itemIdx) => (
                                  <div key={itemIdx} className="flex items-center gap-1.5 text-xs">
                                    <span className="w-1 h-1 rounded-full bg-green-500 flex-shrink-0"></span>
                                    <span className="text-gray-700 font-medium">{item.namaProduk}</span>
                                    <span className="text-gray-500">:</span>
                                    <span className="text-gray-900 font-semibold">{item.kuantitas.toLocaleString("id-ID")} {item.satuan}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Belum ada pemesanan</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEditCustomer(row.customer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button onClick={() => handleDeleteCustomer(row.customer.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
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

      <Modal isOpen={isAddModalOpen} onClose={() => { setIsAddModalOpen(false); setNewCustomerName(""); setNewCustomerAddress(""); setNewCustomerNpwp(""); setAddCustomerIdError(""); }} title="Tambah Customer Baru" size="md" footer={<div className="flex justify-end gap-3"><Button variant="outline" onClick={() => { setIsAddModalOpen(false); setNewCustomerName(""); setNewCustomerAddress(""); setNewCustomerNpwp(""); setAddCustomerIdError(""); }}>Batal</Button><Button variant="primary" onClick={handleAddCustomer} disabled={!newCustomerName.trim() || !newCustomerAddress.trim()}>Simpan</Button></div>}>
        <div className="space-y-4">
          {addCustomerIdError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {addCustomerIdError}
            </div>
          )}
          <Input label="Nama Customer" type="text" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Masukkan nama customer" required />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alamat Customer <span className="text-red-500">*</span></label>
            <textarea value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} rows={3} placeholder="Masukkan alamat lengkap customer" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none" />
          </div>
          <Input label="NPWP (Opsional)" type="text" value={newCustomerNpwp} onChange={(e) => setNewCustomerNpwp(e.target.value)} placeholder="Contoh: 123456789012345" />
        </div>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => { setIsEditModalOpen(false); setEditingCustomer(null); setEditCustomerIdError(""); }} title="Edit Customer" size="md" footer={<div className="flex justify-end gap-3"><Button variant="outline" onClick={() => { setIsEditModalOpen(false); setEditingCustomer(null); setEditCustomerIdError(""); }}>Batal</Button><Button variant="primary" onClick={handleSaveEdit} disabled={!editCustomerName.trim() || !editCustomerAddress.trim()}>Simpan Perubahan</Button></div>}>
        <div className="space-y-4">
          <Input label="Customer ID" type="text" value={editCustomerId} onChange={(e) => { setEditCustomerId(e.target.value); setEditCustomerIdError(""); }} placeholder="Contoh: BAGB-CS-001" error={editCustomerIdError} />
          <Input label="Nama Customer" type="text" value={editCustomerName} onChange={(e) => setEditCustomerName(e.target.value)} placeholder="Masukkan nama customer" required />
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Alamat Customer <span className="text-red-500">*</span></label>
            <textarea value={editCustomerAddress} onChange={(e) => setEditCustomerAddress(e.target.value)} rows={3} placeholder="Masukkan alamat lengkap customer" className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white resize-none" />
          </div>
          <Input label="NPWP (Opsional)" type="text" value={editCustomerNpwp} onChange={(e) => setEditCustomerNpwp(e.target.value)} placeholder="Contoh: 123456789012345" />
        </div>
      </Modal>
    </div>
  );
}