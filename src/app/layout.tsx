import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/* LAS TIPOGRAFÍAS SALEN DEL REPO, NO DE GOOGLE.
   Acá vivía `next/font/google`, que DESCARGA la tipografía en tiempo de compilación: cada
   build del producto dependía de que Google respondiera, y cuando no respondía el job que
   compila moría entero con "An error occurred in `next/font`". Le tocaba a `lighthouse` o a
   `build` según el día, y en los dos casos el rojo no decía nada del código del PR.
   Los archivos y su procedencia (paquete, versión, licencia OFL-1.1 y sha256) están en
   `src/app/fonts/PROCEDENCIA.md`. */

/* Sora — tipografía oficial Qavante (Manual de Marca v1.1 §7).
   Pesos cubren la jerarquía: Light/Regular para body, Medium para datos,
   SemiBold/Bold para títulos. `display: swap` evita FOIT. */
const sora = localFont({
  variable: "--font-sora",
  display: "swap",
  src: [
    { path: "./fonts/sora/sora-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/sora/sora-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/sora/sora-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/sora/sora-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/sora/sora-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

/* Rediseño de UI (docs/design/2026-08-23-rediseno-ui §1.2) — dos voces + mono.
   Cargadas a nivel de body (aditivo, no reemplaza Sora) para que los componentes
   nuevos bajo `src/components/rediseno/` puedan usarlas sin que el resto de la
   app cambie de tipografía todavía. */
const figtree = localFont({
  variable: "--font-figtree",
  display: "swap",
  preload: false,
  src: [
    { path: "./fonts/figtree/figtree-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/figtree/figtree-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/figtree/figtree-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/figtree/figtree-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});
const splineSansMono = localFont({
  variable: "--font-spline-mono",
  display: "swap",
  preload: false,
  /* NO se toca el fallback. Para una mono, ajustar la métrica contra Arial es discutible, y
     dejar `ui-monospace` primero probablemente se vería mejor. Pero `next/font/google` usaba el
     default (métrica derivada de la propia fuente sobre Arial), así que cambiarlo acá sería
     mover el renderizado en un cambio cuyo objetivo es NO moverlo. Es su propia decisión. */
  src: [
    {
      path: "./fonts/spline-sans-mono/spline-sans-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/spline-sans-mono/spline-sans-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/spline-sans-mono/spline-sans-mono-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
});

export const metadata: Metadata = {
  title: "Qavante · Anticipa. Decide. Avanza.",
  description: "Qavante · Anticipa. Decide. Avanza. Gestión financiera para PYMEs chilenas.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-CL">
      <body
        className={`${sora.variable} ${figtree.variable} ${splineSansMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
