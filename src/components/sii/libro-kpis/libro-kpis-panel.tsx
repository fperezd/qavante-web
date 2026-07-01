"use client";

import * as React from "react";
import { Download, Users } from "lucide-react";
import { QavanteButton, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import {
  computeLibroKpis,
  concentrationByCounterparty,
  docsToCsv,
  type LibroDoc,
} from "./libro-kpis-format";

/* Panel de KPIs del Libro (Ventas/Compras) — propuesta UX (control de gestión).
 *
 * Se monta ARRIBA de la tabla del Libro (RcvListView). Saca el número de oro del
 * footer al hero: en ventas el neto y el débito; en compras el IVA crédito (insumo
 * del F29). Suma concentración por contraparte, neteo de notas de crédito y export
 * a CSV. Todo FE-only sobre los documentos ya descargados. */

export interface LibroKpisPanelProps {
  docs: LibroDoc[];
  kind: "ventas" | "compras";
  /** Período en curso, para nombrar el CSV (ej. "2026-06"). */
  periodo?: string;
}

export function LibroKpisPanel({ docs, kind, periodo }: LibroKpisPanelProps) {
  const kpis = React.useMemo(() => computeLibroKpis(docs), [docs]);
  const conc = React.useMemo(() => concentrationByCounterparty(docs, 5), [docs]);
  const partyLabel = kind === "ventas" ? "Cliente" : "Proveedor";
  const netoLabel = kind === "ventas" ? "Ventas netas" : "Compras netas";
  const ivaLabel = kind === "ventas" ? "IVA débito" : "IVA crédito";

  function exportCsv() {
    const csv = docsToCsv(docs);
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
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={netoLabel} value={formatClp(kpis.netTotal)} strong />
        <Kpi label={ivaLabel} value={formatClp(kpis.iva)} accent />
        <Kpi label="Documentos" value={String(kpis.docCount)} sub={kind === "ventas" ? "emitidos" : "recibidos"} />
        <Kpi
          label="Notas de crédito"
          value={kpis.ncCount > 0 ? `−${formatClp(kpis.ncTotal)}` : "—"}
          sub={kpis.ncCount > 0 ? `${kpis.ncCount} NC descontadas` : "Sin NC"}
        />
      </div>

      {/* Neteo explícito */}
      {kpis.ncCount > 0 && (
        <QavanteCard variant="bordered">
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-neutral-mid">{kind === "ventas" ? "Ventas brutas" : "Compras brutas"}</dt>
              <dd className="tabular-nums font-medium text-neutral-dark">{formatClp(kpis.grossTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-mid">(−) Notas de crédito</dt>
              <dd className="tabular-nums font-medium text-danger-500">{formatClp(kpis.ncTotal)}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-mid">= Neto</dt>
              <dd className="tabular-nums font-semibold text-neutral-dark">{formatClp(kpis.netTotal)}</dd>
            </div>
          </dl>
        </QavanteCard>
      )}

      {/* Concentración por contraparte + export */}
      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              Concentración por {partyLabel.toLowerCase()}
            </span>
            <QavanteButton size="sm" variant="ghost" onClick={exportCsv}>
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
                  <div className="h-full rounded-full bg-brand-primary/70" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </QavanteCard>
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  strong,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
  accent?: boolean;
}) {
  return (
    <QavanteCard variant="bordered">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={
          "mt-1 tabular-nums font-bold " +
          (strong ? "text-xl text-neutral-dark" : accent ? "text-xl text-brand-primary" : "text-lg text-neutral-dark")
        }
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-mid">{sub}</p>}
    </QavanteCard>
  );
}
