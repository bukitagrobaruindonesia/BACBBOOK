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
  bobotPerUnit: number;
  stokAwalUnit?: number;
  stokAwalKG: number;
  barangMasukUnit?: number;
  barangMasukKG: number;
  barangKeluarUnit?: number;
  barangKeluarKG: number;
  stokAkhirUnit?: number;
  stokAkhirKG: number;
  botolPerDus?: number;
  dusPerZak?: number;
  displayUnit?: string;
  secondaryUnit?: string;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface UserSession {
  id: string;
  email: string;
  nama: string;
  role: string;
}