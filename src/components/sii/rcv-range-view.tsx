"use client";

import * as React from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { RcvListView, type RcvKind } from "@/components/sii/rcv-list-view";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { api } from "@/lib/api/client";
import { siiKeys, type RcvComprasResponse, type RcvVentasResponse } from "@/lib/api/sii";
import {
  presetRange,
  expandPeriodRange,
  formatRangeLabel,
  type PeriodRange,
} from "@/lib/period/period-range";

/* Libro de Ventas/Compras con filtro de RANGO + auto-carga. El SII entrega datos
   por MES → consultamos cada mes del rango (useQueries) y los juntamos en un solo
   set que alimenta RcvListView (totales, agrupación de anuladas, filtros y
   paginación operan sobre el set combinado; las anuladas ahora linkean NC↔factura
   cruzando meses). Compartido por Ventas (`/cobrar/facturas-emitidas`) y Compras
   (`/pagar/facturas-recibidas`). */

type RcvResp = RcvVentasResponse | RcvComprasResponse;

export function RcvRangeView({ kind }: { kind: RcvKind }) {
  // Por defecto: el año en curso (enero → mes actual), para ver todo el año sin
  // ampliar el filtro cada vez.
  const [range, setRange] = React.useState<PeriodRange>(() => presetRange("este_ano"));
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);

  const results = useQueries({
    queries: periods.map((periodo) => ({
      queryKey:
        kind === "ventas" ? siiKeys.rcvVentas({ periodo }) : siiKeys.rcvCompras({ periodo }),
      queryFn: () =>
        api.get<RcvResp>(`/api/sii/rcv/${kind}?periodo=${encodeURIComponent(periodo)}`),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  const docs = React.useMemo(() => {
    return results.flatMap((r) => {
      const data = r.data as (RcvVentasResponse & RcvComprasResponse) | undefined;
      return (kind === "ventas" ? data?.ventas : data?.compras) ?? [];
    });
  }, [results, kind]);

  const isFetching = results.some((r) => r.isFetching);
  // Skeleton solo mientras no hay NADA; apenas llega un mes, se muestra.
  const isLoading = docs.length === 0 && results.some((r) => r.isLoading);
  // Error solo si TODOS los meses fallan (un mes caído no tumba la vista).
  const isError = results.length > 0 && results.every((r) => r.isError);
  const error = results.find((r) => r.isError)?.error ?? null;

  const data = (kind === "ventas"
    ? { status: "ok", ventas: docs }
    : { status: "ok", compras: docs }) as unknown as RcvResp;

  const query = {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } as unknown as UseQueryResult<RcvResp, unknown>;

  return (
    <RcvListView
      kind={kind}
      // `period` sintético del rango → cambiar cualquier extremo resetea
      // página/filtros dentro de RcvListView.
      period={`${range.desde}_${range.hasta}`}
      onPeriodChange={() => {}}
      query={query}
      headerLabel={formatRangeLabel(range)}
      periodForm={
        <PeriodRangeFilter
          value={range}
          onChange={setRange}
          hint="Los datos vienen del SII por mes; el rango consulta cada mes y los junta."
        />
      }
    />
  );
}
