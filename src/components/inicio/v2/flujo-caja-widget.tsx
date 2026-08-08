"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { FlujoCaja } from "./flujo-caja-model";

/* Widget "Flujo de caja" (real) del Inicio: lo que ENTRÓ y SALIÓ por mes cerrado, con barra doble
   (verde entró / rojo salió) y el neto. Responde "¿entra más de lo que sale?" de un vistazo.
   Presentacional: recibe el flujo ya derivado. Lleva a /caja (regla "todo dato lleva a su detalle"). */

export interface FlujoCajaWidgetProps {
  data: FlujoCaja;
  href?: string;
  cta?: string;
}

export function FlujoCajaWidget({ data, href = "/caja", cta = "Ver caja" }: FlujoCajaWidgetProps) {
  // Escala común de las barras: el mayor movimiento (entró o salió) de cualquier mes.
  const maxAbs = Math.max(1, ...data.meses.map((m) => Math.max(m.ingresos, m.egresos)));
  // Más nuevo arriba; el primero se resalta.
  const filas = [...data.meses].reverse();

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Flujo de caja</span>}
    >
      <p className="text-xs text-neutral-mid">Lo que entró y salió, por mes cerrado</p>

      <ul className="mt-2 flex flex-col gap-2.5">
        {filas.map((m, i) => {
          const positivo = m.neto >= 0;
          return (
            <li key={m.periodo} className={cn("text-sm", i === 0 && "font-medium")}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="capitalize text-neutral-mid">{m.mesLabel}</span>
                <span
                  className={cn("tabular-nums", positivo ? "text-success-700" : "text-danger-500")}
                >
                  {positivo ? "+" : "−"}
                  {formatClp(Math.abs(m.neto))}
                </span>
              </div>
              {/* Barra doble: entró (verde) sobre salió (rojo), a escala común → se compara mes a mes. */}
              <div className="mt-1 flex flex-col gap-0.5" aria-hidden="true">
                <div className="h-1.5 rounded-full bg-neutral-light/40">
                  <div
                    className="h-full rounded-full bg-success-700"
                    style={{ width: `${(m.ingresos / maxAbs) * 100}%` }}
                  />
                </div>
                <div className="h-1.5 rounded-full bg-neutral-light/40">
                  <div
                    className="h-full rounded-full bg-danger-500"
                    style={{ width: `${(m.egresos / maxAbs) * 100}%` }}
                  />
                </div>
              </div>
              <p className="mt-0.5 text-[11px] text-neutral-mid tabular-nums">
                Entró {formatClp(m.ingresos)} · Salió {formatClp(m.egresos)}
              </p>
            </li>
          );
        })}
      </ul>

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
