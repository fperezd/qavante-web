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
import type { MaestroKind, DocConVencimiento } from "./terminos-pago";

type ApiRcvDoc = Record<string, unknown>;

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
  /** Primera carga (aún sin datos). A diferencia de `isFetching`, NO se enciende en
   *  los refetch de fondo (`refetchOnWindowFocus`), así que sirve para decidir si
   *  mostrar un skeleton sin colapsar la pantalla cada vez que el usuario vuelve a
   *  la pestaña. */
  isInitialLoading: boolean;
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

function normalizeFolio(value: unknown): number | string | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

function normalizeInteger(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : undefined;
  if (typeof value !== "string" || !/^[+-]?\d+$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}

export function adaptRcv(docs: ReadonlyArray<ApiRcvDoc>): DocConVencimiento[] {
  return docs.map((d) => ({
    rut: String(d.rut_contraparte ?? ""),
    name: typeof d.razon_social === "string" ? d.razon_social : "",
    fecha: typeof d.fecha === "string" ? d.fecha : "",
    monto: Number(d.monto_total) || 0,
    folio: normalizeFolio(d.folio),
    tipoDoc: normalizeInteger(d.tipo_doc),
    refFolio: normalizeInteger(d.ref_folio),
    refTipoDoc: normalizeInteger(d.ref_tipo_doc),
    reclamado: d.reclamado === true, // "R" de reclamada (#744); null/ausente (cache viejo) → false
    cedido: d.cedido === true, // cedida por factoring (RPETC) → se excluye del por-cobrar (#804)
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

export function useMaestroDocs(
  kind: MaestroKind,
  enabled = true,
  rangeOverride?: PeriodRange,
): MaestroDocsState {
  // Por defecto el año en curso; un caller puede pedir una ventana mayor (ej. Cliente 360 pide
  // ~24 meses para estacionalidad + año contra año). Se memoiza por los strings del rango.
  // El caller pasa un `rangeOverride` ya memoizado (o ninguno → año en curso, estable por montaje).
  const range = React.useMemo(() => rangeOverride ?? currentYearRange(new Date()), [rangeOverride]);
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);

  const results = useQueries({
    queries: periods.map((periodo) => ({
      queryKey: queryKey(kind, periodo),
      queryFn: () =>
        api.get<RcvVentasResponse | RcvComprasResponse | BheResponse>(endpoint(kind, periodo)),
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
    isInitialLoading: results.some((r) => r.isLoading),
    isError: results.length > 0 && results.every((r) => r.isError),
  };
}
