"use client";

import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { QavanteBadge } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import { movimientos, type CartolaMovimiento } from "./cartola-v2-fixtures";

/* Movimientos estilo "card-row" (como la grilla de transferencias de la banca):
 * cada fila es una tarjeta aireada con sombra sutil. Para listas cortas/medianas
 * (movimientos, transferencias) lee premium; para cientos de filas seguimos con la
 * tabla densa (Libro). Montos exactos con signo (−$X); direccional por color+flecha. */

const COLS = "grid-cols-[92px_84px_1fr_140px_120px]";

function MontoCell({ m }: { m: CartolaMovimiento }) {
  const out = m.monto < 0;
  const Icon = out ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 tabular-nums font-semibold",
        out ? "text-danger-500" : "text-success-700",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {formatClp(m.monto)}
    </span>
  );
}

export function MovimientosGrid() {
  return (
    <div className="space-y-2">
      {/* Header */}
      <div
        className={cn(
          "grid items-center gap-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid",
          COLS,
        )}
      >
        <span>Fecha</span>
        <span>Tipo</span>
        <span>Descripción</span>
        <span className="text-right">Monto</span>
        <span className="text-right">Saldo contable</span>
      </div>

      {/* Filas-tarjeta */}
      <ul className="space-y-2">
        {movimientos.map((m, i) => (
          <li
            key={i}
            className={cn(
              "grid items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm transition-colors hover:border-brand-primary/40",
              COLS,
            )}
          >
            <span className="text-neutral-mid">{m.fecha}</span>
            <span>
              <QavanteBadge variant={m.tipo === "Cargo" ? "warning" : "success"}>
                {m.tipo}
              </QavanteBadge>
            </span>
            <span className="min-w-0 truncate text-neutral-dark" title={m.descripcion}>
              {m.descripcion}
            </span>
            <span className="text-right">
              <MontoCell m={m} />
            </span>
            <span className="text-right tabular-nums text-neutral-mid">{formatClp(m.saldo)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
