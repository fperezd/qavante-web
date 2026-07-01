"use client";

import * as React from "react";
import { ArrowRight, Receipt, Users } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatRut } from "@/lib/formatters/rut";
import { KpiCell, KpiStrip } from "@/components/proposals/shared/kpi-strip";
import { bheTotals, concentrationByEmisor, type BheItem } from "./bhe-v2-format";

/* Panel BHE v2 — propuesta UX (control de gestión) para /pagar/honorarios-recibidos.
 *
 * Saca la **retención acumulada** del pie de página a un KPI destacado (es plata
 * que debes enterar al SII en tu F29) con CTA directo al F29, más líquido pagado,
 * #boletas y concentración por profesional. FE-only sobre las boletas ya
 * descargadas; el acumulado multi-mes/año requiere backend. */

export function BheKpisPanel({ items, periodo }: { items: BheItem[]; periodo?: string }) {
  const t = React.useMemo(() => bheTotals(items), [items]);
  const conc = React.useMemo(() => concentrationByEmisor(items, 5), [items]);

  return (
    <div className="space-y-4">
      {/* KPIs compactos — la retención destacada */}
      <KpiStrip>
        <KpiCell
          label="Retención a pagar en tu F29"
          value={formatClp(t.retencion)}
          valueClassName="text-warning-700"
          sub={
            <a href="/pagar/impuestos/f29" className="inline-flex items-center gap-1 font-medium text-brand-primary hover:underline">
              Se paga en tu F29 <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </a>
          }
        />
        <KpiCell label="Líquido pagado" value={formatClp(t.liquido)} sub="A los profesionales" />
        <KpiCell
          label="Boletas"
          value={String(t.count)}
          sub={`Bruto ${formatClp(t.bruto)}${periodo ? ` · ${periodo}` : ""}`}
        />
      </KpiStrip>

      {/* Concentración por profesional */}
      {conc.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              <span className="font-medium">A qué profesionales pagas más</span>
            </div>
          }
        >
          <ul className="space-y-2.5">
            {conc.map((c) => (
              <li key={c.rut} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-neutral-dark">{c.name}</span>
                    <span className="ml-1 text-xs text-neutral-mid">{formatRut(c.rut)}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-neutral-dark">
                    {formatClp(c.liquido)}
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
        </QavanteCard>
      )}

      <p className="flex items-center gap-1.5 text-xs text-neutral-mid">
        <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
        La retención del 13,75% (2026) la retienes tú y la enteras al SII en el F29 del período.{" "}
        <QavanteBadge variant="warning">Recordatorio tributario</QavanteBadge>
      </p>
    </div>
  );
}
