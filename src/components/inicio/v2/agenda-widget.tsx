"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { GrupoAgenda } from "./agenda-model";

/* Widget "Agenda de las próximas 2 semanas" del Inicio (gated `inicioAgenda`): los cobros y pagos con
   fecha y monto, agrupados por semana. Presentacional: recibe los grupos ya compuestos; el contenedor
   los deriva de los vencimientos (mismo motor que Cobrar/Pagar/Caja). Cobros en verde (entra), pagos en
   rojo (sale). Cada uno lleva a su detalle (regla "todo dato lleva a su detalle"). */

export interface AgendaWidgetProps {
  grupos: GrupoAgenda[];
  /** Cuántos hay en total (para el header). */
  cobros: number;
  pagos: number;
  href?: string;
  cta?: string;
}

export function AgendaWidget({
  grupos,
  cobros,
  pagos,
  href = "/caja/proyeccion",
  cta = "Ver caja",
}: AgendaWidgetProps) {
  const total = grupos.reduce((n, g) => n + g.items.length, 0);

  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={
        <span className="flex items-center gap-1.5 font-medium">
          <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          Próximas 2 semanas
        </span>
      }
    >
      {total === 0 ? (
        <p className="py-4 text-center text-sm text-neutral-mid">
          Nada por cobrar ni pagar en las próximas dos semanas.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-neutral-mid">
            Entra <span className="font-semibold text-success-700">{formatClp(cobros)}</span> · sale{" "}
            <span className="font-semibold text-danger-500">{formatClp(pagos)}</span>
          </p>
          <div className="space-y-3">
            {grupos.map((g) => (
              <div key={g.titulo}>
                <p className="mb-1.5 flex items-baseline gap-2 text-xs font-semibold text-neutral-dark">
                  {g.titulo}
                  <span className="font-normal text-neutral-mid">· {g.rango}</span>
                </p>
                {g.items.length === 0 ? (
                  <p className="pl-1 text-xs text-neutral-mid">Sin vencimientos.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {g.items.map((m, i) => {
                      const entra = m.monto >= 0;
                      return (
                        <li
                          key={`${m.label}-${m.fechaLabel}-${i}`}
                          className="flex items-center gap-3 text-sm"
                        >
                          <span className="w-14 shrink-0 text-xs tabular-nums text-neutral-mid">
                            {m.fechaLabel}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-neutral-dark">
                            {m.label}
                          </span>
                          <span
                            className={cn(
                              "shrink-0 whitespace-nowrap font-medium tabular-nums",
                              entra ? "text-success-600" : "text-danger-500",
                            )}
                          >
                            {entra ? "+" : "−"}
                            {formatClp(Math.abs(m.monto))}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </>
      )}

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
