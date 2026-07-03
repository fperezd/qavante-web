"use client";

import { RcvRangeView } from "@/components/sii/rcv-range-view";

/* Libro de Compras — filtro de rango + auto-carga (compartido con Ventas). */
export function FacturasRecibidasView() {
  return <RcvRangeView kind="compras" />;
}
