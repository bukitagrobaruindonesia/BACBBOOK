"use client";

import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  where,
  Timestamp,
  setDoc,
} from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, updateProfile } from "firebase/auth";
import { db } from "@/app/lib/firebase";
import { useAuth } from "@/app/context/AuthContext";
import Header from "@/app/components/ui/Header";
import Input from "@/app/components/ui/Input";
import Button from "@/app/components/ui/Button";
import Card from "@/app/components/ui/Card";

interface Karyawan {
  id: string;
  uid?: string;
  nama: string;
  email: string;
  password: string;
  role: string;
  idKantor: string;
  hiddenMenus: string[];
  lastAccessAt: any;
  createdAt: any;
}

interface RoleJabatan {
  id: string;
  namaRole: string;
  isSuperAdmin: boolean;
  createdAt: any;
}

const menuOptions = [
  { key: "/dashboard", label: "Dashboard" },
  { key: "/dashboard/input-proforma-invoice", label: "Input PI" },
  { key: "/dashboard/rekap-proforma-invoice", label: "Rekap PI" },
  { key: "/dashboard/arsip-invoice", label: "Arsip Invoice" },
  { key: "/dashboard/arsip-invoice-sementara", label: "Arsip Invoice Sementara" },
  { key: "/dashboard/laporan-stock-gudang", label: "Laporan & Input Stock" },
  { key: "/dashboard/transaksi-barang-masuk", label: "Barang Masuk" },
  { key: "/dashboard/barang-keluar-backup", label: "Barang Keluar Backup" },
  { key: "/dashboard/input-do", label: "Input DO" },
  { key: "/dashboard/surat-pengangkutan", label: "Surat Pengangkutan" },
  { key: "/dashboard/riwayat-transaksi", label: "Riwayat Transaksi" },
  { key: "/dashboard/add-customer", label: "Add Customer" },
  { key: "/dashboard/riwayat-customer", label: "Riwayat Customer" },
  { key: "/dashboard/fot", label: "Pengaturan FOT" },
  { key: "/dashboard/bapisp-final", label: "BAPISP Final" },
  { key: "/dashboard/berita-acara", label: "Berita Acara" },
  { key: "/dashboard/ttd", label: "TTD" },
  { key: "/dashboard/data-karyawan", label: "Data Karyawan" },
];

export default function DataKaryawanPage() {
  const { user } = useAuth();
  const [karyawanList, setKaryawanList] = useState<Karyawan[]>([]);
  const [roleList, setRoleList] = useState<RoleJabatan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [roleFormData, setRoleFormData] = useState({ namaRole: "", isSuperAdmin: false });

  const [formData, setFormData] = useState({
    nama: "",
    email: "",
    password: "",
    role: "",
    idKantor: "",
    hiddenMenus: [] as string[],
  });

  useEffect(() => {
    fetchKaryawan();
    fetchRoles();
  }, []);

  const fetchKaryawan = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "karyawan"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        uid: doc.data().uid || "",
        nama: doc.data().nama || "",
        email: doc.data().email || "",
        password: doc.data().password || "",
        role: doc.data().role || "",
        idKantor: doc.data().idKantor || "",
        hiddenMenus: doc.data().hiddenMenus || [],
        lastAccessAt: doc.data().lastAccessAt,
        createdAt: doc.data().createdAt,
      } as Karyawan));
      setKaryawanList(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const q = query(collection(db, "roleJabatan"), orderBy("namaRole", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        namaRole: doc.data().namaRole || "",
        isSuperAdmin: doc.data().isSuperAdmin || false,
        createdAt: doc.data().createdAt,
      } as RoleJabatan));
      setRoleList(data);
    } catch (error) {
      console.error(error);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.nama.trim()) newErrors.nama = "Nama wajib diisi";
    if (!formData.email.trim()) newErrors.email = "Email wajib diisi";
    if (!formData.password.trim() && !editingId) newErrors.password = "Password wajib diisi";
    if (!formData.role.trim()) newErrors.role = "Role wajib dipilih";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setSuccessMessage("");
    const auth = getAuth();
    try {
      if (editingId) {
        const updateData: Record<string, string | string[] | ReturnType<typeof serverTimestamp> | undefined> = {
          nama: formData.nama.trim(),
          email: formData.email.trim(),
          role: formData.role.trim(),
          idKantor: formData.idKantor.trim(),
          hiddenMenus: formData.hiddenMenus,
          updatedAt: serverTimestamp(),
        };
        if (formData.password.trim()) {
          updateData.password = formData.password.trim();
          const karyawan = karyawanList.find((k) => k.id === editingId);
          if (karyawan && karyawan.email && karyawan.password) {
            try {
              const userCredential = await signInWithEmailAndPassword(auth, karyawan.email, karyawan.password);
              await updatePassword(userCredential.user, formData.password.trim());
              if (formData.nama.trim()) {
                await updateProfile(userCredential.user, { displayName: formData.nama.trim() });
              }
            } catch (authErr: any) {
              console.error("Gagal update password auth:", authErr);
            }
          }
        }
        await updateDoc(doc(db, "karyawan", editingId), updateData);
        setSuccessMessage("Karyawan berhasil diperbarui!");
        setEditingId(null);
      } else {
        const emailQuery = query(collection(db, "karyawan"), where("email", "==", formData.email.trim()));
        const emailSnap = await getDocs(emailQuery);
        if (!emailSnap.empty) {
          setErrors({ email: "Email sudah terdaftar" });
          setIsSubmitting(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, formData.email.trim(), formData.password.trim());
        await updateProfile(userCredential.user, { displayName: formData.nama.trim() });
        await setDoc(doc(db, "karyawan", userCredential.user.uid), {
          uid: userCredential.user.uid,
          nama: formData.nama.trim(),
          email: formData.email.trim(),
          password: formData.password.trim(),
          role: formData.role.trim(),
          idKantor: formData.idKantor.trim(),
          hiddenMenus: formData.hiddenMenus,
          lastAccessAt: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSuccessMessage("Karyawan berhasil ditambahkan!");
      }
      resetForm();
      fetchKaryawan();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error: any) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        setErrors({ email: "Email sudah terdaftar di Firebase Auth" });
      } else if (error.code === "auth/weak-password") {
        setErrors({ password: "Password minimal 6 karakter" });
      } else {
        setErrors({ submit: "Gagal menyimpan data. Silakan coba lagi." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleFormData.namaRole.trim()) {
      setErrors({ roleForm: "Nama role wajib diisi" });
      return;
    }
    try {
      if (editingRoleId) {
        await updateDoc(doc(db, "roleJabatan", editingRoleId), {
          namaRole: roleFormData.namaRole.trim(),
          isSuperAdmin: roleFormData.isSuperAdmin,
          updatedAt: serverTimestamp(),
        });
        const oldRole = roleList.find((r) => r.id === editingRoleId);
        if (oldRole && oldRole.namaRole !== roleFormData.namaRole.trim()) {
          const batch = karyawanList.filter((k) => k.role === oldRole.namaRole);
          for (const k of batch) {
            await updateDoc(doc(db, "karyawan", k.id), { role: roleFormData.namaRole.trim() });
          }
        }
        setSuccessMessage("Role berhasil diperbarui!");
      } else {
        const exists = roleList.find((r) => r.namaRole.toLowerCase() === roleFormData.namaRole.trim().toLowerCase());
        if (exists) {
          setErrors({ roleForm: "Role sudah ada" });
          return;
        }
        await addDoc(collection(db, "roleJabatan"), {
          namaRole: roleFormData.namaRole.trim(),
          isSuperAdmin: roleFormData.isSuperAdmin,
          createdAt: serverTimestamp(),
        });
        setSuccessMessage("Role berhasil ditambahkan!");
      }
      resetRoleForm();
      fetchRoles();
      fetchKaryawan();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
      setErrors({ roleForm: "Gagal menyimpan role." });
    }
  };

  const handleEdit = (karyawan: Karyawan) => {
    setEditingId(karyawan.id);
    setFormData({
      nama: karyawan.nama,
      email: karyawan.email,
      password: "",
      role: karyawan.role,
      idKantor: karyawan.idKantor,
      hiddenMenus: karyawan.hiddenMenus || [],
    });
    setShowPassword(false);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus karyawan ini?")) return;
    try {
      await deleteDoc(doc(db, "karyawan", id));
      setSuccessMessage("Karyawan berhasil dihapus!");
      fetchKaryawan();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteRole = async (id: string, namaRole: string) => {
    const used = karyawanList.some((k) => k.role === namaRole);
    if (used) {
      alert("Role sedang digunakan oleh karyawan. Ubah role karyawan terlebih dahulu.");
      return;
    }
    if (!window.confirm("Hapus role ini?")) return;
    try {
      await deleteDoc(doc(db, "roleJabatan", id));
      setSuccessMessage("Role berhasil dihapus!");
      fetchRoles();
      setTimeout(() => setSuccessMessage(""), 5000);
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditRole = (role: RoleJabatan) => {
    setEditingRoleId(role.id);
    setRoleFormData({ namaRole: role.namaRole, isSuperAdmin: role.isSuperAdmin });
    setShowRoleForm(true);
  };

  const resetForm = () => {
    setFormData({
      nama: "",
      email: "",
      password: "",
      role: "",
      idKantor: "",
      hiddenMenus: [],
    });
    setErrors({});
    setShowForm(false);
    setEditingId(null);
    setShowPassword(false);
  };

  const resetRoleForm = () => {
    setRoleFormData({ namaRole: "", isSuperAdmin: false });
    setEditingRoleId(null);
    setShowRoleForm(false);
    setErrors((prev) => {
      const n = { ...prev };
      delete n.roleForm;
      return n;
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const n = { ...prev };
        delete n[name];
        return n;
      });
    }
  };

  const toggleMenuAccess = (menuKey: string) => {
    setFormData((prev) => {
      const isHidden = prev.hiddenMenus.includes(menuKey);
      if (isHidden) {
        return { ...prev, hiddenMenus: prev.hiddenMenus.filter((m) => m !== menuKey) };
      }
      return { ...prev, hiddenMenus: [...prev.hiddenMenus, menuKey] };
    });
  };

  const isSuperAdmin = (role: string) => {
    const found = roleList.find((r) => r.namaRole === role);
    return found ? found.isSuperAdmin : role.trim().toUpperCase() === "SUPER ADMIN";
  };

  const formatAccessTime = (ts: any) => {
    if (!ts) return "Belum pernah akses";
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const filteredKaryawan = karyawanList.filter((k) =>
    k.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    k.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <Header
          title="Data Karyawan"
          subtitle="Kelola data karyawan, role, dan hak akses menu"
        />
        <Button
          type="button"
          variant={showForm ? "outline" : "primary"}
          size="sm"
          onClick={() => {
            if (showForm) {
              resetForm();
            } else {
              setShowForm(true);
              setEditingId(null);
            }
          }}
        >
          {showForm ? (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Tutup Form
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Tambah Karyawan
            </>
          )}
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

      {showRoleForm && (
        <Card title={editingRoleId ? "Edit Role Jabatan" : "Tambah Role Jabatan"}>
          <form onSubmit={handleRoleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Nama Role"
                type="text"
                name="namaRole"
                value={roleFormData.namaRole}
                onChange={(e) => setRoleFormData((prev) => ({ ...prev, namaRole: e.target.value }))}
                placeholder="Contoh: Manager"
                error={errors.roleForm}
                required
              />
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="isSuperAdmin"
                  checked={roleFormData.isSuperAdmin}
                  onChange={(e) => setRoleFormData((prev) => ({ ...prev, isSuperAdmin: e.target.checked }))}
                  className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                />
                <label htmlFor="isSuperAdmin" className="text-sm font-medium text-gray-700">
                  Super Admin (akses penuh)
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-4 pt-2">
              <Button type="button" variant="outline" onClick={resetRoleForm}>
                Batal
              </Button>
              <Button type="submit" variant="primary">
                {editingRoleId ? "Simpan Perubahan" : "Tambah Role"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Daftar Role Jabatan">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">Kelola role yang tersedia untuk karyawan</p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setEditingRoleId(null);
              setRoleFormData({ namaRole: "", isSuperAdmin: false });
              setShowRoleForm(true);
            }}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Tambah Role
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">No</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Nama Role</th>
                <th className="text-left py-2 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Tipe</th>
                <th className="text-center py-2 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {roleList.map((role, idx) => (
                <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2 px-3 text-gray-500">{idx + 1}</td>
                  <td className="py-2 px-3 font-medium text-gray-800">{role.namaRole}</td>
                  <td className="py-2 px-3">
                    {role.isSuperAdmin ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded border border-purple-200 font-bold">Super Admin</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded border border-gray-200">Regular</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEditRole(role)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteRole(role.id, role.namaRole)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
      </Card>

      {showForm && (
        <Card title={editingId ? "Edit Karyawan" : "Tambah Karyawan Baru"}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input
                label="Nama Lengkap"
                type="text"
                name="nama"
                value={formData.nama}
                onChange={handleChange}
                placeholder="Contoh: Budi Santoso"
                error={errors.nama}
                required
              />
              <Input
                label="Email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Contoh: budi@email.com"
                error={errors.email}
                required
              />
              <div className="relative">
                <Input
                  label={editingId ? "Password (Kosongkan jika tidak diubah)" : "Password"}
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder={editingId ? "Kosongkan jika tidak diubah" : "Masukkan password"}
                  error={errors.password}
                  required={!editingId}
                />
                {editingId && (
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600"
                    title={showPassword ? "Sembunyikan" : "Tampilkan"}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role / Jabatan <span className="text-red-500">*</span>
                </label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all bg-white ${errors.role ? "border-red-500" : "border-gray-300"}`}
                >
                  <option value="">Pilih Role</option>
                  {roleList.map((role) => (
                    <option key={role.id} value={role.namaRole}>{role.namaRole}</option>
                  ))}
                </select>
                {errors.role && <p className="mt-1 text-sm text-red-600">{errors.role}</p>}
              </div>
              <Input
                label="ID Kantor (Opsional)"
                type="text"
                name="idKantor"
                value={formData.idKantor}
                onChange={handleChange}
                placeholder="Contoh: ADMIN01"
              />
            </div>

            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Pengaturan Akses Menu</h3>
                <div className="text-sm text-gray-500">
                  {isSuperAdmin(formData.role)
                    ? "Super Admin memiliki akses penuh ke semua menu"
                    : "Centang menu yang ingin DISembunyikan"}
                </div>
              </div>

              {isSuperAdmin(formData.role) ? (
                <div className="p-4 bg-green-50 rounded-xl border border-green-200 text-green-700 text-sm">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span className="font-medium">Role Super Admin memiliki akses penuh ke semua menu tanpa pembatasan.</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {menuOptions.map((menu) => {
                    const isHidden = formData.hiddenMenus.includes(menu.key);
                    return (
                      <button
                        key={menu.key}
                        type="button"
                        onClick={() => toggleMenuAccess(menu.key)}
                        className={`p-3 rounded-xl border text-left transition-all flex items-center gap-3 ${
                          isHidden
                            ? "bg-red-50 border-red-300 text-red-700"
                            : "bg-green-50 border-green-300 text-green-700"
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isHidden ? "border-red-500 bg-red-500" : "border-green-500 bg-green-500"
                        }`}>
                          {isHidden && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm font-medium">{menu.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200">
              <Button type="button" variant="outline" onClick={resetForm}>
                Batal
              </Button>
              <Button type="submit" variant="primary" isLoading={isSubmitting}>
                {editingId ? "Simpan Perubahan" : "Tambah Karyawan"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Daftar Karyawan">
        <div className="mb-4">
          <div className="relative">
            <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, atau role..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700"></div>
          </div>
        ) : filteredKaryawan.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-gray-400">
            <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="font-medium">Belum ada data karyawan</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">No</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Nama</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Email</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Role</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">ID Kantor</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Akses Menu</th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Akses Terakhir</th>
                  <th className="text-center py-3 px-3 font-semibold text-gray-600 uppercase text-xs tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredKaryawan.map((karyawan, idx) => (
                  <tr key={karyawan.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-gray-500">{idx + 1}</td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-gray-800">{karyawan.nama}</span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{karyawan.email}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 rounded-md text-xs font-bold ${
                        isSuperAdmin(karyawan.role)
                          ? "bg-purple-100 text-purple-700 border border-purple-200"
                          : karyawan.role === "Admin"
                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                          : "bg-gray-100 text-gray-700 border border-gray-200"
                      }`}>
                        {karyawan.role}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {karyawan.idKantor || "-"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {isSuperAdmin(karyawan.role) ? (
                        <span className="text-xs text-green-600 font-medium">Semua Menu</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {karyawan.hiddenMenus && karyawan.hiddenMenus.length > 0 ? (
                            karyawan.hiddenMenus.map((menuKey) => {
                              const menuLabel = menuOptions.find((m) => m.key === menuKey)?.label || menuKey;
                              return (
                                <span key={menuKey} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded border border-red-200">
                                  {menuLabel}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-green-600 font-medium">Semua Menu</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-medium ${karyawan.lastAccessAt ? "text-green-600" : "text-gray-400"}`}>
                        {formatAccessTime(karyawan.lastAccessAt)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(karyawan)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(karyawan.id)}
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