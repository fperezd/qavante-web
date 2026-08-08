"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { GanandoDinero } from "./ganando-dinero-model";

/* Widget "¿Estás ganando dinero?" del Inicio: la pregunta del dueño, anclada al MES ANTERIOR cerrado
   (el en curso engaña). Presentacional: recibe el resultado ya derivado. Verde si ganó, rojo si perdió;
   con el margen y el mes. Lleva a Gestión (regla "todo dato lleva a su detalle"). */

export interface GanandoDineroWidgetProps {
  data: GanandoDinero;
  href?: string;
  cta?: string;
}

export function GanandoDineroWidget({
  data,
  href = "/gestion",
  cta = "Ver el detalle",
}: GanandoDineroWidgetProps) {
  const { gano, resultado, margenPct, mesLabel } = data;
  const Icon = gano ? TrendingUp : TrendingDown;

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">¿Estás ganando dinero?</span>}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
            gano ? "bg-success-700/10 text-success-700" : "bg-danger-500/10 text-danger-500",
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm text-neutral-mid">En {mesLabel} (mes cerrado) tu negocio</p>
          <p
            className={cn(
              "text-xl font-bold tabular-nums",
              gano ? "text-success-700" : "text-danger-500",
            )}
          >
            {gano ? "ganó " : "perdió "}
            {formatClp(Math.abs(resultado))}
          </p>
          <p className="mt-1 text-xs text-neutral-mid">
            {margenPct != null ? (
              <>Margen operacional {margenPct}%</>
            ) : (
              <>Resultado operacional del mes</>
            )}
            {" · "}
            <span className="italic">no es el mes en curso, que aún está incompleto</span>
          </p>
        </div>
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
