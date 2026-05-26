import type { Metadata } from "next";
import { Sora } from "next/font/google";
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

export const metadata: Metadata = {
  title: "Qavante — Avanzar con inteligencia financiera",
  description: "Plataforma de gestión financiera para PYMEs chilenas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL">
      <body className={`${sora.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
