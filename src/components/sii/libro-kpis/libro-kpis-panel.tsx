"use client";

import * as React from "react";
import { downloadXlsx } from "@/lib/export/xlsx";
import { Download, Users } from "lucide-react";
import { QavanteButton, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { KpiCell } from "@/components/ui/kpi-strip";
import { computeRcvTotals } from "../rcv-totals";
import type { RcvDoc } from "../rcv-grouped-item";
import type { RcvKind } from "../rcv-list-view";
import { concentrationByCounterparty, docsToCsvTable } from "./libro-kpis-format";
import { formatPct } from "@/lib/formatters/pct";

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
  const netoLabel = kind === "ventas" ? "Neto sin IVA" : "Neto sin IVA";
  const ivaLabel = kind === "ventas" ? "IVA débito" : "IVA crédito";

  function exportCsv() {
    downloadXlsx(`libro-${kind}${periodo ? `-${periodo}` : ""}.xlsx`, docsToCsvTable(docs));
  }

  return (
    <div className="space-y-4">
      <QavanteCard variant="bordered" className="p-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 sm:divide-x sm:divide-border">
          <KpiCell
            label={netoLabel}
            value={
              totals.breakdown ? formatClp(totals.breakdown.netoSinIva) : "Cobertura incompleta"
            }
          />
          <KpiCell
            label={ivaLabel}
            value={totals.breakdown ? formatClp(totals.breakdown.iva) : "Sin información"}
            valueClassName="text-brand-primary"
          />
          <KpiCell
            label="Documentos"
            value={String(docCount)}
            sub={kind === "ventas" ? "emitidos" : "recibidos"}
          />
          <KpiCell
            label="Notas de crédito"
            value={
              totals.breakdown && totals.ncTotal !== null && totals.ncCount > 0
                ? `−${formatClp(totals.ncTotal)}`
                : "Sin información"
            }
            sub={
              totals.breakdown && totals.ncTotal !== null && totals.ncCount > 0
                ? `${totals.ncCount} NC`
                : "Sin NC"
            }
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
              Exportar Excel
            </QavanteButton>
          </div>
        }
      >
        {totals.breakdown === null ? (
          <p className="text-sm text-neutral-mid">
            Cobertura incompleta: no se publica concentración hasta contar con el desglose canónico
            completo.
          </p>
        ) : conc.length === 0 ? (
          <p className="text-sm text-neutral-mid">Sin documentos en el período.</p>
        ) : (
          <ul className="space-y-2.5">
            {conc.map((c, i) => (
              /* key: el RUT si viene; con identidad débil (centinela de extranjero, SIN-RUT,
                 S/D) `rut` es null y TODAS esas filas compartían la misma clave, así que va
                 el nombre, que es lo que de verdad las separa. */
              <li key={c.rut ?? `sin-rut:${c.name}-${i}`} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-neutral-dark">{c.name}</span>
                    <span className="ml-1 text-xs text-neutral-mid">
                      {c.rut ? formatRut(c.rut) : "contraparte extranjera o sin RUT"}
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-dark">
                    {formatClp(c.total)}
                    <span className="ml-1 text-xs text-neutral-mid">
                      ({formatPct(Math.max(0, Math.min(100, c.pct)))})
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-neutral-light/40">
                  <div
                    className="h-full rounded-full bg-brand-primary/70"
                    style={{ width: `${Math.max(0, Math.min(100, c.pct))}%` }}
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
