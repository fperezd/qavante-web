"use client";

import * as React from "react";
import { TrendingDown, TrendingUp, Users } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import type { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { KpiCell, KpiStrip } from "@/components/proposals/shared/kpi-strip";
import { DynamicTable } from "@/components/proposals/dynamic-table/dynamic-table";
import {
  concentrationPct,
  dsoTrend,
  parseAmount,
  priorityTone,
  urgencyScore,
  type Tone,
} from "./cobranza-v2-format";
import type { CobranzaV2Data, CollectionItem } from "./types";

/* Cobrar v2 — propuesta UX (control de gestión) para `/cobrar`.
 *
 * Suma a lo que ya existe (aging, top deudores, vencidos): **DSO con tendencia**
 * (¿cobro más rápido o lento?), **proyección de cobranza semanal** (¿cuánto
 * entra a caja?), **priorización de gestión** (saldo × días de mora → a quién
 * llamo primero) y **concentración de cartera** (riesgo por cliente).
 *
 * Presentacional (props + Storybook). DSO y proyección requieren ampliar el
 * contrato del backend; priorización y concentración son FE-only. */

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

export function CobrarV2View({ data }: { data: CobranzaV2Data }) {
  const conc = concentrationPct(data.top_debtors.map((d) => d.total), data.total, 3);
  const trend = dsoTrend(data.dso, data.dso_prev);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-dark">Cobrar</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Quién me debe y qué debo cobrar primero?</p>
      </div>

      {/* KPIs */}
      <KpiStrip>
        <KpiCell label="Total por cobrar" value={formatClp(parseAmount(data.total))} />
        <KpiCell
          label="Vencido"
          value={formatClp(parseAmount(data.overdue))}
          valueClassName={COLOR.danger}
          sub={`${parseAmount(data.overdue_pct).toLocaleString("es-CL", { maximumFractionDigits: 1 })}% del total`}
        />
        <KpiCell
          label="DSO (días de cobro)"
          value={data.dso != null ? `${data.dso} días` : "—"}
          valueClassName={COLOR[trend.tone]}
          sub={
            trend.deltaDays != null ? (
              <span className={cn("inline-flex items-center gap-1 font-medium", COLOR[trend.tone])}>
                {trend.deltaDays > 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                {trend.deltaDays > 0 ? "+" : ""}
                {trend.deltaDays} vs mes ant.
                {data.dso_target != null && <> · meta {data.dso_target}d</>}
              </span>
            ) : (
              "Sin comparativo"
            )
          }
        />
        <KpiCell
          label="Concentración top 3"
          value={`${conc.toLocaleString("es-CL", { maximumFractionDigits: 0 })}%`}
          valueClassName={conc > 60 ? COLOR.warning : undefined}
          sub={conc > 60 ? "Riesgo de dependencia" : "de la cartera"}
        />
      </KpiStrip>

      {/* Proyección de cobranza semanal */}
      {data.weekly_collection.length > 0 && <WeeklyCollection weeks={data.weekly_collection} />}

      {/* Priorización de gestión */}
      <PriorityList items={data.items} />

      {/* Concentración por deudor */}
      {data.top_debtors.length > 0 && <TopDebtors debtors={data.top_debtors} total={data.total} />}
    </div>
  );
}

/* ── Proyección de cobranza (cash-in por semana) ──────────────────────── */

function WeeklyCollection({ weeks }: { weeks: { label: string; expected: string }[] }) {
  const max = Math.max(1, ...weeks.map((w) => parseAmount(w.expected)));
  const total = weeks.reduce((a, w) => a + parseAmount(w.expected), 0);
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">Cobranza esperada (próximas semanas)</span>
          <span className="text-sm tabular-nums text-neutral-mid">
            Total: <span className="font-semibold text-neutral-dark">{formatClp(total)}</span>
          </span>
        </div>
      }
    >
      <div className="space-y-2">
        {weeks.map((w, i) => {
          const amt = parseAmount(w.expected);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-neutral-mid">{w.label}</span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-neutral-light/30">
                <div
                  className="h-full rounded bg-success-500/70"
                  style={{ width: `${(amt / max) * 100}%` }}
                />
              </div>
              <span className="w-28 shrink-0 text-right text-sm tabular-nums font-medium text-neutral-dark">
                {formatClp(amt)}
              </span>
            </div>
          );
        })}
      </div>
    </QavanteCard>
  );
}

/* ── Lista priorizada de gestión ──────────────────────────────────────── */

const PRIORITY_COLUMNS: ColumnDef<CollectionItem>[] = [
  {
    id: "cliente",
    accessorKey: "client_name",
    header: "Cliente",
    cell: ({ row }) => (
      <span className="block">
        <span className="block truncate font-medium text-neutral-dark">{row.original.client_name}</span>
        <span className="text-xs text-neutral-mid">{formatRut(row.original.client_rut)}</span>
      </span>
    ),
  },
  { id: "documento", accessorKey: "document", header: "Documento" },
  {
    id: "vence",
    accessorKey: "due_date",
    header: "Vence",
    enableColumnFilter: false,
    cell: ({ row }) => (
      <span className="whitespace-nowrap text-neutral-mid">
        {formatDateLike(row.original.due_date)}
        {row.original.days_overdue > 0 && (
          <span className="ml-1 text-xs text-danger-500">({row.original.days_overdue}d)</span>
        )}
      </span>
    ),
  },
  {
    id: "saldo",
    accessorFn: (r) => parseAmount(r.balance),
    header: "Saldo",
    enableColumnFilter: false,
    meta: { align: "right" },
    cell: ({ getValue }) => <span className="font-medium">{formatClp(getValue() as number)}</span>,
  },
  {
    id: "prioridad",
    accessorFn: (r) => r.days_overdue,
    header: "Prioridad",
    enableColumnFilter: false,
    meta: { align: "right" },
    cell: ({ row }) => {
      const prio = priorityTone(row.original.days_overdue);
      return <QavanteBadge variant={BADGE[prio.tone]}>{prio.label}</QavanteBadge>;
    },
  },
];

function PriorityList({ items }: { items: CobranzaV2Data["items"] }) {
  const ranked = React.useMemo(
    () =>
      [...items].sort((a, b) => urgencyScore(b.balance, b.days_overdue) - urgencyScore(a.balance, a.days_overdue)),
    [items],
  );

  return (
    <div className="space-y-2">
      <div>
        <span className="font-medium text-neutral-dark">A quién cobrar primero</span>
        <p className="text-xs text-neutral-mid">
          Por defecto, por urgencia (saldo × días de mora). Ordená, filtrá o mové columnas a gusto.
        </p>
      </div>
      <DynamicTable columns={PRIORITY_COLUMNS as ColumnDef<CollectionItem, unknown>[]} data={ranked} minWidth={640} />
    </div>
  );
}

/* ── Concentración por deudor ─────────────────────────────────────────── */

function TopDebtors({ debtors, total }: { debtors: CobranzaV2Data["top_debtors"]; total: string }) {
  const t = parseAmount(total) || 1;
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          <span className="font-medium">Concentración por cliente</span>
        </div>
      }
    >
      <ul className="space-y-2.5">
        {debtors.map((d, i) => {
          const pct = (parseAmount(d.total) / t) * 100;
          return (
            <li key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-neutral-dark">{d.name}</span>
                <span className="shrink-0 tabular-nums text-neutral-dark">
                  {formatClp(parseAmount(d.total))}
                  <span className="ml-1 text-xs text-neutral-mid">
                    ({pct.toLocaleString("es-CL", { maximumFractionDigits: 0 })}%)
                  </span>
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
