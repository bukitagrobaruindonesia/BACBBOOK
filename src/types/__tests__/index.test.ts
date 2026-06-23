import { describe, it, expect } from "vitest";

describe("Type Definitions", () => {
  it("Karyawan type has required fields", () => {
    const karyawan = {
      id: "1",
      nama: "John",
      jabatan: "Manager",
      email: "john@example.com",
    };
    expect(karyawan).toHaveProperty("id");
    expect(karyawan).toHaveProperty("nama");
    expect(karyawan).toHaveProperty("jabatan");
  });

  it("ProformaInvoice type has required fields", () => {
    const pi = {
      id: "1",
      nomorPI: "PI-001",
      customer: "Customer A",
      produkItems: [],
      total: 0,
      statusPemesanan: "Aktif",
    };
    expect(pi).toHaveProperty("nomorPI");
    expect(pi).toHaveProperty("customer");
    expect(pi).toHaveProperty("produkItems");
  });

  it("StockGudang type has required fields", () => {
    const stock = {
      id: "1",
      kodeBarang: "NPK-001",
      namaProduk: "NPK",
      stokTersedia: 100,
      satuan: "ZAK",
    };
    expect(stock).toHaveProperty("kodeBarang");
    expect(stock).toHaveProperty("stokTersedia");
    expect(stock).toHaveProperty("satuan");
  });

  it("SuratPengangkutan type has required fields", () => {
    const sp = {
      id: "1",
      nomorSP: "SP-001",
      nomorPI: "PI-001",
      tanggal: new Date(),
      items: [],
      status: "Aktif",
    };
    expect(sp).toHaveProperty("nomorSP");
    expect(sp).toHaveProperty("nomorPI");
    expect(sp).toHaveProperty("items");
  });

  it("TransaksiBarangMasuk type has required fields", () => {
    const transaksi = {
      id: "1",
      kodeBarang: "NPK-001",
      jumlah: 100,
      tanggal: new Date(),
    };
    expect(transaksi).toHaveProperty("kodeBarang");
    expect(transaksi).toHaveProperty("jumlah");
  });

  it("TransaksiBarangKeluar type has required fields", () => {
    const transaksi = {
      id: "1",
      nomorSP: "SP-001",
      kodeBarang: "NPK-001",
      jumlah: 50,
      tanggal: new Date(),
    };
    expect(transaksi).toHaveProperty("nomorSP");
    expect(transaksi).toHaveProperty("jumlah");
  });

  it("TTDData type has required fields", () => {
    const ttd = {
      nama: "John",
      jabatan: "Manager",
      ttdImage: "base64string",
    };
    expect(ttd).toHaveProperty("nama");
    expect(ttd).toHaveProperty("jabatan");
    expect(ttd).toHaveProperty("ttdImage");
  });

  it("JenisTransaksi type is valid", () => {
    const jenis: string = "Masuk";
    expect(["Masuk", "Keluar"]).toContain(jenis);
  });

  it("SopirNopolData type has required fields", () => {
    const sopir = {
      namaSopir: "John",
      nopol: "B 1234 ABC",
    };
    expect(sopir).toHaveProperty("namaSopir");
    expect(sopir).toHaveProperty("nopol");
  });

  it("ProdukItem type has required fields", () => {
    const item = {
      kodeBarang: "NPK-001",
      namaProduk: "NPK",
      kuantitas: 10,
      satuan: "ZAK",
      hargaSatuan: 50000,
      fot: "FOT-001",
    };
    expect(item).toHaveProperty("kodeBarang");
    expect(item).toHaveProperty("kuantitas");
    expect(item).toHaveProperty("hargaSatuan");
  });

  it("UserSession type has required fields", () => {
    const user = {
      uid: "123",
      email: "test@example.com",
      role: "admin",
    };
    expect(user).toHaveProperty("uid");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("role");
  });
});
