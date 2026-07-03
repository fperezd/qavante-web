"use client";

import * as React from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { RcvListView } from "@/components/sii/rcv-list-view";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { api } from "@/lib/api/client";
import { siiKeys, type RcvVentasResponse } from "@/lib/api/sii";
import {
  defaultRange,
  expandPeriodRange,
  formatRangeLabel,
  type PeriodRange,
} from "@/lib/period/period-range";

/* Libro de Ventas — PILOTO del filtro de rango + auto-carga (pedido de Fernando).
   En vez del selector mono-mes con "Consultar", arranca con un rango por defecto
   (últimos 6 meses) y trae datos SOLO al entrar. El SII es por-mes → consultamos
   cada mes del rango (useQueries) y los juntamos en un solo set que alimenta la
   vista (totales, agrupación de anuladas, filtros y paginación operan sobre el
   set combinado). */
export function FacturasEmitidasView() {
  const [range, setRange] = React.useState<PeriodRange>(() => defaultRange());
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);

  const results = useQueries({
    queries: periods.map((periodo) => ({
      queryKey: siiKeys.rcvVentas({ periodo }),
      queryFn: () =>
        api.get<RcvVentasResponse>(`/api/sii/rcv/ventas?periodo=${encodeURIComponent(periodo)}`),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  /* Merge de todos los meses. La agrupación de anuladas ahora linkea NC↔factura
     también CRUZANDO meses (una NC de julio contra una factura de junio). */
  const ventas = React.useMemo(
    () => results.flatMap((r) => (r.data as RcvVentasResponse | undefined)?.ventas ?? []),
    [results],
  );

  const isFetching = results.some((r) => r.isFetching);
  // Skeleton solo mientras no hay NADA todavía; apenas llega un mes, se muestra.
  const isLoading = ventas.length === 0 && results.some((r) => r.isLoading);
  // Error solo si TODOS los meses fallan (un mes caído no tumba la vista).
  const isError = results.length > 0 && results.every((r) => r.isError);
  const error = results.find((r) => r.isError)?.error ?? null;

  const query = {
    data: { status: "ok", ventas } as unknown as RcvVentasResponse,
    isLoading,
    isFetching,
    isError,
    error,
  } as unknown as UseQueryResult<RcvVentasResponse, unknown>;

  return (
    <RcvListView
      kind="ventas"
      // `period` sintético del rango → cambiar cualquier extremo resetea
      // página/filtros dentro de RcvListView (el efecto depende de `period`).
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
