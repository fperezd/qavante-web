"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import type { Remuneraciones } from "./remuneraciones-model";

/* Widget "Remuneraciones" del Inicio: líquido de la planilla del mes + dotación + cotizaciones.
   Presentacional: recibe los totales ya derivados. Lleva a /remuneraciones. */

export interface RemuneracionesWidgetProps {
  data: Remuneraciones;
  href?: string;
  cta?: string;
}

export function RemuneracionesWidget({
  data,
  href = "/remuneraciones",
  cta = "Ver remuneraciones",
}: RemuneracionesWidgetProps) {
  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Remuneraciones</span>}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs capitalize text-neutral-mid">Líquido de {data.mesLabel}</p>
          <p className="text-2xl font-bold tabular-nums text-neutral-strong">
            {formatClp(data.liquido)}
          </p>
        </div>
        {data.empleados != null && (
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-light/40 px-2.5 py-1 text-sm font-medium tabular-nums text-neutral-mid">
            <Users className="h-4 w-4" aria-hidden="true" />
            {data.empleados}
          </span>
        )}
      </div>

      {data.cotizaciones != null && (
        <p className="mt-2 text-xs tabular-nums text-neutral-mid">
          Cotizaciones (Previred): {formatClp(data.cotizaciones)}
        </p>
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
