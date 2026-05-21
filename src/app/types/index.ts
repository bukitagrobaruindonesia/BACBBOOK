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

export interface ProdukItem {
  namaProduk: string;
  fot: string;
  kuantitas: number;
  satuan: string;
  hargaSatuan: number;
  totalHarga: number;
}

export interface ProformaInvoice {
  id: string;
  tanggal: string;
  nomorPI: string;
  namaCustomer: string;
  alamatCustomer: string;
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
  createdAt?: Date;
  updatedAt?: Date;
  sisaPengambilanKG?: number;
  statusPengangkutan?: "belum_dimuat" | "partial" | "complete";
}

export interface StockGudang {
  id: string;
  fot: string;
  kodeBarang: string;
  namaBarang: string;
  unit: "ZAK" | "DUS" | "KG" | "BOTOL";
  bobotPerUnit?: number;
  botolPerDus?: number;
  volumeMl?: number;
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
  namaProdusen?: string;
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

export interface SuratPengangkutanItem {
  nomorSubDO: string;
  nomorPO: string;
  jenisPupuk: string;
  party: string;
  pengambilanMT: number;
  pengambilanZAK: number;
  sisa: string;
}

export interface SuratPengangkutan {
  id: string;
  jenisSurat: "gudangInduk" | "do";
  tanggal: string;
  namaKabupaten: string;
  nomorSeri: string;
  nomorPIList?: string[];
  items: SuratPengangkutanItem[];
  sopirNopolList: SopirNopolData[];
  nomorPolisi: string;
  driverUnit: string;
  nomorSIM?: string;
  totalPengambilanKG?: number;
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TTDData {
  id: string;
  nama: string;
  jabatan: string;
  ttdImage: string;
  createdAt?: Date;
}

export type JenisTransaksi = "barangMasuk" | "barangKeluar" | "suratPengangkutanGudangInduk" | "suratPengangkutanDO";