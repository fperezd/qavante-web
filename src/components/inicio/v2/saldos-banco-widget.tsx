"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import type { SaldosBanco } from "./saldos-banco-model";

/* Widget "Saldos en banco" del Inicio: total en pesos + saldo por cuenta. Presentacional: recibe los
   saldos ya derivados. Lleva a /banco (regla "todo dato lleva a su detalle"). */

export interface SaldosBancoWidgetProps {
  data: SaldosBanco;
  href?: string;
  cta?: string;
}

export function SaldosBancoWidget({ data, href = "/banco", cta = "Ver banco" }: SaldosBancoWidgetProps) {
  const totalNeg = data.totalClp < 0;
  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={<span className="font-medium">Saldos en banco</span>}
    >
      <p className="text-xs text-neutral-mid">Total en pesos</p>
      <p
        className={cn(
          "text-2xl font-extrabold tabular-nums tracking-tight",
          totalNeg ? "text-danger-500" : "text-success-700",
        )}
      >
        {totalNeg ? "−" : ""}
        {formatClp(Math.abs(data.totalClp))}
      </p>

      <ul className="mt-2 flex flex-col divide-y divide-border/60">
        {data.cuentas.map((c) => (
          <li key={c.numero} className="flex items-center justify-between gap-2 py-1.5 text-sm">
            <span className="min-w-0 truncate text-neutral-mid">
              {c.nombre}
              {c.extranjera && (
                <span className="ml-1 text-[11px] text-neutral-mid">({c.moneda})</span>
              )}
            </span>
            <span
              className={cn(
                "shrink-0 tabular-nums",
                c.saldo < 0 ? "text-danger-500" : "text-neutral-strong",
              )}
            >
              {c.saldo < 0 ? "−" : ""}
              {formatClp(Math.abs(c.saldo))}
            </span>
          </li>
        ))}
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
