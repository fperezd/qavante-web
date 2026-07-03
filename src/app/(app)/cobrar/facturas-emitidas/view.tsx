"use client";

import { RcvRangeView } from "@/components/sii/rcv-range-view";

/* Libro de Ventas — filtro de rango + auto-carga (compartido con Compras). */
export function FacturasEmitidasView() {
  return <RcvRangeView kind="ventas" />;
}
