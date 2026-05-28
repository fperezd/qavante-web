"use client";

import * as React from "react";
import { QavanteCard, QavanteBadge } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import type { CashFlowBucket, CashFlowReportResponse } from "@/lib/api/treasury-reports";

/* Vista tabular del cash flow report. Presentacional puro: recibe la data
   ya resuelta y la renderiza. Filas = buckets temporales (months / weeks /
   days según granularity). Columnas = Período, Entrada, Salida, Neto, Mov.
   Footer = grand_total.

   MVP: no expande groups (canonical_category / management_account). Cuando
   se agregue `group_by != none`, los groups irán como sub-rows expandibles
   o como columnas adicionales — wave 2. */

export interface CashFlowTableProps {
  data: CashFlowReportResponse;
}

/* Parsea el formato string decimal del backend (pattern
   "^(?!^[-+.]*$)[+-]?0*\d*\.?\d*$") a number. Devuelve 0 para vacíos o
   inválidos — el backend ya garantiza el shape, esta defensa es solo
   contra missing/null. */
function parseDecimal(raw: string | null | undefined): number {
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function formatPeriodLabel(period: string): string {
  // YYYY-MM (month/week — week también viene como YYYY-MM-DD del lunes)
  // YYYY-MM-DD (day)
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [y, m] = period.split("-");
    const months = [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sep",
      "oct",
      "nov",
      "dic",
    ];
    const i = Number(m) - 1;
    return `${months[i] ?? m} ${y}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
    return period; // ya legible; YYYY-MM-DD
  }
  return period;
}

export function CashFlowTable({ data }: CashFlowTableProps) {
  const buckets: CashFlowBucket[] = data.buckets ?? [];
  const grand = data.grand_total;
  const warnings = data.warnings ?? [];

  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">
            {formatPeriodLabel(data.period_from)} → {formatPeriodLabel(data.period_to)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <QavanteBadge variant="info">
              {buckets.length} {buckets.length === 1 ? "bucket" : "buckets"}
            </QavanteBadge>
            <QavanteBadge variant="success">{data.granularity}</QavanteBadge>
            <QavanteBadge variant="warning">{data.financial_layer}</QavanteBadge>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-neutral-light text-left text-xs uppercase tracking-wide text-neutral-mid">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Período
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Entrada
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Salida
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Neto
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Movimientos
                </th>
              </tr>
            </thead>
            <tbody>
              {buckets.map((b) => {
                const inflow = parseDecimal(b.total_inflow);
                const outflow = parseDecimal(b.total_outflow);
                const net = parseDecimal(b.net);
                return (
                  <tr key={b.period} className="border-b border-neutral-light/40 last:border-b-0">
                    <td className="py-2 pr-3 text-neutral-dark">{formatPeriodLabel(b.period)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                      {formatClp(inflow)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                      {formatClp(outflow)}
                    </td>
                    <td
                      className={
                        "py-2 pr-3 text-right tabular-nums font-medium " +
                        (net < 0 ? "text-danger-500" : "text-neutral-dark")
                      }
                    >
                      {formatClp(net)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-neutral-mid">
                      {b.row_count ?? 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {grand && (
              <tfoot>
                <tr className="border-t-2 border-neutral-light/60 font-medium">
                  <td className="py-2 pr-3 text-xs uppercase tracking-wide text-neutral-mid">
                    Total del rango
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                    {formatClp(parseDecimal(grand.inflow))}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-mid">
                    {formatClp(parseDecimal(grand.outflow))}
                  </td>
                  <td
                    className={
                      "py-2 pr-3 text-right tabular-nums " +
                      (parseDecimal(grand.net) < 0 ? "text-danger-500" : "text-neutral-dark")
                    }
                  >
                    {formatClp(parseDecimal(grand.net))}
                  </td>
                  <td className="py-2 text-right tabular-nums text-neutral-mid">
                    {grand.row_count ?? 0}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {warnings.length > 0 && (
          <ul
            role="alert"
            className="space-y-1 rounded-md border border-warning-700/30 bg-warning-700/5 p-3 text-xs text-warning-700"
          >
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}

        {data.excluded_attention > 0 && (
          <p className="text-xs text-neutral-mid">
            Se omitieron {data.excluded_attention}{" "}
            {data.excluded_attention === 1 ? "fila" : "filas"} marcadas como
            <code className="mx-1">requires_attention</code>. Activa &laquo;Incluir con atención
            requerida&raquo; en filtros si quieres verlas.
          </p>
        )}

        <p className="text-xs text-neutral-mid">
          Reporte agregado del backend sobre los financial impacts ya clasificados. Caja mínima,
          alertas de brecha y acciones recomendadas vienen en Fase 2.
        </p>
      </div>
    </QavanteCard>
  );
}
