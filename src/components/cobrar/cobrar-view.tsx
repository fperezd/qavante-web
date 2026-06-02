"use client";

import * as React from "react";
import Link from "next/link";
import { AlertCircle, FileOutput } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteEmpty } from "@/components/qavante";
import { useAccountsReceivable, type AccountsReceivableResponse } from "@/lib/api/cobranza";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { parseAmount, agingBars } from "./cobranza-format";

/* Cobrar — cuentas por cobrar (Sprint C4, Maestro §7.3): resumen, antigüedad de
   saldos (aging), top deudores y documentos vencidos. Container: resuelve el
   snapshot + monta la vista. Estados canónicos. Contrato FE-first gated por
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
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
        >
          <AlertCircle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500"
            aria-hidden="true"
          />
          <p>
            {query.error instanceof ApiError
              ? apiErrorToUserMessage(query.error)
              : "No pudimos cargar las cuentas por cobrar. Intenta nuevamente."}
          </p>
        </div>
      ) : query.data && parseAmount(query.data.total) === 0 ? (
        <QavanteEmpty
          title="No tienes cuentas por cobrar"
          description="Cuando tengas documentos por cobrar pendientes, vas a verlos acá ordenados por prioridad."
        />
      ) : query.data ? (
        <Receivable data={query.data} />
      ) : null}

      {siiEnabled && (
        <Link
          href="/cobrar/facturas-emitidas"
          className="block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <QavanteCard
            variant="bordered"
            className="transition-colors hover:border-brand-primary/40"
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
      {/* Resumen. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric label="Total por cobrar" value={formatClp(parseAmount(data.total))} />
        <Metric label="Vencido" value={formatClp(parseAmount(data.overdue))} danger />
        <Metric
          label="% vencido"
          value={`${parseAmount(data.overdue_pct).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`}
          danger
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
              <dt className="text-xs text-neutral-mid">{b.label}</dt>
              <dd className="font-medium tabular-nums text-neutral-dark">{formatClp(b.amount)}</dd>
            </div>
          ))}
        </dl>
      </QavanteCard>

      {/* Top deudores. */}
      {data.top_debtors.length > 0 && (
        <QavanteCard variant="bordered" header={<span className="font-medium">Top deudores</span>}>
          <ul className="divide-y divide-neutral-light/60">
            {data.top_debtors.map((d) => (
              <li key={d.rut} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-neutral-dark">{d.name}</p>
                  <p className="text-xs text-neutral-mid">{formatRut(d.rut)}</p>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="font-medium text-neutral-dark">{formatClp(parseAmount(d.total))}</p>
                  {parseAmount(d.overdue) > 0 && (
                    <p className="text-xs text-danger-500">
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-neutral-light text-left text-xs uppercase tracking-wide text-neutral-mid">
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Cliente
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Documento
                  </th>
                  <th scope="col" className="py-2 pr-3 font-medium">
                    Vence
                  </th>
                  <th scope="col" className="py-2 pr-3 text-right font-medium">
                    Saldo
                  </th>
                  <th scope="col" className="py-2 text-right font-medium">
                    Días
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.overdue_documents.map((doc, i) => (
                  <tr key={i} className="border-b border-neutral-light/40 last:border-b-0">
                    <td className="py-2 pr-3 text-neutral-dark">
                      <span className="block truncate">{doc.client_name}</span>
                      <span className="text-xs text-neutral-mid">{formatRut(doc.client_rut)}</span>
                    </td>
                    <td className="py-2 pr-3 text-neutral-dark">{doc.document}</td>
                    <td className="py-2 pr-3 text-neutral-mid">
                      {doc.due_date ? formatDate(new Date(doc.due_date)) : "—"}
                    </td>
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

function Metric({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <QavanteCard variant="bordered">
      <p className="text-xs text-neutral-mid">{label}</p>
      <p className={"mt-1 text-xl font-bold " + (danger ? "text-danger-500" : "text-neutral-dark")}>
        {value}
      </p>
    </QavanteCard>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-neutral-light/30" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="h-48 animate-pulse rounded-md bg-neutral-light/30" />
    </div>
  );
}
