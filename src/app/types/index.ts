export interface Karyawan {
  id: string;
  email: string;
  nama: string;
  password: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface SopirNopolData {
  namaSopir: string;
  nopol: string;
  nomorSIM?: string;
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
  fileBeritaAcara: string;
  fileBeritaAcaraName: string;
  kodeInvoice: string;
  fileInvoice: string;
  fileInvoiceName: string;
  keterangan: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface StockGudang {
  id: string;
  fot: string;
  kodeBarang: string;
  namaBarang: string;
  unit: "ZAK" | "DUS" | "KG" | "BOTOL";
  bobotPerUnit?: number;
  botolPerDus?: number;
  volumeMl?: number;        // ← TAMBAHKAN INI
  displayUnit?: string;
  stokAwalUnit: number;
  stokAwalKG: number;
  barangMasukUnit: number;
  barangMasukKG: number;
  barangKeluarUnit: number;
  barangKeluarKG: number;
  stokAkhirUnit: number;
  stokAkhirKG: number;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserSession {
  id: string;
  email: string;
  nama: string;
  role: string;
  username?: string;
}

export interface TransaksiBarangMasuk {
  id: string;
  tanggal: string;
  kodeBarang: string;
  namaBarang: string;
  unit: "ZAK" | "DUS" | "KG" | "BOTOL";
  jumlahZAK: number;
  botolPerDus?: number;
  bobotPerBotol?: number;
  sopirNopolList: SopirNopolData[];
  fot: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TransaksiBarangKeluar {
  id: string;
  tanggal: string;
  kodeBarang: string;
  namaBarang: string;
  unit: "ZAK" | "DUS" | "KG" | "BOTOL";
  jumlahZAK: number;
  botolPerDus?: number;
  bobotPerBotol?: number;
  namaCustomer: string;
  nomorPI: string;
  nomorInvoice: string;
  sopirNopolList: SopirNopolData[];
  nomorSuratPengangkutan: string;
  fot: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type JenisTransaksi = "barangMasuk" | "barangKeluar";