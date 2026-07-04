"use client";

import * as React from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { BheListView } from "@/components/sii/bhe-list-view";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { api } from "@/lib/api/client";
import { siiKeys, type BheResponse, type BheRecibida } from "@/lib/api/sii";
import {
  presetRange,
  expandPeriodRange,
  formatRangeLabel,
  type PeriodRange,
} from "@/lib/period/period-range";

/* Honorarios (BHE) con filtro de RANGO + auto-carga. Igual que Ventas/Compras: el
   SII entrega por mes → consultamos cada mes del rango (useQueries) y juntamos las
   boletas. Los totales (líquido/retención) y las anuladas operan sobre el set
   combinado. */
export function BheRangeView() {
  // Por defecto: el año en curso (enero → mes actual).
  const [range, setRange] = React.useState<PeriodRange>(() => presetRange("este_ano"));
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);

  const results = useQueries({
    queries: periods.map((periodo) => ({
      queryKey: siiKeys.bhe({ periodo }),
      queryFn: () => api.get<BheResponse>(`/api/sii/bhe?periodo=${encodeURIComponent(periodo)}`),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  const bhe = React.useMemo<BheRecibida[]>(
    () => results.flatMap((r) => (r.data as BheResponse | undefined)?.bhe ?? []),
    [results],
  );

  const isFetching = results.some((r) => r.isFetching);
  const isLoading = bhe.length === 0 && results.some((r) => r.isLoading);
  const isError = results.length > 0 && results.every((r) => r.isError);
  const error = results.find((r) => r.isError)?.error ?? null;

  const query = {
    data: { status: "ok", bhe } as unknown as BheResponse,
    isLoading,
    isFetching,
    isError,
    error,
  } as unknown as UseQueryResult<BheResponse, unknown>;

  return (
    <BheListView
      period={`${range.desde}_${range.hasta}`}
      onPeriodChange={() => {}}
      query={query}
      headerLabel={formatRangeLabel(range)}
      periodForm={
        <PeriodRangeFilter
          value={range}
          onChange={setRange}
          hint="La retención del 13,75% (2026) la pagas tú en el F29. El rango consulta cada mes del SII y los junta."
        />
      }
    />
  );
}
