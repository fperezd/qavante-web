"use client";

import * as React from "react";
import Link from "next/link";
import { FileOutput } from "lucide-react";
import {
  QavanteCard,
  QavanteBadge,
  QavanteEmpty,
  QavanteInlineError,
  QavanteStatTile,
} from "@/components/qavante";
import { stickyScroll, stickyHead } from "@/components/table/sticky-table";
import { useAccountsReceivable, type AccountsReceivableResponse } from "@/lib/api/cobranza";
import {
  PartialDataBanner,
  SyncPendingState,
  isPartial,
  isSyncPending,
} from "@/components/treasury/sync-pending-state";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { parseAmount, agingBars } from "./cobranza-format";

/* Cobrar — cuentas por cobrar (Sprint C4, Maestro §7.3): resumen, antigüedad de
   saldos (aging), top deudores y documentos vencidos. Container: resuelve el
   snapshot + monta la vista. Estados canónicos. Refresh v1.3 (labels uppercase,
   tabular-nums, hover en filas, bordes/contraste). Contrato FE-first gated por
   `accountsReceivable` (la page lo resuelve). */

export interface CobrarViewProps {
  /** Si el flag `siiQueries` está ON, muestra el acceso al Libro de Ventas SII. */
  siiEnabled: boolean;
}

/* Severidad creciente del aging: vigente (ok) → 90+ (crítico). */
const AGING_COLOR: Record<string, string> = {
  current: "bg-success-500",
  d1_30: "bg-warning-700/40",
  d31_60: "bg-warning-700/70",
  d61_90: "bg-danger-500/70",
  d90_plus: "bg-danger-500",
};

export function CobrarView({ siiEnabled }: CobrarViewProps) {
  const query = useAccountsReceivable();

  return (
    <div className="space-y-4">
      {query.isLoading ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <QavanteInlineError
          error={query.error}
          what="las cuentas por cobrar"
          onRetry={() => query.refetch()}
        />
      ) : query.data && parseAmount(query.data.total) === 0 ? (
        isSyncPending(query.data) ? (
          <SyncPendingState
            missingSources={query.data.missing_sources}
            what="tus cuentas por cobrar"
          />
        ) : (
          <QavanteEmpty
            title="No tienes cuentas por cobrar"
            description="Cuando tengas documentos por cobrar pendientes, vas a verlos acá ordenados por prioridad."
          />
        )
      ) : query.data ? (
        <Receivable data={query.data} />
      ) : null}

      {siiEnabled && (
        <Link
          href="/cobrar/facturas-emitidas"
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <QavanteCard
            variant="bordered"
            className="transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-brand-primary/50 group-hover:shadow-lg"
            header={
              <div className="flex items-center gap-2">
                <FileOutput className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                <span className="font-medium">Libro de Ventas (SII)</span>
              </div>
            }
          >
            <p className="text-sm text-neutral-mid">
              Documentos de venta del SII por período: facturas, notas y boletas emitidas.
            </p>
          </QavanteCard>
        </Link>
      )}
    </div>
  );
}

function Receivable({ data }: { data: AccountsReceivableResponse }) {
  const bars = agingBars(data.aging);
  return (
    <div className="space-y-4">
      {isPartial(data) && <PartialDataBanner missingSources={data.missing_sources} />}

      {/* Resumen. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile label="Total por cobrar" value={formatClp(parseAmount(data.total))} />
        <QavanteStatTile
          label="Vencido"
          value={formatClp(parseAmount(data.overdue))}
          tone="danger"
        />
        <QavanteStatTile
          label="% vencido"
          value={`${parseAmount(data.overdue_pct).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`}
          tone="danger"
        />
      </div>

      {/* Antigüedad de saldos (aging). */}
      <QavanteCard
        variant="bordered"
        header={<span className="font-medium">Antigüedad de saldos</span>}
      >
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-light/40">
          {bars.map((b) => (
            <div
              key={b.key}
              className={AGING_COLOR[b.key]}
              style={{ width: `${b.pct}%` }}
              title={`${b.label}: ${formatClp(b.amount)}`}
            />
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-5">
          {bars.map((b) => (
            <div key={b.key} className="flex flex-col">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                {b.label}
              </dt>
              <dd className="font-semibold tabular-nums text-neutral-dark">
                {formatClp(b.amount)}
              </dd>
            </div>
          ))}
        </dl>
      </QavanteCard>

      {/* Top deudores. */}
      {data.top_debtors.length > 0 && (
        <QavanteCard variant="bordered" header={<span className="font-medium">Top deudores</span>}>
          <ul className="divide-y divide-border">
            {data.top_debtors.map((d) => (
              <li
                key={d.rut}
                className="-mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-dark">{d.name}</p>
                  <p className="text-xs text-neutral-mid">{formatRut(d.rut)}</p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="font-semibold text-neutral-dark">
                    {formatClp(parseAmount(d.total))}
                  </p>
                  {parseAmount(d.overdue) > 0 && (
                    <p className="text-xs font-medium text-danger-500">
                      {formatClp(parseAmount(d.overdue))} vencido
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </QavanteCard>
      )}

      {/* Documentos vencidos. */}
      {data.overdue_documents.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Documentos vencidos</span>}
        >
          <div className={stickyScroll}>
            <table className="w-full min-w-[560px] text-sm">
              <thead className={stickyHead}>
                <tr className="border-b border-border-strong text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Cliente
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Documento
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold">
                    Vence
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">
                    Saldo
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Días
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.overdue_documents.map((doc, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/60 transition-colors last:border-b-0 hover:bg-surface-muted"
                  >
                    <td className="py-2 pr-3 text-neutral-dark">
                      <span className="block truncate">{doc.client_name}</span>
                      <span className="text-xs text-neutral-mid">{formatRut(doc.client_rut)}</span>
                    </td>
                    <td className="py-2 pr-3 text-neutral-dark">{doc.document}</td>
                    <td className="py-2 pr-3 text-neutral-mid">{formatDateLike(doc.due_date)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums text-neutral-dark">
                      {formatClp(parseAmount(doc.balance))}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      <QavanteBadge variant={doc.days_overdue > 60 ? "danger" : "warning"}>
                        {doc.days_overdue}
                      </QavanteBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QavanteCard>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="h-48 animate-pulse rounded-xl bg-neutral-light/30" />
    </div>
  );
}
