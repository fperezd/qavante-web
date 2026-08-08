"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { Margenes } from "./margenes-model";

/* Widget "Márgenes" del Inicio: margen bruto y neto del mes cerrado. Presentacional: recibe los márgenes
   ya derivados. Lleva a /gestion (regla "todo dato lleva a su detalle"). */

export interface MargenesWidgetProps {
  data: Margenes;
  href?: string;
  cta?: string;
}

function pct(v: number | null): string {
  if (v == null) return "—";
  return v < 0 ? `−${Math.abs(v)}%` : `${v}%`;
}

export function MargenesWidget({ data, href = "/gestion", cta = "Ver gestión" }: MargenesWidgetProps) {
  const netoNeg = data.netoMonto < 0;
  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Márgenes</span>}
    >
      <p className="text-xs capitalize text-neutral-mid">{data.mesLabel} (mes cerrado)</p>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-neutral-light/30 p-3">
          <p className="text-[11px] text-neutral-mid">Margen bruto</p>
          <p className="text-2xl font-bold tabular-nums text-neutral-strong">{pct(data.brutoPct)}</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-neutral-mid">
            {formatClp(data.brutoMonto)}
          </p>
        </div>
        <div className="rounded-lg bg-neutral-light/30 p-3">
          <p className="text-[11px] text-neutral-mid">Margen neto</p>
          <p
            className={cn(
              "text-2xl font-bold tabular-nums",
              netoNeg ? "text-danger-500" : "text-success-700",
            )}
          >
            {pct(data.netoPct)}
          </p>
          <p
            className={cn(
              "mt-0.5 text-[11px] tabular-nums",
              netoNeg ? "text-danger-500" : "text-neutral-mid",
            )}
          >
            {netoNeg ? "−" : ""}
            {formatClp(Math.abs(data.netoMonto))}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs text-neutral-mid">
        De cada $100 vendidos, te quedan {data.brutoPct != null ? `$${data.brutoPct}` : "—"} después
        del costo directo{data.netoPct != null ? ` y $${data.netoPct} al final` : ""}.
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
