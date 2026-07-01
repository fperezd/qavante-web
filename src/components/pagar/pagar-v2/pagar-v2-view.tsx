"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Building2, CalendarClock } from "lucide-react";
import { QavanteBadge, QavanteButton, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import { KpiCell, KpiStrip } from "@/components/proposals/shared/kpi-strip";
import {
  cashDelta14d,
  criticalityTone,
  dueBucket,
  groupBySupplier,
  parseAmount,
  subtotalsByCriticality,
  type DueBucket,
  type Tone,
} from "./pagar-v2-format";
import type { PagarV2Data, PagoItem } from "./types";

/* Pagar v2 — propuesta UX (control de gestión) para `/pagar`.
 *
 * Convierte el listado plano en una herramienta de decisión de tesorería:
 * bucket de **Vencido** aparte, **subtotales por criticidad**, **delta de caja
 * explícito** (caja proyectada − pagos críticos, no un booleano) y **agrupación
 * por proveedor** (concentración). Responde "¿qué pago esta semana y me da la
 * caja?".
 *
 * Presentacional (props + Storybook). Casi todo FE-only sobre el contrato
 * accounts-payable; el delta usa CashGap. §17.4: solo presenta. */

const BADGE: Record<Tone, "success" | "warning" | "danger" | "default"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "default",
};
const COLOR: Record<Tone, string> = {
  success: "text-success-500",
  warning: "text-warning-500",
  danger: "text-danger-500",
  neutral: "text-neutral-dark",
};

const CATEGORY_LABEL: Record<string, string> = {
  proveedor: "Proveedor",
  impuestos: "Impuestos",
  sueldos: "Sueldos",
  arriendo: "Arriendo",
  deuda: "Deuda",
  leasing: "Leasing",
  otro: "Otro",
};

const BUCKET_META: { key: DueBucket; label: string; tone: Tone }[] = [
  { key: "vencido", label: "Vencido", tone: "danger" },
  { key: "d7", label: "Esta semana (≤7 días)", tone: "warning" },
  { key: "d14", label: "En 2 semanas (8–14 días)", tone: "neutral" },
  { key: "d30", label: "En el mes (15–30 días)", tone: "neutral" },
  { key: "mas", label: "Más adelante", tone: "neutral" },
];

export function PagarV2View({ data }: { data: PagarV2Data }) {
  const [mode, setMode] = React.useState<"vencimiento" | "proveedor">("vencimiento");
  const delta = cashDelta14d(data.projected_cash_14d, data.critical_obligations_14d);
  const subtotals = subtotalsByCriticality(data.items);
  const vencidoTotal = data.items
    .filter((i) => i.days_to_due < 0)
    .reduce((a, i) => a + parseAmount(i.amount), 0);
  const d7Total = data.items
    .filter((i) => i.days_to_due >= 0 && i.days_to_due <= 7)
    .reduce((a, i) => a + parseAmount(i.amount), 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-dark">Pagar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Qué pago primero y me da la caja?</p>
      </div>

      {/* Delta de caja explícito */}
      {delta < 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
          <p className="text-neutral-dark">
            Tu caja proyectada a 14 días <span className="font-semibold">NO cubre</span> tus pagos críticos:
            te faltan <span className="font-semibold text-danger-500">{formatClp(Math.abs(delta))}</span> (caja{" "}
            {formatClp(parseAmount(data.projected_cash_14d))} vs {formatClp(parseAmount(data.critical_obligations_14d))} en
            pagos críticos). Prioriza cobranzas o posterga lo no esencial.
          </p>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-success-500/30 bg-success-500/5 p-4 text-sm">
          <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success-500" aria-hidden="true" />
          <p className="text-neutral-dark">
            Tu caja proyectada a 14 días cubre tus pagos críticos con {formatClp(delta)} de holgura.
          </p>
        </div>
      )}

      {/* KPIs */}
      <KpiStrip>
        <KpiCell label="Total por pagar" value={formatClp(parseAmount(data.total))} />
        <KpiCell label="Vencido" value={formatClp(vencidoTotal)} valueClassName={vencidoTotal > 0 ? COLOR.danger : undefined} />
        <KpiCell label="Esta semana" value={formatClp(d7Total)} valueClassName={d7Total > 0 ? COLOR.warning : undefined} />
        <KpiCell label="Holgura de caja 14d" value={formatClp(delta)} valueClassName={delta < 0 ? COLOR.danger : COLOR.success} />
      </KpiStrip>

      {/* Subtotales por criticidad */}
      <KpiStrip>
        <KpiCell label="Crítico" value={formatClp(subtotals.critica)} valueClassName={COLOR.danger} />
        <KpiCell label="Medio" value={formatClp(subtotals.media)} valueClassName={COLOR.warning} />
        <KpiCell label="Bajo" value={formatClp(subtotals.baja)} />
      </KpiStrip>

      {/* Toggle vista */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-mid">Ver por:</span>
        <QavanteButton size="sm" variant={mode === "vencimiento" ? "secondary" : "ghost"} onClick={() => setMode("vencimiento")}>
          <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
          Vencimiento
        </QavanteButton>
        <QavanteButton size="sm" variant={mode === "proveedor" ? "secondary" : "ghost"} onClick={() => setMode("proveedor")}>
          <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
          Proveedor
        </QavanteButton>
      </div>

      {mode === "vencimiento" ? <ByDueDate items={data.items} /> : <BySupplier items={data.items} total={data.total} />}
    </div>
  );
}


/* ── Vista por vencimiento (con bucket Vencido aparte) ────────────────── */

function ByDueDate({ items }: { items: PagoItem[] }) {
  const byBucket = new Map<DueBucket, PagoItem[]>();
  for (const it of items) {
    const b = dueBucket(it.days_to_due);
    byBucket.set(b, [...(byBucket.get(b) ?? []), it]);
  }
  return (
    <div className="space-y-4">
      {BUCKET_META.map((meta) => {
        const list = (byBucket.get(meta.key) ?? []).sort((a, b) => a.days_to_due - b.days_to_due);
        if (list.length === 0) return null;
        const subtotal = list.reduce((a, i) => a + parseAmount(i.amount), 0);
        return (
          <QavanteCard
            key={meta.key}
            variant="bordered"
            className={cn("overflow-hidden p-0", meta.key === "vencido" && "border-danger-500/40")}
          >
            <div className={cn("flex items-center justify-between border-b px-4 py-2.5", meta.key === "vencido" ? "border-danger-500/30 bg-danger-500/5" : "border-border-strong")}>
              <span className={cn("flex items-center gap-2 font-medium", meta.key === "vencido" ? "text-danger-500" : "text-neutral-dark")}>
                {meta.key === "vencido" && <AlertTriangle className="h-4 w-4" aria-hidden="true" />}
                {meta.label}
              </span>
              <span className="text-sm tabular-nums font-semibold text-neutral-dark">{formatClp(subtotal)}</span>
            </div>
            <PagoTable items={list} />
          </QavanteCard>
        );
      })}
    </div>
  );
}

function PagoTable({ items }: { items: PagoItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-xs [&_td]:border-r [&_td]:border-border/30 [&_td:last-child]:border-r-0">
        <tbody>
          {items.map((it, i) => {
            const crit = criticalityTone(it.criticality);
            return (
              <tr key={i} className="border-b border-border/60 last:border-b-0 hover:bg-surface-muted">
                <td className="py-2 pl-4 pr-3">
                  <span className="block text-neutral-dark">{it.label}</span>
                  <span className="block text-neutral-dark">{CATEGORY_LABEL[it.category] ?? it.category}</span>
                </td>
                <td className="py-2 pr-3 text-neutral-dark">
                  {formatDateLike(it.due_date)}
                  {it.days_to_due < 0 && <span className="ml-1 text-danger-500">({Math.abs(it.days_to_due)}d)</span>}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                  {formatClp(parseAmount(it.amount))}
                </td>
                <td className="py-2 pr-4 text-right">
                  <QavanteBadge variant={BADGE[crit.tone]}>{crit.label}</QavanteBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Vista por proveedor (concentración) ──────────────────────────────── */

function BySupplier({ items, total }: { items: PagoItem[]; total: string }) {
  const groups = groupBySupplier(items);
  const t = parseAmount(total) || 1;
  return (
    <QavanteCard variant="bordered" header={<span className="font-medium">Deuda por proveedor</span>}>
      <ul className="space-y-2.5">
        {groups.map((g, i) => {
          const pct = (g.total / t) * 100;
          return (
            <li key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-neutral-dark">
                  {g.supplier}
                  <span className="ml-1 text-xs text-neutral-mid">
                    ({g.count} {g.count === 1 ? "pago" : "pagos"})
                  </span>
                </span>
                <span className="shrink-0 tabular-nums text-neutral-dark">
                  {formatClp(g.total)}
                  <span className="ml-1 text-xs text-neutral-mid">({pct.toLocaleString("es-CL", { maximumFractionDigits: 0 })}%)</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-light/40">
                <div className="h-full rounded-full bg-brand-primary/70" style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </QavanteCard>
  );
}
