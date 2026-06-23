import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "REKAP PI - PT Bukit Agrochemical Baru",
    short_name: "REKAP PI",
    description: "Sistem Admin Distributor PT Bukit Agrochemical Baru",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#10b981",
    icons: [
      { src: "/LogoAGRO.png", sizes: "192x192", type: "image/png" },
      { src: "/LogoAGRO.png", sizes: "512x512", type: "image/png" },
    ],
  };
}