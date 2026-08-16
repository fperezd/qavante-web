"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/formatters/clp";
import { noTotalReason, type MultiCurrencyTotals } from "./multi-currency";

/* Desglose de totales POR MONEDA cuando no se puede mostrar un total único
   (INV-FX-001). Se muestra en vez del total, nunca además de un total mezclado.

   Regla de producto: sin tipo de cambio cableado, el frontend NO convierte. Dice
   la verdad — "$X en CLP y US$Y en USD" — en lugar de inventar un número que
   suma peras con manzanas. Si además hay movimientos sin moneda conocida, lo
   declara y los deja fuera. */

export interface MultiCurrencyTotalsBreakdownProps {
  totals: MultiCurrencyTotals;
  /** Etiqueta de la fila de neto (ej. "Neto del período"). */
  label?: string;
  className?: string;
}

export function MultiCurrencyTotalsBreakdown({
  totals,
  label = "Neto",
  className,
}: MultiCurrencyTotalsBreakdownProps) {
  const reason = noTotalReason(totals);

  return (
    <div className={cn("space-y-2", className)} role="group" aria-label="Totales por moneda">
      {totals.totals.length > 0 && (
        <ul className="space-y-1">
          {totals.totals.map((t) => (
            <li
              key={t.currency}
              className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm"
            >
              <span className="text-neutral-mid">
                {label} en <span className="font-medium text-neutral-dark">{t.currency}</span>
                <span className="ml-1 text-xs">
                  ({t.count} {t.count === 1 ? "movimiento" : "movimientos"})
                </span>
              </span>
              <span className="flex items-baseline gap-3 tabular-nums">
                <span className="text-xs text-neutral-mid">
                  Ingresos {formatMoney(t.credit, t.currency)} · Egresos{" "}
                  {formatMoney(t.debit, t.currency)}
                </span>
                <span
                  className={cn(
                    "font-semibold",
                    t.net >= 0 ? "text-success-700" : "text-warning-700",
                  )}
                >
                  {t.net >= 0 ? "+" : "−"} {formatMoney(Math.abs(t.net), t.currency)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {reason && (
        <p
          role="status"
          className="flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-warning-700"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{reason}</span>
        </p>
      )}
    </div>
  );
}
