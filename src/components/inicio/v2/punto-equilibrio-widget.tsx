"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import { mesCorto } from "@/components/gestion/v2/gestion-v2-map";
import type { PuntoEquilibrio } from "@/components/gestion/v2/punto-equilibrio-model";

/* Widget "Punto de equilibrio" del Inicio: el piso concreto de venta = lo que GASTASTE el último mes
   cerrado (modelo `computePuntoEquilibrio`, ya testeado). Presentacional. Lleva a /gestion. */

export interface PuntoEquilibrioWidgetProps {
  data: PuntoEquilibrio;
  href?: string;
  cta?: string;
}

export function PuntoEquilibrioWidget({
  data,
  href = "/gestion",
  cta = "Ver gestión",
}: PuntoEquilibrioWidgetProps) {
  const { totalACubrir, ingresoMes, mes } = data;
  const cubierto = ingresoMes >= totalACubrir;
  const brecha = Math.abs(ingresoMes - totalACubrir);

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Punto de equilibrio</span>}
    >
      <p className="text-xs capitalize text-neutral-mid">{mesCorto(mes)} (mes cerrado)</p>
      <p className="text-sm text-neutral-mid">Necesitas vender al menos</p>
      <p className="text-2xl font-extrabold tabular-nums tracking-tight text-neutral-strong">
        {formatClp(totalACubrir)}
      </p>
      <p className="text-xs text-neutral-mid">para no perder (lo que gastaste ese mes).</p>

      <p
        className={cn(
          "mt-2 text-sm",
          cubierto ? "text-success-700" : "text-danger-500",
        )}
      >
        {cubierto ? (
          <>
            Ese mes vendiste {formatClp(ingresoMes)}: cubriste el piso con {formatClp(brecha)} de
            aire.
          </>
        ) : (
          <>
            Ese mes vendiste {formatClp(ingresoMes)}: te faltaron {formatClp(brecha)} para cubrirlo.
          </>
        )}
      </p>

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
