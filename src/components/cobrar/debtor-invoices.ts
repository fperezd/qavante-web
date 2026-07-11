import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { siiKeys, type RcvVentasResponse } from "@/lib/api/sii";
import { expandPeriodRange, type PeriodRange } from "@/lib/period/period-range";
import { normalizeRut } from "@/lib/validators/rut";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";

/* Facturas por deudor — reusa el Libro de Ventas (RCV). El SII entrega por mes;
   consultamos cada mes del rango (useQueries, cacheado 10min por mes) y agrupamos
   los documentos por RUT del cliente (`rut_contraparte`). Lazy: solo fetchea
   cuando `enabled` (al expandir el primer deudor). NO trae vencimiento/mora ni
   saldo pendiente por documento — ese dato es gap del backend (banner "parcial").
   Solo lo REAL: folio, fecha, monto emitido. */

/** Agrupa los documentos de varios meses por RUT del cliente (normalizado).
    PURO/testeable. */
export function indexInvoicesByRut(docArrays: ReadonlyArray<ReadonlyArray<RcvDoc>>): Map<string, RcvDoc[]> {
  const map = new Map<string, RcvDoc[]>();
  for (const docs of docArrays) {
    for (const doc of docs) {
      const rut = normalizeRut(String(doc.rut_contraparte ?? ""));
      if (!rut) continue;
      const list = map.get(rut);
      if (list) list.push(doc);
      else map.set(rut, [doc]);
    }
  }
  return map;
}

export interface DebtorInvoicesState {
  /** RUT normalizado → documentos emitidos a ese cliente en el rango. */
  byRut: Map<string, RcvDoc[]>;
  /** Rango consultado (para el label "Libro de Ventas · feb–jul 2026"). */
  range: PeriodRange;
  isFetching: boolean;
  /** True si TODOS los meses del rango fallaron (no hay nada que mostrar). */
  isError: boolean;
}

/** Fetch de las facturas del rango (cada mes cacheado) agrupadas por RUT.
    `enabled=false` no dispara ninguna consulta (lazy hasta el primer expand). */
export function useDebtorInvoices(range: PeriodRange, enabled: boolean): DebtorInvoicesState {
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);

  const results = useQueries({
    queries: periods.map((periodo) => ({
      queryKey: siiKeys.rcvVentas({ periodo }),
      queryFn: () =>
        api.get<RcvVentasResponse>(`/api/sii/rcv/ventas?periodo=${encodeURIComponent(periodo)}`),
      staleTime: 10 * 60 * 1000,
      retry: false,
      enabled,
    })),
  });

  const byRut = React.useMemo(
    () =>
      indexInvoicesByRut(
        results.map((r) => ((r.data as RcvVentasResponse | undefined)?.ventas ?? []) as RcvDoc[]),
      ),
    [results],
  );

  return {
    byRut,
    range,
    isFetching: results.some((r) => r.isFetching),
    isError: results.length > 0 && results.every((r) => r.isError),
  };
}
