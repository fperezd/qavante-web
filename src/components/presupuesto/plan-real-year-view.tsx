"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { QavanteCard } from "@/components/qavante";
import type { PlanRealYear, PlanRealCelda } from "./plan-real-year-model";

/* Plan vs Real por cuenta-mes: grilla READ-ONLY (cuentas × meses) con el REAL de cada celda, coloreado
   por si va a FAVOR o EN CONTRA del plan (variación signada). Presentacional: recibe el modelo + las
   etiquetas de mes. Carga progresiva: muestra lo que ya llegó y un aviso "N/M" mientras cargan meses. */

function fmt(n: number): string {
  const r = Math.round(n);
  return r === 0 ? "0" : Math.abs(r).toLocaleString("es-CL");
}

/** Color del texto por la variación: a favor (≥0) verde, en contra rojo, ~0 neutro. */
function tono(variacion: number): string {
  if (Math.abs(Math.round(variacion)) === 0) return "text-neutral-dark";
  return variacion > 0 ? "text-success-700" : "text-danger-500";
}

function Celda({ celda }: { celda: PlanRealCelda | null }) {
  if (!celda) return <span className="text-neutral-mid/50">s/d</span>;
  return (
    <span
      className={cn("tabular-nums", tono(celda.variacion))}
      title={`Real ${fmt(celda.real)} · ${celda.variacion >= 0 ? "a favor" : "en contra"} ${fmt(celda.variacion)}`}
    >
      {fmt(celda.real)}
    </span>
  );
}

export interface PlanRealYearViewProps {
  model: PlanRealYear;
  /** Etiquetas de mes en el mismo orden que las celdas (ej. ["Ene","Feb",…]). */
  meses: string[];
  /** Carga progresiva: cuántos meses ya llegaron de cuántos. */
  cargando?: { hechos: number; total: number };
  className?: string;
}

export function PlanRealYearView({ model, meses, cargando, className }: PlanRealYearViewProps) {
  const incompleto = cargando && cargando.hechos < cargando.total;

  return (
    <QavanteCard variant="bordered" className={cn("overflow-hidden p-0", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="font-medium text-neutral-dark">Plan vs Real, por cuenta y mes</span>
        {incompleto ? (
          <span className="text-[11px] text-neutral-mid">
            Cargando meses… {cargando!.hechos}/{cargando!.total}
          </span>
        ) : (
          <span className="text-[11px] text-neutral-mid">Real del período · verde a favor, rojo en contra</span>
        )}
      </div>

      {model.filas.length === 0 ? (
        <p className="px-4 py-4 text-sm text-neutral-mid">
          {incompleto ? "Trayendo el real por cuenta…" : "Todavía no hay real por cuenta para el período."}
        </p>
      ) : (
        <div className="overflow-x-auto px-2 py-2">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-neutral-mid">
                <th className="sticky left-0 z-10 bg-surface px-3 py-2 text-left font-semibold">Cuenta</th>
                {meses.map((m, i) => (
                  <th key={i} className="px-1.5 py-2 text-right font-semibold">
                    {m}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-semibold text-brand-primary">Año</th>
              </tr>
            </thead>
            <tbody>
              {model.filas.map((f) => (
                <tr
                  key={`${f.accountId ?? f.name}`}
                  className="border-b border-border/40 last:border-b-0"
                >
                  <td className="sticky left-0 z-10 bg-surface px-3 py-1.5 text-neutral-dark">
                    {f.name}
                  </td>
                  {f.meses.map((celda, i) => (
                    <td key={i} className="px-1.5 py-1.5 text-right text-xs">
                      <Celda celda={celda} />
                    </td>
                  ))}
                  <td className={cn("px-3 py-1.5 text-right text-xs font-medium tabular-nums", tono(f.totalVariacion))}>
                    {fmt(f.totalReal)}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border-strong bg-surface-muted/60 font-bold">
                <td className="sticky left-0 z-10 bg-surface-muted/60 px-3 py-2 text-neutral-dark">
                  Resultado
                </td>
                {model.totalRealMes.map((v, i) => (
                  <td
                    key={i}
                    className={cn("px-1.5 py-2 text-right text-xs tabular-nums", v < 0 ? "text-danger-500" : "text-neutral-dark")}
                  >
                    {v < 0 ? "−" : ""}
                    {fmt(v)}
                  </td>
                ))}
                <td className={cn("px-3 py-2 text-right text-xs tabular-nums", model.totalRealAnio < 0 ? "text-danger-500" : "text-neutral-dark")}>
                  {model.totalRealAnio < 0 ? "−" : ""}
                  {fmt(model.totalRealAnio)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </QavanteCard>
  );
}
