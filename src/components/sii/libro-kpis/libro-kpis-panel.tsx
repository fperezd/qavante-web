"use client";

import * as React from "react";
import { Download, Users } from "lucide-react";
import { QavanteButton, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { KpiCell } from "@/components/ui/kpi-strip";
import { computeRcvTotals } from "../rcv-totals";
import type { RcvDoc } from "../rcv-grouped-item";
import type { RcvKind } from "../rcv-list-view";
import { concentrationByCounterparty, docsToCsv } from "./libro-kpis-format";

/* Panel de KPIs del Libro (Ventas/Compras) — control de gestión.
 *
 * Se monta ARRIBA de la tabla del Libro (RcvListView). Saca el número de oro al
 * hero: en ventas el neto y el IVA débito; en compras el IVA crédito (insumo del
 * F29). Suma concentración por contraparte y export a CSV. Todo FE-only sobre los
 * documentos ya descargados; los totales usan `computeRcvTotals` —el mismo helper
 * del footer— así el hero y la tabla muestran exactamente los mismos números. */

export interface LibroKpisPanelProps {
  docs: RcvDoc[];
  kind: RcvKind;
  /** Período/rango en curso, para nombrar el CSV (ej. "2026-06" o "2026-02_2026-07"). */
  periodo?: string;
}

export function LibroKpisPanel({ docs, kind, periodo }: LibroKpisPanelProps) {
  const totals = React.useMemo(() => computeRcvTotals(docs), [docs]);
  const conc = React.useMemo(() => concentrationByCounterparty(docs, 5), [docs]);
  const docCount = docs.length - totals.ncCount;
  const partyLabel = kind === "ventas" ? "cliente" : "proveedor";
  const netoLabel = kind === "ventas" ? "Ventas netas" : "Compras netas";
  const ivaLabel = kind === "ventas" ? "IVA débito" : "IVA crédito";

  function exportCsv() {
    const csv = docsToCsv(docs);
    // BOM para que Excel es-CL respete UTF-8 (tildes/ñ).
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `libro-${kind}${periodo ? `-${periodo}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <QavanteCard variant="bordered" className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-border">
          <KpiCell label={netoLabel} value={formatClp(totals.neto)} />
          <KpiCell
            label={ivaLabel}
            value={formatClp(totals.iva)}
            valueClassName="text-brand-primary"
          />
          <KpiCell
            label="Documentos"
            value={String(docCount)}
            sub={kind === "ventas" ? "emitidos" : "recibidos"}
          />
          <KpiCell
            label="Notas de crédito"
            value={totals.ncCount > 0 ? `−${formatClp(totals.ncTotal)}` : "—"}
            sub={totals.ncCount > 0 ? `${totals.ncCount} NC` : "Sin NC"}
          />
        </div>
      </QavanteCard>

      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              Concentración por {partyLabel}
            </span>
            <QavanteButton
              size="sm"
              variant="ghost"
              onClick={exportCsv}
              disabled={docs.length === 0}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Exportar CSV
            </QavanteButton>
          </div>
        }
      >
        {conc.length === 0 ? (
          <p className="text-sm text-neutral-mid">Sin documentos en el período.</p>
        ) : (
          <ul className="space-y-2.5">
            {conc.map((c) => (
              <li key={c.rut} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-neutral-dark">{c.name}</span>
                    <span className="ml-1 text-xs text-neutral-mid">{formatRut(c.rut)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-dark">
                    {formatClp(c.total)}
                    <span className="ml-1 text-xs text-neutral-mid">
                      ({c.pct.toLocaleString("es-CL", { maximumFractionDigits: 0 })}%)
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-light/40">
                  <div
                    className="h-full rounded-full bg-brand-primary/70"
                    style={{ width: `${Math.min(c.pct, 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </QavanteCard>
    </div>
  );
}
