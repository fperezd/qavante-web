"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, FileOutput } from "lucide-react";
import {
  QavanteCard,
  QavanteBadge,
  QavanteEmpty,
  QavanteInlineError,
  QavanteStatTile,
  AmountCountUp,
} from "@/components/qavante";
import { stickyScroll, stickyHead } from "@/components/table/sticky-table";
import {
  useAccountsReceivable,
  type AccountsReceivableResponse,
  type TopDebtor,
} from "@/lib/api/cobranza";
import {
  PartialDataBanner,
  SyncPendingState,
  isPartial,
  isSyncPending,
} from "@/components/treasury/sync-pending-state";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatRut } from "@/lib/formatters/rut";
import { normalizeRut } from "@/lib/validators/rut";
import { defaultRange } from "@/lib/period/period-range";
import { cn } from "@/lib/utils";
import type { RcvDoc } from "@/components/sii/rcv-grouped-item";
import { fechaSortKey } from "@/components/sii/rcv-sort";
import { useDebtorInvoices } from "./debtor-invoices";
import { parseAmount, agingBars, sortByUrgency, shareOfTotal } from "./cobranza-format";

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
        <Receivable data={query.data} siiEnabled={siiEnabled} />
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

function Receivable({
  data,
  siiEnabled,
}: {
  data: AccountsReceivableResponse;
  siiEnabled: boolean;
}) {
  const bars = agingBars(data.aging);
  return (
    <div className="space-y-4">
      {isPartial(data) && <PartialDataBanner missingSources={data.missing_sources} />}

      {/* Resumen. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile
          label="Total por cobrar"
          value={<AmountCountUp value={parseAmount(data.total)} />}
          info="Todo lo que tus clientes te deben y aún no pagan, según las facturas que emitiste."
        />
        <QavanteStatTile
          label="Vencido"
          value={<AmountCountUp value={parseAmount(data.overdue)} />}
          tone="danger"
          info="La parte de lo por cobrar cuyo plazo de pago ya pasó. Es la plata que deberías estar persiguiendo."
        />
        <QavanteStatTile
          label="% vencido"
          value={`${parseAmount(data.overdue_pct).toLocaleString("es-CL", { maximumFractionDigits: 1 })}%`}
          tone="danger"
          info="Qué parte del total por cobrar ya está vencida. Mientras más alto, más apretada tu cobranza."
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

      {/* Top deudores — cada deudor expande a sus facturas (Libro de Ventas). */}
      {(data.top_debtors ?? []).length > 0 && (
        <TopDebtors debtors={data.top_debtors ?? []} total={data.total} siiEnabled={siiEnabled} />
      )}

      {/* Documentos vencidos. */}
      {(data.overdue_documents ?? []).length > 0 && (
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
                {(data.overdue_documents ?? []).map((doc, i) => (
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

/* Top deudores con filas expandibles: al abrir un deudor, se muestran sus
   facturas del Libro de Ventas (SII). Fetch lazy del rango (6 meses) cacheado por
   mes; se dispara al abrir el primer deudor. La mora/saldo pendiente por factura
   NO está (gap del backend: vencimientos del SII) → se dice honestamente. */
function TopDebtors({
  debtors,
  total,
  siiEnabled,
}: {
  debtors: TopDebtor[];
  total: string;
  siiEnabled: boolean;
}) {
  const [openRut, setOpenRut] = React.useState<string | null>(null);
  const [everOpened, setEverOpened] = React.useState(false);
  const range = React.useMemo(() => defaultRange(), []);
  const invoices = useDebtorInvoices(range, siiEnabled && everOpened);
  // Orden por urgencia: primero el más vencido (a quién perseguir primero).
  const ordered = React.useMemo(() => sortByUrgency(debtors), [debtors]);

  return (
    <QavanteCard variant="bordered" header={<span className="font-medium">Top deudores</span>}>
      <ul className="divide-y divide-border">
        {ordered.map((d) => {
          const rut = normalizeRut(d.rut);
          const isOpen = openRut === rut;
          const docs = invoices.byRut.get(rut) ?? [];
          const pct = shareOfTotal(d.total, total);
          return (
            <li key={d.rut}>
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => {
                  setEverOpened(true);
                  setOpenRut(isOpen ? null : rut);
                }}
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
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-dark">{d.name}</p>
                    <p className="text-xs text-neutral-mid">{formatRut(d.rut)}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="font-semibold text-neutral-dark">
                    {formatClp(parseAmount(d.total))}
                  </p>
                  {/* Concentración: qué parte del total por cobrar es este cliente. */}
                  {pct >= 0.5 && (
                    <p className="text-xs text-neutral-mid">
                      {pct.toLocaleString("es-CL", { maximumFractionDigits: 1 })}% del total
                    </p>
                  )}
                  {parseAmount(d.overdue) > 0 && (
                    <p className="text-xs font-medium text-danger-500">
                      {formatClp(parseAmount(d.overdue))} vencido
                    </p>
                  )}
                </div>
              </button>
              {isOpen && (
                <DebtorInvoicesPanel
                  docs={docs}
                  loading={invoices.isFetching}
                  error={invoices.isError}
                  siiEnabled={siiEnabled}
                />
              )}
            </li>
          );
        })}
      </ul>
    </QavanteCard>
  );
}

/* Detalle expandido de un deudor: sus facturas del Libro (folio/fecha/monto).
   Exportado para testear en aislamiento con props (ADR-0018), sin red. */
export function DebtorInvoicesPanel({
  docs,
  loading,
  error,
  siiEnabled,
}: {
  docs: RcvDoc[];
  loading: boolean;
  error: boolean;
  siiEnabled: boolean;
}) {
  const libroLink = (
    <Link href="/cobrar/facturas-emitidas" className="text-brand-primary hover:underline">
      Ver el Libro de Ventas completo
    </Link>
  );

  let body: React.ReactNode;
  if (!siiEnabled) {
    body = (
      <p className="text-xs text-neutral-mid">
        Conecta el SII para ver las facturas de este cliente.
      </p>
    );
  } else if (error) {
    body = (
      <p className="text-xs text-neutral-mid">
        No pudimos traer las facturas del SII. Intenta de nuevo en un momento.
      </p>
    );
  } else if (loading && docs.length === 0) {
    body = <p className="text-xs text-neutral-mid">Cargando facturas del cliente…</p>;
  } else if (docs.length === 0) {
    body = (
      <p className="text-xs text-neutral-mid">
        Sin facturas de este cliente en los últimos 6 meses. {libroLink}.
      </p>
    );
  } else {
    // Orden cronológico real (desc): el SII emite `fecha` en varios formatos
    // (ISO no-padded, DD/MM/YYYY…) → localeCompare del string cruda ordenaba mal.
    const ordered = [...docs].sort((a, b) => fechaSortKey(b.fecha) - fechaSortKey(a.fecha));
    body = (
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Folio
                </th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">
                  Fecha
                </th>
                <th scope="col" className="py-1.5 text-right font-semibold">
                  Monto
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((doc, i) => (
                <tr key={`${doc.folio}-${i}`} className="border-b border-border/50 last:border-b-0">
                  <td className="py-1.5 pr-3 tabular-nums text-neutral-dark">{doc.folio ?? "s/d"}</td>
                  <td className="py-1.5 pr-3 text-neutral-mid">
                    {doc.fecha ? formatDateLike(doc.fecha) : "s/d"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-neutral-dark">
                    {formatClp(Number(doc.monto_total) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-neutral-mid">
          Facturas emitidas a este cliente (Libro de Ventas, últimos 6 meses). El saldo pendiente
          y los días de mora por factura aparecen cuando el SII entregue las fechas de vencimiento.
        </p>
      </>
    );
  }

  return (
    <div className="mb-2 ml-6 rounded-lg border border-border bg-surface-muted/40 px-3 py-3">
      {body}
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
