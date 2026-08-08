"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { PlanReal } from "./plan-real-model";

/* Widget "Plan vs Real" (presupuesto vs real) del Inicio: la vista contable clásica (ingresos, costo,
   gastos, resultado) con Plan | Real | desviación, MENSUAL o ANUAL. Presentacional: recibe el PlanReal
   ya derivado + el modo (el contenedor gobierna qué data trae). Δ en verde si es favorable, rojo si no. */

export type PlanRealModo = "mes" | "anio";

export interface PlanRealWidgetProps {
  data: PlanReal;
  modo?: PlanRealModo;
  onModoChange?: (m: PlanRealModo) => void;
  href?: string;
  cta?: string;
}

export function PlanRealWidget({
  data,
  modo = "mes",
  onModoChange,
  href = "/gestion",
  cta = "Ver gestión",
}: PlanRealWidgetProps) {
  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Plan vs Real</span>
          {onModoChange && (
            <div className="flex rounded-lg bg-neutral-light/40 p-0.5 text-xs" role="tablist">
              {(["mes", "anio"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={modo === m}
                  onClick={() => onModoChange(m)}
                  className={cn(
                    "rounded-md px-2 py-0.5 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
                    modo === m ? "bg-surface text-neutral-strong shadow-sm" : "text-neutral-mid",
                  )}
                >
                  {m === "mes" ? "Mes" : "Año"}
                </button>
              ))}
            </div>
          )}
        </div>
      }
    >
      <p className="text-xs capitalize text-neutral-mid">{data.periodoLabel}</p>

      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wider text-neutral-mid">
            <th className="pb-1 text-left font-semibold">Concepto</th>
            <th className="pb-1 text-right font-semibold">Plan</th>
            <th className="pb-1 text-right font-semibold">Real</th>
            <th className="pb-1 text-right font-semibold">Δ</th>
          </tr>
        </thead>
        <tbody>
          {data.filas.map((f) => {
            const esResultado = f.concepto === "result";
            return (
              <tr
                key={f.concepto}
                className={cn(
                  "border-t border-border/60",
                  esResultado && "border-t-2 border-border font-semibold",
                )}
              >
                <td className="py-1 text-left text-neutral-strong">{f.label}</td>
                <td className="py-1 text-right tabular-nums text-neutral-mid">
                  {formatClp(f.plan)}
                </td>
                <td className="py-1 text-right tabular-nums">{formatClp(f.real)}</td>
                <td
                  className={cn(
                    "py-1 text-right tabular-nums",
                    f.favorable ? "text-success-700" : "text-danger-500",
                  )}
                >
                  {f.variacionPct != null
                    ? `${f.variacionPct > 0 ? "+" : f.variacionPct < 0 ? "−" : ""}${Math.abs(f.variacionPct)}%`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <Link
        href={href}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        {cta}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </QavanteCard>
  );
}
