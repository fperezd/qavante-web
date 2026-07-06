"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
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
import { parseAmount, payableItemLabel, paymentCategoryLabel } from "./pagos-format";
import {
  isOverdue,
  overdueTotal,
  subtotalsByCriticality,
  overdueThenCritical,
} from "./pagos-v2-format";

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
  const items = React.useMemo(() => overdueThenCritical(data.items, now), [data.items, now]);
  const overdue = React.useMemo(() => overdueTotal(data.items, now), [data.items, now]);
  const subtotals = React.useMemo(() => subtotalsByCriticality(data.items), [data.items]);
  return (
    <div className="space-y-4">
      {isPartial(data) && <PartialDataBanner missingSources={data.missing_sources} />}

      {/* Resumen. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QavanteStatTile
          label="Total por pagar"
          value={<AmountCountUp value={parseAmount(data.total)} />}
        />
        <QavanteStatTile
          label="Próx. 7 días"
          value={<AmountCountUp value={parseAmount(data.due_7d)} />}
          tone="danger"
        />
        <QavanteStatTile
          label="Próx. 14 días"
          value={<AmountCountUp value={parseAmount(data.due_14d)} />}
        />
        <QavanteStatTile
          label="Próx. 30 días"
          value={<AmountCountUp value={parseAmount(data.due_30d)} />}
        />
      </div>

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

      {/* Pagos y obligaciones. */}
      <QavanteCard
        variant="bordered"
        header={<span className="font-medium">Pagos y obligaciones</span>}
      >
        <div className={stickyScroll}>
          <table className="w-full min-w-[600px] text-sm">
            <thead className={stickyHead}>
              <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Pago / obligación
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Tipo
                </th>
                <th scope="col" className="py-2 pr-3 font-medium">
                  Vence
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Monto
                </th>
                <th scope="col" className="py-2 font-medium">
                  Criticidad
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr
                  key={i}
                  className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted"
                >
                  <td className="py-2 pr-3 text-neutral-dark">
                    <span className="block truncate" title={payableItemLabel(it)}>
                      {payableItemLabel(it)}
                    </span>
                    <span className="text-xs text-neutral-mid">{it.source}</span>
                  </td>
                  <td className="py-2 pr-3 text-neutral-mid">
                    {paymentCategoryLabel(it.category)}
                  </td>
                  <td className="py-2 pr-3 text-neutral-mid">
                    <span className="inline-flex items-center gap-1.5">
                      {formatDateLike(it.due_date)}
                      {isOverdue(it, now) && <QavanteBadge variant="danger">Vencido</QavanteBadge>}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                    {formatClp(parseAmount(it.amount))}
                  </td>
                  <td className="py-2">
                    <QavanteBadge variant={CRIT_VARIANT[it.criticality]}>
                      {CRIT_LABEL[it.criticality]}
                    </QavanteBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QavanteCard>
    </div>
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
