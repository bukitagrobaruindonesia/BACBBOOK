export interface Karyawan {
  id: string;
  email: string;
  nama: string;
  password: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface ProformaInvoice {
  id: string;
  tanggal: string;
  nomorPI: string;
  namaCustomer: string;
  namaProduk: string;
  fot: string;
  kuantitasKG: number;
  barangDiambil: number;
  sisaBarang: number;
  kodeBeritaAcara: string;
  fileBeritaAcaraURL: string;
  kodeInvoice: string;
  fileInvoiceURL: string;
  keterangan: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockGudang {
  id: string;
  fot?: string;
  kodeBarang: string;
  namaBarang: string;
  unit: "ZAK" | "DUS";
  bobotPerUnit?: number;
  stokAwalZAK: number;
  stokAwalKG: number;
  barangMasukKG: number;
  barangKeluarKG: number;
  stokAkhirKG: number;
  stokBarangZAK: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  id: string;
  email: string;
  nama: string;
  role: string;
}