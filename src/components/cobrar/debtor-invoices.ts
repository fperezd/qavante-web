import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { siiKeys, type RcvVentasResponse } from "@/lib/api/sii";
import { expandPeriodRange, type PeriodRange } from "@/lib/period/period-range";
import { esIdentidadDebil, normalizeRut } from "@/lib/validators/rut";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";

/* Facturas por deudor — reusa el Libro de Ventas (RCV). El SII entrega por mes;
   consultamos cada mes del rango (useQueries, cacheado 10min por mes) y agrupamos
   los documentos por RUT del cliente (`rut_contraparte`). Lazy: solo fetchea
   cuando `enabled` (al expandir el primer deudor). NO trae vencimiento/mora ni
   saldo pendiente por documento — ese dato es gap del backend (banner "parcial").
   Solo lo REAL: folio, fecha, monto emitido. */

/** Clave de agrupación de un cliente en este índice. Con RUT real es el RUT normalizado; con
    identidad débil (el centinela `55.555.555-5` de extranjero, `SIN-RUT`, `S/D`) es
    `sin-rut:<razón social>`.

    POR QUÉ: el centinela pasa el módulo 11, así que entraba acá como un RUT de cliente
    cualquiera y TODOS los clientes extranjeros compartían bucket. Al expandir uno, el panel
    le mostraba las facturas de todos los demás. Es el mismo defecto que el Libro y
    Contraparte 360 ya cerraron con `esIdentidadDebil`; acá se porta la misma decisión.

    Quien consulte el mapa tiene que construir la clave con ESTA función (no con el RUT suelto),
    para que el índice y la búsqueda hablen el mismo idioma. PURO. */
export function debtorInvoiceKey(
  rut: string | null | undefined,
  name: string | null | undefined,
): string {
  if (esIdentidadDebil(rut)) return `sin-rut:${(name ?? "").trim() || "sin-identificar"}`;
  return normalizeRut(String(rut));
}

/** Agrupa los documentos de varios meses por cliente (`debtorInvoiceKey`). PURO/testeable. */
export function indexInvoicesByRut(
  docArrays: ReadonlyArray<ReadonlyArray<RcvDoc>>,
): Map<string, RcvDoc[]> {
  const map = new Map<string, RcvDoc[]>();
  for (const docs of docArrays) {
    for (const doc of docs) {
      const key = debtorInvoiceKey(doc.rut_contraparte, doc.razon_social);
      /* Un documento sin RUT NI razón social no se descarta: su monto existe igual. Queda en
         el bucket explícito `sin-rut:sin-identificar`, no disfrazado de cliente. */
      if (!key) continue;
      const list = map.get(key);
      if (list) list.push(doc);
      else map.set(key, [doc]);
    }
  }
  return map;
}

export interface DebtorInvoicesState {
  /** `debtorInvoiceKey(rut, razón social)` → documentos emitidos a ese cliente en el rango.
   *  La clave NO siempre es un RUT: con identidad débil es `sin-rut:<razón social>`. */
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
