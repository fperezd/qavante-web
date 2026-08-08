"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { VentasPorMes } from "./ventas-mes-model";

/* Widget "Ventas por mes" del Inicio: barras verticales del neto vendido mes a mes (tendencia), con el
   último mes y su variación. Presentacional: recibe la serie ya derivada. Lleva a /gestion. */

export interface VentasMesWidgetProps {
  data: VentasPorMes;
  href?: string;
  cta?: string;
}

export function VentasMesWidget({
  data,
  href = "/gestion/ventas",
  cta = "Ver ventas",
}: VentasMesWidgetProps) {
  const maxAbs = Math.max(1, ...data.meses.map((m) => Math.abs(m.neto)));
  const { variacionPct } = data;
  const subio = variacionPct != null && variacionPct >= 0;
  const Icon = subio ? TrendingUp : TrendingDown;

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Ventas por mes</span>}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs capitalize text-neutral-mid">{data.ultimo.mesLabel}</p>
          <p className="text-xl font-bold tabular-nums text-neutral-strong">
            {formatClp(data.ultimo.neto)}
          </p>
        </div>
        {variacionPct != null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-sm font-medium tabular-nums",
              subio ? "text-success-700" : "text-danger-500",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {subio ? "+" : "−"}
            {Math.abs(variacionPct)}%
          </span>
        )}
      </div>

      {/* Barras verticales a escala común → la tendencia se lee de un vistazo. */}
      <div className="mt-3 flex h-20 items-end gap-1.5" aria-hidden="true">
        {data.meses.map((m, i) => (
          <div key={m.periodo} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 items-end">
              <div
                className={cn(
                  "w-full rounded-t",
                  i === data.meses.length - 1 ? "bg-brand-primary" : "bg-brand-primary/40",
                )}
                style={{ height: `${Math.max(2, (Math.abs(m.neto) / maxAbs) * 100)}%` }}
              />
            </div>
            <span className="text-[10px] capitalize text-neutral-mid">{m.mesLabel.slice(0, 3)}</span>
          </div>
        ))}
      </div>

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
