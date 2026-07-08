"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { QavanteCard, AmountCountUp } from "@/components/qavante";
import { InfoHint } from "@/components/ui/info-hint";
import { Sparkline } from "@/components/ui/sparkline";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import { resumenKpis, type CartolaKpi } from "./cartola-v2-fixtures";

/* Resumen del período (prototipo "cartola nivel dios") — el número de oro (saldo
 * final) como hero con count-up + sparkline + su ⓘ; el resto en una grilla densa
 * con flecha direccional (↗ sale / ↘ entra) y su ⓘ. Espeja el resumen de la banca
 * pero: montos exactos (−$X, no "CLP -X"), tooltips accesibles por teclado, y una
 * frase de historia que un banco no da. */

function DirectionalAmount({ kpi }: { kpi: CartolaKpi }) {
  const abs = Math.abs(kpi.value);
  if (kpi.direction === "out") {
    return (
      <span className="inline-flex items-center gap-1 tabular-nums font-semibold text-danger-500">
        <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        {formatClp(abs)}
      </span>
    );
  }
  if (kpi.direction === "in") {
    return (
      <span className="inline-flex items-center gap-1 tabular-nums font-semibold text-success-700">
        <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
        {formatClp(abs)}
      </span>
    );
  }
  return (
    <span className="tabular-nums font-semibold text-neutral-dark">{formatClp(kpi.value)}</span>
  );
}

export function ResumenKpis({ storyline }: { storyline?: string }) {
  const { saldoFinal, secundarios } = resumenKpis;
  const negative = saldoFinal.value < 0;

  return (
    <QavanteCard variant="bordered" className="overflow-hidden p-0">
      {/* Hero: saldo final */}
      <div className="flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            {saldoFinal.label}
            <InfoHint>{saldoFinal.hint}</InfoHint>
          </p>
          <p
            className={cn(
              "mt-1 text-3xl font-bold leading-none tabular-nums",
              negative ? "text-danger-500" : "text-neutral-dark",
            )}
          >
            <AmountCountUp value={saldoFinal.value} />
          </p>
          {storyline && <p className="mt-2 max-w-md text-sm text-neutral-mid">{storyline}</p>}
        </div>
        {saldoFinal.trend && (
          <Sparkline
            data={saldoFinal.trend}
            tone={saldoFinal.tone ?? "brand"}
            width={168}
            height={48}
          />
        )}
      </div>

      {/* Grilla de KPIs secundarios */}
      <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4 sm:divide-x sm:divide-border">
        {secundarios.map((kpi, i) => (
          <div
            key={kpi.label}
            className={cn("px-5 py-3.5", i >= 2 && "border-t border-border sm:border-t-0")}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              {kpi.label}
              <InfoHint>{kpi.hint}</InfoHint>
            </p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-base">
                <DirectionalAmount kpi={kpi} />
              </span>
              {kpi.trend && (
                <Sparkline data={kpi.trend} tone={kpi.tone ?? "neutral"} width={64} height={22} />
              )}
            </div>
          </div>
        ))}
      </div>
    </QavanteCard>
  );
}
