import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "REKAP PI - PT Bukit Agrochemical",
  description: "Sistem Administrasi Distributor Pupuk - PT Bukit Agrochemical",
  keywords: ["pupuk", "agrochemical", "administrasi", "stock gudang", "proforma invoice"],
  authors: [{ name: "PT Bukit Agrochemical" }],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/LogoAGRO.png", sizes: "512x512", type: "image/png" },
      { url: "/LogoAGRO.png", sizes: "192x192", type: "image/png" },
      { url: "/LogoAGRO.png", sizes: "32x32", type: "image/png" },
      { url: "/LogoAGRO.png", sizes: "16x16", type: "image/png" },
    ],
    shortcut: "/LogoAGRO.png",
    apple: [
      { url: "/LogoAGRO.png", sizes: "180x180", type: "image/png" },
    ],
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