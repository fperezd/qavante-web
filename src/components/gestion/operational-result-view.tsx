"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { QavanteBadge, QavanteEmpty } from "@/components/qavante";
import { useOperationalResult, useOperationalResultBreakdown } from "@/lib/api/gestion";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { PeriodRangeFilter } from "@/components/filters/period-range-filter";
import { orderRange, type PeriodRange } from "@/lib/period/period-range";
import { GestionV2ViewLive } from "./v2/gestion-v2-view-live";
import { GestionV2RangoView } from "./v2/gestion-v2-rango-view";

/* Resultado Operacional de Gestión (Sprint C5, Maestro §7.5). Container: resuelve el dato por
   período y monta la vista v2 (respuesta de dueño + cascada del resultado + drivers + margen en el
   tiempo). La vista clásica se RETIRÓ: mantener dos vistas para lo mismo era dos lugares donde
   romperse, y la clásica no tenía el guard de plausibilidad que degrada honesto el resultado cuando
   los costos vienen incompletos (gap A1: el resultado excluye remuneraciones). v2 es la única.

   Gated por el flag `operationalResult` (la page lo resuelve). Badge obligatorio "no es contabilidad
   oficial". Estados canónicos (Anexo C): loading / error / sin datos (404) / disponible. NO asume
   faltante = 0 (§13). */

export interface OperationalResultViewProps {
  /** Período inicial "YYYY-MM" (lo calcula la page en America/Santiago). */
  initialPeriod: string;
}

export function OperationalResultView({ initialPeriod }: OperationalResultViewProps) {
  /* Selector de rango idéntico al resto de la app (pedido de Fernando: no solo
     un mes). Default = mes actual (rango de un mes). Un mes → vista rica (con
     desglose fino + drivers); varios meses → agregado del período + mes a mes. */
  const [range, setRange] = React.useState<PeriodRange>(() => ({
    desde: initialPeriod,
    hasta: initialPeriod,
  }));
  const ordered = orderRange(range);
  const single = ordered.desde === ordered.hasta;

  // Solo una de las dos queries corre a la vez (la otra queda deshabilitada).
  const monthQuery = useOperationalResult(single ? ordered.hasta : "");
  const breakdownQuery = useOperationalResultBreakdown(ordered.desde, ordered.hasta, {
    enabled: !single,
  });

  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <PeriodRangeFilter
        value={range}
        onChange={setRange}
        hint="El resultado se calcula por mes; el rango suma los meses seleccionados."
      />
      <QavanteBadge variant="default">
        Resultado de gestión · no es contabilidad oficial
      </QavanteBadge>
    </div>
  );

  return (
    <div className="space-y-4">
      {header}
      {single ? (
        <StateWrap
          query={monthQuery}
          emptyTitle="Sin datos para este mes"
          emptyDescription="Todavía no hay resultado operacional para el mes seleccionado. Prueba otro mes o vuelve cuando se sincronicen las fuentes."
        >
          {(data) => <GestionV2ViewLive mes={data} period={ordered.hasta} />}
        </StateWrap>
      ) : (
        <StateWrap
          query={breakdownQuery}
          emptyTitle="Sin datos para este período"
          emptyDescription="Todavía no hay resultado operacional para el rango seleccionado. Prueba otro rango o vuelve cuando se sincronicen las fuentes."
        >
          {(data) => <GestionV2RangoView data={data} />}
        </StateWrap>
      )}
    </div>
  );
}

/* Estados canónicos (Anexo C): loading / 404 sin datos / error / disponible. NO asume faltante = 0. */
function StateWrap<T>({
  query,
  emptyTitle,
  emptyDescription,
  children,
}: {
  query: { isLoading: boolean; isError: boolean; error: unknown; data: T | undefined };
  emptyTitle: string;
  emptyDescription: string;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.isNotFound()) {
      return <QavanteEmpty title={emptyTitle} description={emptyDescription} />;
    }
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <p>
          {query.error instanceof ApiError
            ? apiErrorToUserMessage(query.error)
            : "No pudimos cargar el resultado operacional. Intenta nuevamente."}
        </p>
      </div>
    );
  }
  return query.data ? <>{children(query.data)}</> : null;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="h-64 animate-pulse rounded-xl bg-neutral-light/30" />
    </div>
  );
}
