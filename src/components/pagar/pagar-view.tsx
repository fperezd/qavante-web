"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  QavanteCard,
  QavanteBadge,
  QavanteEmpty,
  QavanteInlineError,
  QavanteStatTile,
  AmountCountUp,
} from "@/components/qavante";
import { stickyScroll, stickyHead } from "@/components/table/sticky-table";
import { useAccountsPayable, type AccountsPayableResponse } from "@/lib/api/pagos";
import {
  PartialDataBanner,
  SyncPendingState,
  isPartial,
  isSyncPending,
} from "@/components/treasury/sync-pending-state";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import {
  multiCurrencyNote,
  parseAmount,
  payableItemLabel,
  paymentCategoryLabel,
} from "./pagos-format";
import {
  isOverdue,
  overdueTotal,
  subtotalsByCriticality,
  overdueThenCritical,
} from "./pagos-v2-format";
import {
  groupByCategory,
  categoryGroupLabel,
  shareOfTotal,
  payrollPeriodFromExternalId,
} from "./pagos-group";
import type { PayableItem } from "@/lib/api/pagos";

/* Pagar — cuentas por pagar (Sprint C4, Maestro §7.4): resumen (total + 7/14/30
   días), relación contra caja, y pagos/obligaciones (proveedores + IVA/PPM/
   Previred/sueldos/arriendos/deuda/leasing). Herramienta de decisión (control de
   gestión): bucket "Vencido" al frente, subtotales por criticidad, orden
   vencido→crítico. Container. Contrato FE-first gated por `accountsPayable`. */

const CRIT_VARIANT: Record<"high" | "medium" | "low", "danger" | "warning" | "default"> = {
  high: "danger",
  medium: "warning",
  low: "default",
};
const CRIT_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "Crítico",
  medium: "Medio",
  low: "Bajo",
};

export function PagarView() {
  const query = useAccountsPayable();

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <QavanteInlineError
        error={query.error}
        what="las cuentas por pagar"
        onRetry={() => query.refetch()}
      />
    );
  }
  if (query.data && parseAmount(query.data.total) === 0) {
    return isSyncPending(query.data) ? (
      <SyncPendingState missingSources={query.data.missing_sources} what="tus cuentas por pagar" />
    ) : (
      <QavanteEmpty
        title="No tienes pagos pendientes"
        description="Cuando tengas pagos u obligaciones por vencer, vas a verlos acá priorizados por criticidad."
      />
    );
  }
  if (!query.data) {
    return (
      <QavanteEmpty
        title="No tienes pagos pendientes"
        description="Cuando tengas pagos u obligaciones por vencer, vas a verlos acá priorizados por criticidad."
      />
    );
  }
  return <Payable data={query.data} />;
}

function Payable({ data }: { data: AccountsPayableResponse }) {
  // `now` estable por montaje (evita recomputar el bucketing en cada render).
  const now = React.useMemo(() => new Date(), []);
  // `items` es opcional en el contrato (backend lo omite en estado partial).
  const rawItems = React.useMemo(() => data.items ?? [], [data.items]);
  const overdue = React.useMemo(() => overdueTotal(rawItems, now), [rawItems, now]);
  const subtotals = React.useMemo(() => subtotalsByCriticality(rawItems), [rawItems]);
  // Agrupación por categoría (eje universal: "en qué se va la plata").
  const groups = React.useMemo(() => groupByCategory(rawItems), [rawItems]);
  const total = parseAmount(data.total);
  return (
    <div className="space-y-4">
      {isPartial(data) && <PartialDataBanner missingSources={data.missing_sources} />}

      {/* Resumen. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QavanteStatTile
          label="Total por pagar"
          value={<AmountCountUp value={parseAmount(data.total)} />}
          info="Todo lo que le debes a tus proveedores y aún no pagas, según las facturas que recibiste."
        />
        <QavanteStatTile
          label="Próx. 7 días"
          value={<AmountCountUp value={parseAmount(data.due_7d)} />}
          tone="danger"
          info="Lo que vence dentro de los próximos 7 días. Es tu compromiso de caja más inmediato."
        />
        <QavanteStatTile
          label="Próx. 14 días"
          value={<AmountCountUp value={parseAmount(data.due_14d)} />}
          info="Lo que vence dentro de los próximos 14 días. Incluye lo de los próximos 7."
        />
        <QavanteStatTile
          label="Próx. 30 días"
          value={<AmountCountUp value={parseAmount(data.due_30d)} />}
          info="Lo que vence dentro de los próximos 30 días. Incluye lo de los próximos 14."
        />
      </div>

      {/* Multimoneda (CC-API #560): el total va en CLP convertido; si hay USD u otra
          moneda, mostramos el desglose crudo para que el dueño lo entienda. */}
      {(() => {
        const note = multiCurrencyNote(data.total_by_currency);
        return note ? (
          <p className="-mt-1 text-xs text-neutral-mid">
            Total convertido a CLP · desglose: <span className="tabular-nums">{note}</span>
          </p>
        ) : null;
      })()}

      {/* Vencido: lo que ya pasó su fecha (lo más urgente) — destacado en rojo. */}
      {overdue > 0 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-2 font-medium text-neutral-dark">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger-500" aria-hidden="true" />
            Vencido — pagar cuanto antes
          </span>
          <span className="tabular-nums font-semibold text-danger-500">{formatClp(overdue)}</span>
        </div>
      )}

      {/* Subtotales por criticidad (control de gestión: dónde está la plata que
          más urge). Solo cuando hay más de un nivel con monto. */}
      {[subtotals.high, subtotals.medium, subtotals.low].filter((v) => v > 0).length > 1 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm">
          <CriticalitySubtotal label="Crítico" value={subtotals.high} tone="danger" />
          <CriticalitySubtotal label="Medio" value={subtotals.medium} tone="warning" />
          <CriticalitySubtotal label="Bajo" value={subtotals.low} tone="neutral" />
        </div>
      )}

      {/* Relación contra caja. */}
      {data.covers_critical === false && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-neutral-dark"
        >
          <AlertTriangle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500"
            aria-hidden="true"
          />
          <p>
            La caja proyectada
            {data.projected_cash_14d
              ? ` (${formatClp(parseAmount(data.projected_cash_14d))} a 14 días)`
              : ""}{" "}
            <span className="font-medium">no alcanza</span> para cubrir los pagos críticos próximos.
            Prioriza cobranza o renegocia plazos.
          </p>
        </div>
      )}
      {data.covers_critical === true && (
        <p className="flex items-center gap-1.5 text-sm text-success-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          La caja proyectada cubre los pagos críticos próximos.
        </p>
      )}

      {/* Pagos y obligaciones — agrupados por categoría (expandibles). */}
      <PagosPorCategoria groups={groups} total={total} now={now} />
    </div>
  );
}

/* Grupos de pago por categoría: cada uno muestra su subtotal + concentración
   (% del total) y se expande a sus ítems. Es el eje universal multi-tenant. */
function PagosPorCategoria({
  groups,
  total,
  now,
}: {
  groups: ReturnType<typeof groupByCategory>;
  total: number;
  now: Date;
}) {
  const [openCat, setOpenCat] = React.useState<string | null>(groups[0]?.category ?? null);
  return (
    <QavanteCard
      variant="bordered"
      header={<span className="font-medium">Pagos y obligaciones</span>}
    >
      <ul className="divide-y divide-border">
        {groups.map((g) => {
          const isOpen = openCat === g.category;
          const pct = shareOfTotal(g.subtotal, total);
          return (
            <li key={g.category}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenCat(isOpen ? null : g.category)}
                className="-mx-2 flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 shrink-0 text-neutral-mid transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden="true"
                  />
                  <span className="font-medium text-neutral-dark">
                    {categoryGroupLabel(g.category)}
                  </span>
                  <span className="text-xs text-neutral-mid">
                    {g.items.length} {g.items.length === 1 ? "ítem" : "ítems"}
                  </span>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <span className="font-semibold text-neutral-dark">{formatClp(g.subtotal)}</span>
                  {pct >= 0.5 && (
                    <span className="ml-2 text-xs text-neutral-mid">
                      {pct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}% del total
                    </span>
                  )}
                </div>
              </button>
              {isOpen && <CategoryItems items={g.items} now={now} />}
            </li>
          );
        })}
      </ul>
    </QavanteCard>
  );
}

/* Ítems de una categoría (ordenados vencido→crítico). */
function CategoryItems({ items, now }: { items: PayableItem[]; now: Date }) {
  const ordered = React.useMemo(() => overdueThenCritical(items, now), [items, now]);
  return (
    <div className={`mb-2 ml-6 ${stickyScroll}`}>
      <table className="w-full min-w-[520px] text-sm">
        <thead className={stickyHead}>
          <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Pago / obligación
            </th>
            <th scope="col" className="py-1.5 pr-3 font-medium">
              Vence
            </th>
            <th scope="col" className="py-1.5 pr-3 text-right font-medium">
              Monto
            </th>
            <th scope="col" className="py-1.5 font-medium">
              Criticidad
            </th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((it, i) => (
            <tr key={i} className="border-b border-border/50 last:border-b-0 hover:bg-surface-muted">
              <td className="py-1.5 pr-3 text-neutral-dark">
                <span className="block truncate" title={payableItemLabel(it)}>
                  {it.counterparty_name ?? payableItemLabel(it)}
                </span>
                <span className="text-xs text-neutral-mid">
                  {it.folio ? `${paymentCategoryLabel(it.category)} · folio ${it.folio}` : it.source}
                </span>
                {/* Drill-down de nómina → detalle por empleado de ese período. */}
                <PayrollDetailLink item={it} />
              </td>
              <td className="py-1.5 pr-3 text-neutral-mid">
                <span className="inline-flex items-center gap-1.5">
                  {formatDateLike(it.due_date)}
                  {isOverdue(it, now) && <QavanteBadge variant="danger">Vencido</QavanteBadge>}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-neutral-dark">
                {formatClp(parseAmount(it.amount))}
              </td>
              <td className="py-1.5">
                <QavanteBadge variant={CRIT_VARIANT[it.criticality]}>
                  {CRIT_LABEL[it.criticality]}
                </QavanteBadge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Ítem de nómina → link al detalle por empleado de ese período (Remuneraciones).
   El período se deriva del `source_external_id` ('payroll-YYYYMM'). */
function PayrollDetailLink({ item }: { item: PayableItem }) {
  if (item.category !== "payroll") return null;
  const period = payrollPeriodFromExternalId(item.source_external_id);
  if (!period) return null;
  return (
    <Link
      href={`/remuneraciones?period=${period}`}
      onClick={(e) => e.stopPropagation()}
      className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
    >
      <Users className="h-3 w-3" aria-hidden="true" />
      Ver detalle por empleado
    </Link>
  );
}

function CriticalitySubtotal({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "neutral";
}) {
  const dot =
    tone === "danger" ? "bg-danger-500" : tone === "warning" ? "bg-warning-500" : "bg-neutral-mid";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
      <span className="text-neutral-mid">{label}</span>
      <span className="tabular-nums font-medium text-neutral-dark">{formatClp(value)}</span>
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-neutral-light/30" />
    </div>
  );
}
