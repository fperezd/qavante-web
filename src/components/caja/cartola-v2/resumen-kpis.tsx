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

/* Monto calmo: el número siempre en neutro; una flecha chica y sobria carga la
 * dirección (↗ sale / ↘ entra). El único rojo del bloque es el saldo negativo. */
function DirectionalAmount({ kpi }: { kpi: CartolaKpi }) {
  const abs = Math.abs(kpi.value);
  const Icon = kpi.direction === "out" ? ArrowUpRight : ArrowDownRight;
  const iconTone = kpi.direction === "out" ? "text-danger-500" : "text-success-600";
  return (
    <span className="inline-flex items-center gap-1.5 tabular-nums font-semibold text-neutral-dark">
      {kpi.direction && (
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconTone)} aria-hidden="true" />
      )}
      {formatClp(kpi.direction ? abs : kpi.value)}
    </span>
  );
}

export function ResumenKpis({ storyline }: { storyline?: string }) {
  const { saldoFinal, secundarios } = resumenKpis;
  const negative = saldoFinal.value < 0;

  return (
    <QavanteCard variant="bordered" className="overflow-hidden p-0 shadow-sm">
      {/* Hero: saldo final */}
      <div className="flex flex-wrap items-start justify-between gap-6 p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-mid">
            {saldoFinal.label}
            <InfoHint>{saldoFinal.hint}</InfoHint>
          </p>
          <p
            className={cn(
              "mt-2 text-2xl font-semibold leading-none tracking-tight tabular-nums",
              negative ? "text-danger-600" : "text-neutral-dark",
            )}
          >
            <AmountCountUp value={saldoFinal.value} />
          </p>
          {storyline && (
            <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-neutral-mid">
              {storyline}
            </p>
          )}
        </div>
        {saldoFinal.trend && (
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Sparkline
              data={saldoFinal.trend}
              tone={saldoFinal.tone ?? "brand"}
              baseline={0}
              width={176}
              height={52}
            />
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-neutral-mid/70">
              Saldo diario · 30 d
            </span>
          </div>
        )}
      </div>

      {/* Grilla de KPIs secundarios — separada por divisores finos. */}
      <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4 sm:divide-x sm:divide-border">
        {secundarios.map((kpi, i) => (
          <div
            key={kpi.label}
            className={cn(
              "px-6 py-4",
              i >= 2 && "border-t border-border sm:border-t-0",
            )}
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-mid">
              {kpi.label}
              <InfoHint>{kpi.hint}</InfoHint>
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[15px]">
                <DirectionalAmount kpi={kpi} />
              </span>
              {kpi.trend && (
                <Sparkline data={kpi.trend} tone="neutral" width={52} height={20} />
              )}
            </div>
          </div>
        ))}
      </div>
    </QavanteCard>
  );
}
