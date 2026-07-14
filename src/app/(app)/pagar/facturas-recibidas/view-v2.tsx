"use client";

import { LibroRcvV2View } from "@/components/sii/libro-v2/libro-rcv-v2-view";

/* Libro de Compras v2 (rediseño 2026-07-13) — gated `libroComprasV2` (OFF). Mismo
   rediseño que Ventas (respuesta de dueño arriba + tabla que sube + concentración por
   proveedor lateral, sin toggle "Agrupar N/C"); la lógica vive en `LibroRcvV2View`. */
export function FacturasRecibidasViewV2() {
  return <LibroRcvV2View kind="compras" />;
}
