import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "REKAP DATA - PT Bukit Agrochemical Baru",
  description: "Sistem Administrasi Distributor Pupuk - PT Bukit Agrochemical BARU",
  keywords: ["pupuk", "agrochemical", "administrasi", "stock gudang", "proforma invoice"],
  authors: [{ name: "PT Bukit Agrochemical Baru" }],
  manifest: "/manifest.json",
  icons: {
    icon: "/LogoAGRO.png",
    shortcut: "/LogoAGRO.png",
    apple: "/LogoAGRO.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1a5c1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}