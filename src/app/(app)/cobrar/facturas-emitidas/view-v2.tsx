"use client";

import * as React from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { RcvListView } from "@/components/sii/rcv-list-view";
import { VentasHero, type HeroSecundario } from "@/components/sii/libro-v2/ventas-hero";
import { ConcentracionClientes } from "@/components/sii/libro-v2/concentracion-clientes";
import { computeRcvTotals } from "@/components/sii/rcv-totals";
import { concentrationByCounterparty } from "@/components/sii/libro-kpis/libro-kpis-format";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { api } from "@/lib/api/client";
import { siiKeys, type RcvVentasResponse } from "@/lib/api/sii";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import {
  defaultRange,
  expandPeriodRange,
  formatRangeLabel,
  type PeriodRange,
} from "@/lib/period/period-range";

/* Libro de Ventas v2 (rediseño aprobado 2026-07-13) — gated por `libroVentasV2` (OFF).
   Reordena la pantalla a la jerarquía del Inicio: la RESPUESTA de dueño arriba
   (VentasHero: neto + sparkline mes a mes + secundarios) y JUSTO DEBAJO el detalle —
   la tabla densa SUBE (RcvListView en modo `tableOnly`) con la concentración top 10 al
   costado. Sin toggle "Agrupar N/C". Reusa la MISMA capa de datos que el libro clásico
   (una query por mes del rango). Los 3 comparativos del ritmo (misma-fecha / promedio
   anual / YoY) se OMITEN hasta que CC-API entregue el endpoint de comparativos
   (libro-comparativos-contract) — degradado honesto: el hero muestra lo que hay. */

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function mesCorto(periodo: string, withYear = false): string {
  const m = Number(periodo.slice(5, 7));
  const base = MESES[m - 1] ?? periodo;
  return withYear ? `${base} ${periodo.slice(2, 4)}` : base;
}

export function FacturasEmitidasViewV2() {
  const [range, setRange] = React.useState<PeriodRange>(() => defaultRange());
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);

  const results = useQueries({
    queries: periods.map((periodo) => ({
      queryKey: siiKeys.rcvVentas({ periodo }),
      queryFn: () => api.get<RcvVentasResponse>(`/api/sii/rcv/ventas?periodo=${encodeURIComponent(periodo)}`),
      staleTime: 10 * 60 * 1000,
      retry: false,
    })),
  });

  // Docs por mes (para la serie del sparkline) + set combinado.
  const perMonth = periods.map((periodo, i) => ({
    periodo,
    docs: ((results[i]?.data?.ventas ?? []) as RcvDoc[]),
  }));
  const allDocs = perMonth.flatMap((m) => m.docs);

  const totals = computeRcvTotals(allDocs);
  const docCount = allDocs.length - totals.ncCount; // documentos, sin las NC

  const isFetching = results.some((r) => r.isFetching);
  const anyError = results.some((r) => r.isError);
  // El hero se muestra recién cuando TODOS los meses resolvieron (aunque alguno falle),
  // para no presentar un neto PARCIAL que después "salta". Mientras carga, la tabla
  // (RcvListView) muestra su skeleton.
  const showHero = !isFetching && allDocs.length > 0;
  // Serie del sparkline: solo con todos los meses resueltos Y sin errores — un mes
  // caído daría neto 0 = una caída FALSA en el gráfico.
  const serie = perMonth.map((m) => computeRcvTotals(m.docs).neto);
  const showSerie = !isFetching && !anyError && serie.length >= 2;
  const firstYear = periods[0]?.slice(0, 4);
  const lastYear = periods[periods.length - 1]?.slice(0, 4);
  const multiYear = Boolean(firstYear && lastYear && firstYear !== lastYear);
  const concentracion = concentrationByCounterparty(allDocs, 10).map((c) => ({
    nombre: c.name,
    rut: c.rut,
    monto: c.total,
    pct: c.pct,
  }));

  // Sello de frescura: el sync más reciente entre los meses.
  const lastSynced = results
    .map((r) => (r.data as RcvVentasResponse | undefined)?.last_synced_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);

  const secundarios: HeroSecundario[] = [
    { label: "IVA débito", valor: formatClp(totals.iva), tono: "brand" },
    { label: "Documentos emitidos", valor: String(docCount) },
    {
      label: `Notas de crédito${totals.ncCount ? ` (${totals.ncCount})` : ""}`,
      valor: totals.ncCount ? formatClp(-totals.ncTotal) : "—",
      tono: "neg",
    },
  ];

  // Query sintético para RcvListView (mismo patrón que RcvRangeView): el set ya
  // viene combinado del rango; RcvListView solo lo pinta.
  const query = {
    data: { status: "ok", ventas: allDocs },
    isLoading: allDocs.length === 0 && results.some((r) => r.isLoading),
    isFetching: results.some((r) => r.isFetching),
    isError: results.length > 0 && results.every((r) => r.isError),
    error: results.find((r) => r.isError)?.error ?? null,
  } as unknown as UseQueryResult<RcvVentasResponse, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodRangeFilter
          value={range}
          onChange={setRange}
          hint="Los datos vienen del SII por mes; el rango consulta cada mes y los junta."
        />
        <div className="flex-1" />
        {lastSynced && (
          <span className="text-[12px] text-neutral-light">
            Actualizado {formatDateLike(lastSynced)} · SII
          </span>
        )}
      </div>

      {showHero && (
        <VentasHero
          titulo="La empresa vendió"
          montoNeto={totals.neto}
          subtitulo={`Neto del período · ${docCount} ${docCount === 1 ? "documento emitido" : "documentos emitidos"}`}
          infoHint="Neto = bruto facturado − notas de crédito. El dato oficial de impuestos sigue siendo el F29."
          serie={showSerie ? serie : undefined}
          serieMeses={showSerie ? perMonth.map((m) => mesCorto(m.periodo, multiYear)) : undefined}
          secundarios={secundarios}
        />
      )}

      <div className={showHero ? "grid items-start gap-4 lg:grid-cols-[1fr_300px]" : undefined}>
        <RcvListView
          kind="ventas"
          period={`${range.desde}_${range.hasta}`}
          onPeriodChange={() => {}}
          query={query}
          headerLabel={formatRangeLabel(range)}
          tableOnly
        />
        {showHero && (
          <ConcentracionClientes titulo="Concentración por cliente" items={concentracion} />
        )}
      </div>
    </div>
  );
}
