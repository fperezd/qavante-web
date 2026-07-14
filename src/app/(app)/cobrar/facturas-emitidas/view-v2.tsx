"use client";

import { LibroRcvV2View } from "@/components/sii/libro-v2/libro-rcv-v2-view";

/* Libro de Ventas v2 (rediseño 2026-07-13) — gated `libroVentasV2` (OFF). Reordena la
   pantalla a la jerarquía del Inicio (respuesta de dueño arriba + tabla que sube +
   concentración lateral, sin toggle "Agrupar N/C"). La lógica vive en el componente
   compartido `LibroRcvV2View` (Ventas/Compras); acá solo se fija `kind`. */
export function FacturasEmitidasViewV2() {
  return <LibroRcvV2View kind="ventas" />;
}
