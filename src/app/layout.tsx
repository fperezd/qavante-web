import type { Metadata } from "next";
import { Sora, Fraunces, Figtree, Spline_Sans_Mono } from "next/font/google";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

/* Sora — tipografía oficial Qavante (Manual de Marca v1.1 §7).
   Pesos cubren la jerarquía: Light/Regular para body, Medium para datos,
   SemiBold/Bold para títulos. `display: swap` evita FOIT. */
const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

/* Rediseño de UI (docs/design/2026-08-23-rediseno-ui §1.2) — dos voces + mono.
   Cargadas a nivel de body (aditivo, no reemplaza Sora) para que los componentes
   nuevos bajo `src/components/rediseno/` puedan usarlas sin que el resto de la
   app cambie de tipografía todavía. */
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const splineSansMono = Spline_Sans_Mono({
  variable: "--font-spline-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Qavante: Avanzar con inteligencia financiera",
  description: "Plataforma de gestión financiera para PYMEs chilenas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL">
      <body
        className={`${sora.variable} ${fraunces.variable} ${figtree.variable} ${splineSansMono.variable} antialiased`}
      >
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
