"use client";

import * as React from "react";
import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { RcvListView, type RcvKind } from "@/components/sii/rcv-list-view";
import { VentasHero, type HeroSecundario } from "./ventas-hero";
import { ConcentracionClientes } from "./concentracion-clientes";
import { useLibroComparativos } from "./use-libro-comparativos";
import { computeRcvTotals } from "../rcv-totals";
import { concentrationByCounterparty } from "../libro-kpis/libro-kpis-format";
import type { RcvDoc } from "../rcv-grouped-item";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { api } from "@/lib/api/client";
import { siiKeys, type RcvComprasResponse, type RcvVentasResponse } from "@/lib/api/sii";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import {
  expandPeriodRange,
  formatRangeLabel,
  presetRange,
  type PeriodRange,
} from "@/lib/period/period-range";
import { MESES_CORTOS as MESES } from "@/lib/formatters/months";

/* Libro v2 (rediseño aprobado 2026-07-13) — vista LIVE compartida por Ventas
   (`/cobrar/facturas-emitidas`, gated `libroVentasV2`) y Compras (`/pagar/facturas-
   recibidas`, gated `libroComprasV2`). Reordena la pantalla a la jerarquía del Inicio:
   la RESPUESTA de dueño arriba (VentasHero: neto + 3 comparativos + sparkline +
   secundarios) y JUSTO DEBAJO el detalle — la tabla densa SUBE (RcvListView en modo
   `tableOnly`) con la concentración top 10 al costado. Sin toggle "Agrupar N/C".
   Reusa la MISMA capa de datos que el libro clásico (una query por mes del rango). */

type RcvResp = RcvVentasResponse | RcvComprasResponse;

interface KindCopy {
  titulo: string;
  ivaLabel: string;
  docSingular: string;
  docPlural: string;
  concentracion: string;
  infoHint: string;
}
const COPY: Record<RcvKind, KindCopy> = {
  ventas: {
    titulo: "La empresa vendió",
    ivaLabel: "IVA débito",
    docSingular: "documento emitido",
    docPlural: "documentos emitidos",
    concentracion: "Concentración por cliente",
    infoHint:
      "Incluye ventas afectas + exportaciones exentas, menos notas de crédito. El dato oficial de impuestos (IVA) sigue siendo el F29.",
  },
  compras: {
    titulo: "La empresa compró",
    ivaLabel: "IVA crédito",
    docSingular: "documento recibido",
    docPlural: "documentos recibidos",
    concentracion: "Concentración por proveedor",
    infoHint:
      "Incluye compras afectas + exentas, menos notas de crédito. El dato oficial de impuestos (IVA) sigue siendo el F29.",
  },
};

function mesCorto(periodo: string, withYear = false): string {
  const m = Number(periodo.slice(5, 7));
  const base = MESES[m - 1] ?? periodo;
  return withYear ? `${base} ${periodo.slice(2, 4)}` : base;
}

export function LibroRcvV2View({ kind }: { kind: RcvKind }) {
  const copy = COPY[kind];
  // Inicial: el MES ACTUAL (pedido de Fernando 2026-07-14). El usuario amplía el rango
  // con el filtro; los comparativos igual bajan los otros meses que necesitan.
  const [range, setRange] = React.useState<PeriodRange>(() => presetRange("mes_actual"));
  const periods = React.useMemo(() => expandPeriodRange(range), [range]);
  const { comparativos } = useLibroComparativos(kind, range);

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

  const perMonth = periods.map((periodo, i) => {
    const data = results[i]?.data as (RcvVentasResponse & RcvComprasResponse) | undefined;
    return {
      periodo,
      docs: ((kind === "ventas" ? data?.ventas : data?.compras) ?? []) as RcvDoc[],
    };
  });
  const allDocs = perMonth.flatMap((m) => m.docs);

  const totals = computeRcvTotals(allDocs);
  const docCount = allDocs.length - totals.ncCount; // documentos, sin las NC
  // El API entrega el desglose canónico. Si una fila está incompleta, no se inventa
  // el neto del período desde los campos históricos monto_*.
  const venta = totals.breakdown?.netoSinIva ?? null;

  const isFetching = results.some((r) => r.isFetching);
  const anyError = results.some((r) => r.isError);
  const showHero = !isFetching && allDocs.length > 0;
  const serie = perMonth.map((m) => computeRcvTotals(m.docs).breakdown?.netoSinIva ?? null);
  const showSerie =
    !isFetching && !anyError && serie.length >= 2 && serie.every((value) => value !== null);
  const firstYear = periods[0]?.slice(0, 4);
  const lastYear = periods[periods.length - 1]?.slice(0, 4);
  const multiYear = Boolean(firstYear && lastYear && firstYear !== lastYear);

  const concentracion = concentrationByCounterparty(allDocs, 10).map((c) => ({
    nombre: c.name,
    /* `rut` es null con identidad débil (centinela de extranjero, SIN-RUT, S/D) y acá el
       campo es opcional: sin RUT la fila muestra sólo el nombre, que es lo que la distingue. */
    rut: c.rut ?? undefined,
    monto: c.total,
    pct: c.pct,
  }));

  const lastSynced = results
    .map((r) => (r.data as RcvResp | undefined)?.last_synced_at)
    .filter((v): v is string => Boolean(v))
    .sort()
    .at(-1);
  // `stale` = el SII no respondió y se sirvió cache (dato viejo). Se avisa junto al total.
  const anyStale = results.some((r) => Boolean((r.data as RcvResp | undefined)?.stale));
  const frescura = lastSynced
    ? `Datos al ${formatDateLike(lastSynced)} · SII${anyStale ? " · desactualizado" : ""}`
    : undefined;

  const secundarios: HeroSecundario[] = [
    {
      label: copy.ivaLabel,
      valor: totals.breakdown ? formatClp(totals.breakdown.iva) : "Sin información",
      tono: "brand",
    },
    {
      label: kind === "ventas" ? "Documentos emitidos" : "Documentos recibidos",
      valor: String(docCount),
    },
    {
      label: `Notas de crédito${totals.ncCount ? ` (${totals.ncCount})` : ""}`,
      valor:
        totals.breakdown && totals.ncTotal !== null && totals.ncCount
          ? formatClp(-totals.ncTotal)
          : "Sin información",
      tono: "neg",
    },
  ];

  const query = {
    data:
      kind === "ventas" ? { status: "ok", ventas: allDocs } : { status: "ok", compras: allDocs },
    isLoading: allDocs.length === 0 && results.some((r) => r.isLoading),
    isFetching,
    isError: results.length > 0 && results.every((r) => r.isError),
    error: results.find((r) => r.isError)?.error ?? null,
  } as unknown as UseQueryResult<RcvResp, unknown>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <PeriodRangeFilter
          value={range}
          onChange={setRange}
          hint="Los datos vienen del SII por mes; el rango consulta cada mes y los junta."
        />
        <div className="flex-1" />
      </div>

      {showHero && (
        <VentasHero
          titulo={copy.titulo}
          montoNeto={venta}
          subtitulo={
            totals.breakdown
              ? `Neto sin IVA del período · ${docCount} ${docCount === 1 ? copy.docSingular : copy.docPlural}`
              : `Desglose incompleto en ${totals.incompleteCount} ${totals.incompleteCount === 1 ? "documento" : "documentos"}`
          }
          infoHint={copy.infoHint}
          comparativos={comparativos}
          serie={showSerie ? serie.filter((value): value is number => value !== null) : undefined}
          serieMeses={showSerie ? perMonth.map((m) => mesCorto(m.periodo, multiYear)) : undefined}
          secundarios={secundarios}
          frescura={frescura}
          frescuraStale={anyStale}
        />
      )}

      <div className={showHero ? "grid items-start gap-4 lg:grid-cols-[1fr_300px]" : undefined}>
        <RcvListView
          kind={kind}
          period={`${range.desde}_${range.hasta}`}
          onPeriodChange={() => {}}
          query={query}
          headerLabel={formatRangeLabel(range)}
          tableOnly
        />
        {showHero && totals.breakdown && (
          <ConcentracionClientes titulo={copy.concentracion} items={concentracion} />
        )}
      </div>
    </div>
  );
}
