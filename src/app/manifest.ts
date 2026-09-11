import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oman Compass Tours Company",
    short_name: "Oman Compass",
    description:
      "Private & luxury tours across the Sultanate of Oman with licensed Omani guides.",
    start_url: "/en",
    display: "standalone",
    background_color: "#0E0B2E",
    theme_color: "#0E0B2E",
    lang: "en",
    dir: "auto",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
