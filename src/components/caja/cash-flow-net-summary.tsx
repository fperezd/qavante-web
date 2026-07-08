"use client";

import * as React from "react";
import { QavanteCard } from "@/components/qavante";
import { Sparkline } from "@/components/ui/sparkline";
import { InfoHint } from "@/components/ui/info-hint";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { CashFlowReportResponse } from "@/lib/api/treasury-reports";
import { parseDecimal, normalizeNet } from "./cash-flow-format";

/* Resumen visual del flujo neto del rango: el neto total como número de oro +
   un sparkline del neto por período (semana/mes/día) con línea de cero, para
   ver de un vistazo dónde la caja entró en déficit. Presentacional puro: recibe
   la data ya resuelta. Complementa la tabla densa (no la reemplaza). Los datos
   son 100% reales (buckets[].net del reporte del backend). */

const GRAN_LABEL: Record<string, string> = {
  month: "mes",
  week: "semana",
  day: "día",
};

export function CashFlowNetSummary({ data }: { data: CashFlowReportResponse }) {
  const buckets = data.buckets ?? [];
  // El sparkline necesita al menos 2 períodos para contar una tendencia.
  if (buckets.length < 2) return null;

  const series = buckets.map((b) => normalizeNet(parseDecimal(b.net)));
  const grand = data.grand_total;
  const grandNet = grand
    ? normalizeNet(parseDecimal(grand.net))
    : series.reduce((a, b) => a + b, 0);
  const inflow = grand ? parseDecimal(grand.inflow) : 0;
  const outflow = grand ? parseDecimal(grand.outflow) : 0;
  const negative = grandNet < 0;
  const granLabel = GRAN_LABEL[data.granularity] ?? "período";

  return (
    <QavanteCard variant="bordered">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-mid">
            Flujo neto del rango
            <InfoHint label="Qué significa el flujo neto">
              Lo que entró menos lo que salió de tu caja en el rango. Positivo = la caja creció;
              negativo = se consumió.
            </InfoHint>
          </p>
          <p
            className={cn(
              "mt-1.5 text-2xl font-semibold leading-none tracking-tight tabular-nums",
              negative ? "text-danger-600" : "text-neutral-dark",
            )}
          >
            {formatClp(grandNet)}
          </p>
          <p className="mt-1.5 text-xs text-neutral-mid">
            Entró <span className="tabular-nums">{formatClp(inflow)}</span> · salió{" "}
            <span className="tabular-nums">{formatClp(outflow)}</span> en el rango
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Sparkline
            data={series}
            tone={negative ? "danger" : "success"}
            baseline={0}
            width={180}
            height={48}
          />
          <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-mid/70">
            Neto por {granLabel} · {series.length}
          </span>
        </div>
      </div>
    </QavanteCard>
  );
}
