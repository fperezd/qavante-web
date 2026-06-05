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

/* Cobrar v2 (rediseño lente Xero). Mejoras vs. v1: jerarquía (lo VENCIDO —lo
   accionable— es el héroe, no el total); top deudores como cards "a quién
   cobrarle primero"; documentos vencidos que reflowean a cards en mobile (no
   scroll horizontal). Mantiene lo Xero-grade del v1: el aging bar segmentado.
   Reusa el data layer y helpers. Gated por `accountsReceivable`. Ruta /cobrar/v2. */

const AGING_COLOR: Record<string, string> = {
  current: "bg-success-500",
  d1_30: "bg-warning-700/40",
  d31_60: "bg-warning-700/70",
  d61_90: "bg-danger-500/70",
  d90_plus: "bg-danger-500",
};

export interface CobrarV2ViewProps {
  siiEnabled: boolean;
}

export function CobrarV2View({ siiEnabled }: CobrarV2ViewProps) {
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
          description="Cuando tengas documentos por cobrar pendientes, vas a verlos acá ordenados por prioridad: lo vencido primero."
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
  const overdue = parseAmount(data.overdue);
  const total = parseAmount(data.total);
  const pct = parseAmount(data.overdue_pct);

  return (
    <div className="space-y-4">
      {/* Héroe: lo VENCIDO (lo accionable), con total + % de contexto. */}
      <QavanteCard variant="bordered">
        <p className="text-xs uppercase tracking-wide text-neutral-mid">Por cobrar · vencido</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-danger-500">{formatClp(overdue)}</span>
          {pct > 0 && (
            <span className="text-sm font-semibold text-danger-500">
              {pct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}% del total
            </span>
          )}
        </p>
        <p className="mt-1 text-sm text-neutral-mid">de {formatClp(total)} por cobrar en total</p>

        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-neutral-light/40">
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

      {/* Top deudores como cards. */}
      {data.top_debtors.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">A quién cobrarle primero</span>}
        >
          <ul className="space-y-2">
            {data.top_debtors.map((d) => (
              <li
                key={d.rut}
                className="flex items-center justify-between gap-3 rounded-md border border-neutral-light/50 p-3"
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

      {/* Documentos vencidos — cards en mobile, tabla en ≥sm (no scroll horizontal). */}
      {data.overdue_documents.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Documentos vencidos</span>}
        >
          <ul className="space-y-2 sm:hidden">
            {data.overdue_documents.map((doc, i) => (
              <li key={i} className="rounded-md border border-neutral-light/50 p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-dark">{doc.client_name}</p>
                    <p className="text-xs text-neutral-mid">{doc.document}</p>
                  </div>
                  <QavanteBadge variant={doc.days_overdue > 60 ? "danger" : "warning"}>
                    {doc.days_overdue} días
                  </QavanteBadge>
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="text-xs text-neutral-mid">
                    vence {doc.due_date ? formatDate(new Date(doc.due_date)) : "—"}
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-dark">
                    {formatClp(parseAmount(doc.balance))}
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
            <table className="w-full text-sm">
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

function LoadingSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-32 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="h-40 animate-pulse rounded-md bg-neutral-light/30" />
    </div>
  );
}
