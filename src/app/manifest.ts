import type { MetadataRoute } from "next";

// Manifest PWA: torna o site instalável no celular — pré-requisito pro
// Web Push no iOS (16.4+ só entrega push a PWAs instaladas).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CA Aberto? — CACOMP UnB",
    short_name: "CA Aberto?",
    description:
      "O Centro Acadêmico de Computação da UnB está aberto agora? Status em tempo real.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
