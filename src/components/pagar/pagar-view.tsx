"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteEmpty } from "@/components/qavante";
import { useAccountsPayable, type AccountsPayableResponse } from "@/lib/api/pagos";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { SyncPendingState, isSyncPending } from "@/components/treasury/sync-pending-state";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import { parseAmount, paymentCategoryLabel, criticalFirst } from "./pagos-format";

/* Pagar — cuentas por pagar (Sprint C4, Maestro §7.4): resumen (total + 7/14/30
   días), relación contra caja, y pagos/obligaciones (proveedores + IVA/PPM/
   Previred/sueldos/arriendos/deuda/leasing) ordenados por criticidad. Container.
   Contrato FE-first gated por `accountsPayable` (la page lo resuelve). */

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
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <p>
          {query.error instanceof ApiError
            ? apiErrorToUserMessage(query.error)
            : "No pudimos cargar las cuentas por pagar. Intenta nuevamente."}
        </p>
      </div>
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
  const items = criticalFirst(data.items);
  return (
    <div className="space-y-4">
      {/* Resumen. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label="Total por pagar" value={formatClp(parseAmount(data.total))} />
        <Metric label="Próx. 7 días" value={formatClp(parseAmount(data.due_7d))} accent />
        <Metric label="Próx. 14 días" value={formatClp(parseAmount(data.due_14d))} />
        <Metric label="Próx. 30 días" value={formatClp(parseAmount(data.due_30d))} />
      </div>

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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
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
                    <span className="block truncate">{it.label}</span>
                    <span className="text-xs text-neutral-mid">{it.source}</span>
                  </td>
                  <td className="py-2 pr-3 text-neutral-mid">
                    {paymentCategoryLabel(it.category)}
                  </td>
                  <td className="py-2 pr-3 text-neutral-mid">
                    {it.due_date ? formatDate(new Date(it.due_date)) : "—"}
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

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <QavanteCard variant="bordered">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={
          "mt-1 text-lg font-bold tabular-nums " +
          (accent ? "text-danger-500" : "text-neutral-dark")
        }
      >
        {value}
      </p>
    </QavanteCard>
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
