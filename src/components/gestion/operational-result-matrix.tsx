"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import type { OperationalResultBreakdown } from "@/lib/api/gestion";
import { parseAmount } from "./gestion-format";
import { flattenBreakdown, formatMonthColumn } from "./breakdown-format";

/* Estado de Resultados mensualizado (estilo Chipax): meses en columnas, filas
   jerárquicas del árbol de cuentas (Ingresos/Costos/Margen…), columna Total y el
   mes en curso marcado "(proforma)". Las secciones/subtotales se expanden y
   contraen. Presentacional puro: recibe el breakdown ya resuelto. */

/** Celda de monto: sin "$" (denso, como un EERR); 0 → "—"; negativos con el
 *  "−" tipográfico (U+2212, convención de la casa), no el guion. */
function fmtCell(v: string): string {
  const n = Math.round(parseAmount(v));
  if (n === 0) return "—";
  return (n < 0 ? "−" : "") + Math.abs(n).toLocaleString("es-CL");
}

export function OperationalResultMatrix({ data }: { data: OperationalResultBreakdown }) {
  const [collapsed, setCollapsed] = React.useState<ReadonlySet<string>>(() => new Set());
  const months = data.months ?? [];
  const flat = React.useMemo(
    () => flattenBreakdown(data.rows ?? [], collapsed),
    [data.rows, collapsed],
  );

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /* 200 con rango sin datos → empty honesto, no una tabla con solo el header. */
  if (flat.length === 0) {
    return (
      <QavanteCard variant="bordered">
        <p className="py-6 text-center text-sm text-neutral-mid">
          No hay resultado operacional para este período. Prueba otro rango o vuelve cuando se
          sincronicen las fuentes.
        </p>
      </QavanteCard>
    );
  }

  return (
    <QavanteCard variant="bordered" className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border-strong">
              <th className="px-4 py-2 text-left" />
              {months.map((m) => (
                <th
                  key={m}
                  className="whitespace-nowrap px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-neutral-mid"
                >
                  {formatMonthColumn(m)}
                  {m === data.proforma_month && (
                    <span className="block text-[10px] font-normal normal-case text-neutral-mid/70">
                      (proforma)
                    </span>
                  )}
                </th>
              ))}
              <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {flat.map((f) => {
              const strong = f.row.kind === "section" || f.row.kind === "subtotal";
              return (
                <tr
                  key={f.id}
                  className={cn(
                    "border-b border-border/40 last:border-b-0",
                    strong ? "bg-surface-muted/50 font-semibold text-neutral-dark" : "text-neutral-dark",
                  )}
                >
                  <td className="py-1.5 pr-3" style={{ paddingLeft: 16 + f.depth * 18 }}>
                    <span className="inline-flex items-center gap-1.5">
                      {f.hasChildren ? (
                        <button
                          type="button"
                          onClick={() => toggle(f.id)}
                          aria-expanded={f.expanded}
                          aria-label={`${f.expanded ? "Contraer" : "Expandir"} ${f.row.label}`}
                          className="rounded text-neutral-mid hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                        >
                          <ChevronRight
                            className={cn("h-3.5 w-3.5 transition-transform", f.expanded && "rotate-90")}
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        <span className="inline-block w-3.5" aria-hidden="true" />
                      )}
                      <span className={cn(!strong && "text-neutral-mid")}>{f.row.label}</span>
                    </span>
                  </td>
                  {/* Iteramos sobre `months` (no `by_month`) para garantizar N
                      columnas alineadas aunque el backend mande una fila con
                      distinta cantidad de celdas. */}
                  {months.map((m, i) => (
                    <td
                      key={m}
                      className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums"
                    >
                      {fmtCell(f.row.by_month[i] ?? "0")}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-4 py-1.5 text-right font-medium tabular-nums">
                    {fmtCell(f.row.total)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </QavanteCard>
  );
}
