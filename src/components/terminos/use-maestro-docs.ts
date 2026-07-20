import * as React from "react";
import { useQueries } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import {
  siiKeys,
  type RcvVentasResponse,
  type RcvComprasResponse,
  type BheResponse,
  type BheRecibida,
} from "@/lib/api/sii";
import { expandPeriodRange, type PeriodRange } from "@/lib/period/period-range";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";
import type { MaestroKind, DocConVencimiento } from "./terminos-pago";

/* Datos del maestro — trae los documentos del AÑO EN CURSO (enero → mes actual) del
   tipo pedido y los adapta a `DocConVencimiento`. El SII entrega por mes → una query
   por mes (useQueries, cacheada 10min y compartida con el Libro/BHE). Adaptadores:
   - ventas/compras (RCV): rut_contraparte · razon_social · fecha · monto_total.
   - honorarios (BHE recibidas): rut_emisor · nombre_emisor · fecha_emision · monto_liquido
     (lo que se le paga al profesional, ya neto de retención). Ignora anuladas. */

export interface MaestroDocsState {
  docs: DocConVencimiento[];
  periods: string[];
  isFetching: boolean;
  /** True si TODOS los meses fallaron. */
  isError: boolean;
}

function endpoint(kind: MaestroKind, periodo: string): string {
  const p = encodeURIComponent(periodo);
  if (kind === "honorarios") return `/api/sii/bhe?periodo=${p}`;
  return `/api/sii/rcv/${kind}?periodo=${p}`;
}

function queryKey(kind: MaestroKind, periodo: string) {
  if (kind === "honorarios") return siiKeys.bhe({ periodo });
  if (kind === "ventas") return siiKeys.rcvVentas({ periodo });
  return siiKeys.rcvCompras({ periodo });
}

/** Rango del año en curso: enero → mes actual (para "todo 2026"). */
function currentYearRange(now: Date): PeriodRange {
  const y = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  return { desde: `${y}-01`, hasta: `${y}-${mm}` };
}

function adaptRcv(docs: ReadonlyArray<RcvDoc>): DocConVencimiento[] {
  return docs.map((d) => ({
    rut: String(d.rut_contraparte ?? ""),
    name: d.razon_social ?? "",
    fecha: d.fecha ?? "",
    monto: Number(d.monto_total) || 0,
    folio: d.folio ?? null,
    tipoDoc: typeof d.tipo_doc === "number" ? d.tipo_doc : undefined,
    refFolio: typeof d.ref_folio === "number" ? d.ref_folio : undefined,
    refTipoDoc: typeof d.ref_tipo_doc === "number" ? d.ref_tipo_doc : undefined,
  }));
}

function adaptBhe(docs: ReadonlyArray<BheRecibida>): DocConVencimiento[] {
  return docs
    .filter((b) => !b.anulada)
    .map((b) => ({
      rut: String(b.rut_emisor ?? ""),
      name: b.nombre_emisor ?? "",
      fecha: b.fecha_emision ?? "",
      monto: Number(b.monto_liquido) || 0,
      folio: b.folio ?? null,
    }));
}

export function useMaestroDocs(kind: MaestroKind, enabled = true): MaestroDocsState {
  // `now` una sola vez por montaje (evita recomputar el rango en cada render).
  const range = React.useMemo(() => currentYearRange(new Date()), []);
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);

  const results = useQueries({
    queries: periods.map((periodo) => ({
      queryKey: queryKey(kind, periodo),
      queryFn: () => api.get<RcvVentasResponse | RcvComprasResponse | BheResponse>(endpoint(kind, periodo)),
      staleTime: 10 * 60 * 1000,
      retry: false,
      enabled,
    })),
  });

  const docs = React.useMemo(() => {
    const out: DocConVencimiento[] = [];
    for (const r of results) {
      const data = r.data;
      if (!data) continue;
      if (kind === "honorarios") {
        out.push(...adaptBhe((data as BheResponse).bhe ?? []));
      } else if (kind === "ventas") {
        out.push(...adaptRcv((data as RcvVentasResponse).ventas ?? []));
      } else {
        out.push(...adaptRcv((data as RcvComprasResponse).compras ?? []));
      }
    }
    return out;
  }, [results, kind]);

  return {
    docs,
    periods,
    isFetching: results.some((r) => r.isFetching),
    isError: results.length > 0 && results.every((r) => r.isError),
  };
}
