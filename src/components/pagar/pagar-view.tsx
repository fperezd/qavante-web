"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, HelpCircle, Users } from "lucide-react";
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
import {
  MONTO_EN_REVISION,
  MONTO_EN_REVISION_MOTIVO,
  importeDesconocido,
} from "@/lib/formatters/amount";
import { formatPct } from "@/lib/formatters/pct";
import { formatDateLike } from "@/lib/formatters/date";
import {
  montoCLP,
  montoCLPFaltante,
  montoEnRevision,
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
import type { PayableCriticality, PayableItem } from "@/lib/api/pagos";
import { CashProjectionRunPanel } from "@/components/cash-projection-runs/cash-projection-run-panel";

/* Pagar — cuentas por pagar (Sprint C4, Maestro §7.4): resumen (total + 7/14/30
   días), relación contra caja, y pagos/obligaciones (proveedores + IVA/PPM/
   Previred/sueldos/arriendos/deuda/leasing). Herramienta de decisión (control de
   gestión): bucket "Vencido" al frente, subtotales por criticidad, orden
   vencido→crítico. Container. Contrato FE-first gated por `accountsPayable`. */

const CRIT_VARIANT: Record<PayableCriticality, "danger" | "warning" | "default"> = {
  high: "danger",
  medium: "warning",
  low: "default",
  unknown: "default",
};
const CRIT_LABEL: Record<PayableCriticality, string> = {
  high: "Crítico",
  medium: "Medio",
  low: "Bajo",
  unknown: "Sin fecha confirmada",
};

export function PagarView({
  suppressRecommendations = false,
}: {
  suppressRecommendations?: boolean;
}) {
  const query = useAccountsPayable();
  const projection = <CashProjectionRunPanel horizonDays={14} title="Caja para decidir pagos" />;

  if (query.isLoading)
    return (
      <div className="space-y-4">
        {projection}
        <LoadingSkeleton />
      </div>
    );
  if (query.isError) {
    return (
      <div className="space-y-4">
        {projection}
        <QavanteInlineError
          error={query.error}
          what="las cuentas por pagar"
          onRetry={() => query.refetch()}
        />
      </div>
    );
  }
  // #907: `total: null` (cuarentena de conciliación) es DESCONOCIDO, no "sin pagos pendientes".
  if (query.data && query.data.total != null && parseAmount(query.data.total) === 0) {
    return (
      <div className="space-y-4">
        {projection}
        {isSyncPending(query.data) ? (
          <SyncPendingState
            missingSources={query.data.missing_sources}
            what="tus cuentas por pagar"
          />
        ) : (
          <QavanteEmpty
            title="No tienes pagos pendientes"
            description={
              suppressRecommendations
                ? "Cuando tengas pagos u obligaciones por vencer, vas a verlos acá como respaldo de la decisión."
                : "Cuando tengas pagos u obligaciones por vencer, vas a verlos acá priorizados por criticidad."
            }
          />
        )}
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="space-y-4">
        {projection}
        <QavanteEmpty
          title="No tienes pagos pendientes"
          description={
            suppressRecommendations
              ? "Cuando tengas pagos u obligaciones por vencer, vas a verlos acá como respaldo de la decisión."
              : "Cuando tengas pagos u obligaciones por vencer, vas a verlos acá priorizados por criticidad."
          }
        />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {projection}
      <Payable data={query.data} suppressRecommendations={suppressRecommendations} />
    </div>
  );
}

function Payable({
  data,
  suppressRecommendations,
}: {
  data: AccountsPayableResponse;
  suppressRecommendations: boolean;
}) {
  // `now` estable por montaje (evita recomputar el bucketing en cada render).
  const now = React.useMemo(() => new Date(), []);
  // `items` es opcional en el contrato (backend lo omite en estado partial).
  const rawItems = React.useMemo(() => data.items ?? [], [data.items]);
  // #907: con cuarentena de conciliación viva los montos AP son desconocidos. Las sumas locales
  // sobre la página (vencido, subtotales, %) dejarían fuera los pagos en revisión y se leerían
  // como totales: no se publican.
  const enRevision = importeDesconocido(data);
  const overdue = React.useMemo(() => overdueTotal(rawItems, now), [rawItems, now]);
  const subtotals = React.useMemo(
    () => (suppressRecommendations ? null : subtotalsByCriticality(rawItems)),
    [rawItems, suppressRecommendations],
  );
  // Agrupación por categoría (eje universal: "en qué se va la plata").
  const groups = React.useMemo(
    () => groupByCategory(rawItems, { order: suppressRecommendations ? "source" : "subtotal" }),
    [rawItems, suppressRecommendations],
  );
  const total = data.total == null ? null : parseAmount(data.total);
  const tile = (raw: string | null) =>
    raw == null ? MONTO_EN_REVISION : <AmountCountUp value={parseAmount(raw)} />;
  return (
    <div className="space-y-4">
      {/* "Los montos son correctos" sería falso con montos en revisión (#907). */}
      {isPartial(data) && !enRevision && (
        <PartialDataBanner missingSources={data.missing_sources} />
      )}
      {enRevision && (
        <p
          role="status"
          className="rounded-xl border border-warning-500/30 bg-warning-500/5 p-3 text-sm text-neutral-dark"
        >
          <span className="font-medium">Montos en revisión.</span> {MONTO_EN_REVISION_MOTIVO}
        </p>
      )}

      {/* Resumen. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <QavanteStatTile
          label="Total por pagar"
          value={tile(data.total)}
          info="Todo lo que le debes a tus proveedores y aún no pagas, según las facturas que recibiste."
        />
        <QavanteStatTile
          label="Próx. 7 días"
          value={tile(data.due_7d)}
          tone={suppressRecommendations ? "default" : "danger"}
          info="Lo que vence dentro de los próximos 7 días. Es tu compromiso de caja más inmediato."
        />
        <QavanteStatTile
          label="Próx. 14 días"
          value={tile(data.due_14d)}
          info="Lo que vence dentro de los próximos 14 días. Incluye lo de los próximos 7."
        />
        <QavanteStatTile
          label="Próx. 30 días"
          value={tile(data.due_30d)}
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

      {/* Con Brief, vencido sigue siendo evidencia de fecha, no una instrucción local. */}
      {!enRevision &&
        overdue > 0 &&
        (suppressRecommendations ? (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm"
          >
            <span className="font-medium text-neutral-dark">Pagos vencidos registrados</span>
            <span className="tabular-nums font-semibold text-neutral-dark">
              {formatClp(overdue)}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-2 font-medium text-neutral-dark">
              <AlertTriangle className="h-4 w-4 shrink-0 text-danger-500" aria-hidden="true" />
              Vencido, pagar cuanto antes
            </span>
            <span className="tabular-nums font-semibold text-danger-500">{formatClp(overdue)}</span>
          </div>
        ))}

      {/* Subtotales por criticidad (control de gestión: dónde está la plata que
          más urge). Solo cuando hay más de un nivel con monto. */}
      {!suppressRecommendations &&
        !enRevision &&
        subtotals &&
        [subtotals.high, subtotals.medium, subtotals.low].filter((v) => v > 0).length > 1 && (
          <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-xl border border-border bg-surface-muted px-4 py-2.5 text-sm">
            <CriticalitySubtotal label="Crítico" value={subtotals.high} tone="danger" />
            <CriticalitySubtotal label="Medio" value={subtotals.medium} tone="warning" />
            <CriticalitySubtotal label="Bajo" value={subtotals.low} tone="neutral" />
          </div>
        )}

      {/* La evaluación transversal reemplaza sólo este diagnóstico local; los montos permanecen. */}
      {!suppressRecommendations && <CoberturaDeCaja data={data} />}

      {/* Pagos y obligaciones — agrupados por categoría (expandibles). */}
      <PagosPorCategoria
        groups={groups}
        total={total}
        now={now}
        suppressRecommendations={suppressRecommendations}
      />
    </div>
  );
}

/* Relación contra caja — LAS TRES RAMAS EN UN SOLO LUGAR (#41).
 *
 * Antes vivían sueltas en el render del container, y eso tenía dos problemas que el pase §6
 * midió:
 *
 *   1. **No se podían testear.** Las stories montaban el presentacional del "no sé" directo,
 *      así que borrar la línea que lo enganchaba dejaba todo en verde: se probaba el
 *      componente, no el cableado. Con las tres acá, borrar cualquiera pone una story en rojo.
 *   2. **`undefined` se escapaba.** `covers_critical` es OPCIONAL en el contrato
 *      (`covers_critical?: boolean | null`), así que un payload sin la clave no matcheaba
 *      `=== null` y volvía el silencio — el bug exacto que esto viene a arreglar, por la
 *      puerta de atrás. Acá se comparan los dos valores VERDADEROS (`true`/`false`) y todo
 *      lo demás —`null`, `undefined`, clave ausente— cae en "no se puede determinar", que es
 *      la respuesta honesta.
 */
export function CoberturaDeCaja({ data }: { data: AccountsPayableResponse }) {
  if (data.covers_critical === false) {
    return (
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
    );
  }
  if (data.covers_critical === true) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-success-700">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        La caja proyectada cubre los pagos críticos próximos.
      </p>
    );
  }
  return <CoberturaIndeterminada data={data} />;
}

/* La cobertura de caja cuando NO se puede determinar (#41).
 *
 * Tono neutro a propósito, no rojo: "no sabemos" no es "no alcanza". Pintarlo de alarma
 * sería inventar una mala noticia, que es el error simétrico de inventar una buena — y la
 * ley de la casa es un solo rojo por pantalla, reservado a lo crítico y accionable.
 *
 * Dice el PORQUÉ con el monto, no una fórmula vaga: la razón concreta (deuda sin fecha de
 * vencimiento, o tipo de cambio pendiente) viene del backend en `missing_sources`, y el
 * monto sin agendar en `undated_amount`.
 *
 * EXPORTADO para poder afirmarlo en Storybook, igual que `DebtorInvoicesPanel` y
 * `TopDebtors` en Cobrar: las stories del container no pueden llevar `play` porque muere
 * con "NEXT_PUBLIC_API_URL no configurada" antes de que MSW intercepte. */
export function CoberturaIndeterminada({ data }: { data: AccountsPayableResponse }) {
  // #907: con cuarentena los montos son desconocidos: ni "sin fecha $0" ni "piso".
  if (importeDesconocido(data)) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-neutral-light/40 p-3 text-sm text-neutral-dark">
        <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
        <p>
          <span className="font-medium">No podemos decirte si la caja alcanza</span> para los pagos
          críticos próximos. {MONTO_EN_REVISION_MOTIVO}
        </p>
      </div>
    );
  }
  const sinFecha = parseAmount(data.undated_amount ?? "0");
  const cuantos = data.undated_count ?? 0;
  const faltaTc = (data.missing_sources ?? []).some((m) => m.startsWith("Tipo de cambio"));

  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-neutral-light/40 p-3 text-sm text-neutral-dark">
      <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
      <p>
        <span className="font-medium">No podemos decirte si la caja alcanza</span> para los pagos
        críticos próximos.{" "}
        {sinFecha > 0 && (
          <>
            Hay {formatClp(sinFecha)}
            {cuantos > 0 && ` en ${cuantos} documento${cuantos === 1 ? "" : "s"}`} sin fecha de
            vencimiento, así que no entran en el cálculo de los próximos 14 días.{" "}
          </>
        )}
        {faltaTc && (
          <>
            Además falta el tipo de cambio de alguna moneda, así que parte de la deuda quedó fuera
            del total en pesos.{" "}
          </>
        )}
        {sinFecha === 0 && !faltaTc && data.projected_cash_14d == null && (
          <>Todavía no podemos proyectar tu caja a 14 días, así que no hay con qué comparar. </>
        )}
        Los tramos que ves arriba son un <span className="font-medium">piso</span>, no el total.
      </p>
    </div>
  );
}

/* Grupos de pago por categoría: cada uno muestra su subtotal + concentración
   (% del total) y se expande a sus ítems. Es el eje universal multi-tenant. */
function PagosPorCategoria({
  groups,
  total,
  now,
  suppressRecommendations,
}: {
  groups: ReturnType<typeof groupByCategory>;
  /** `null` = total en revisión (#907): no hay base para porcentajes. */
  total: number | null;
  now: Date;
  suppressRecommendations: boolean;
}) {
  const [openCat, setOpenCat] = React.useState<string | null>(groups[0]?.category ?? null);
  return (
    <QavanteCard
      variant="bordered"
      header={
        <span className="font-medium">
          {suppressRecommendations ? "Pagos y obligaciones · evidencia" : "Pagos y obligaciones"}
        </span>
      }
    >
      <ul className="divide-y divide-border">
        {groups.map((g) => {
          const isOpen = openCat === g.category;
          const pct =
            suppressRecommendations || total == null || g.items.some(montoEnRevision)
              ? null
              : shareOfTotal(g.subtotal, total);
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
                  {/* #907: un grupo con un pago en revisión no tiene subtotal conocido. */}
                  <span className="font-semibold text-neutral-dark">
                    {g.items.some(montoEnRevision)
                      ? MONTO_EN_REVISION.toLowerCase()
                      : formatClp(g.subtotal)}
                  </span>
                  {pct !== null && pct >= 0.5 && (
                    <span className="ml-2 text-xs text-neutral-mid">
                      {formatPct(pct)} del total
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <CategoryItems items={g.items} now={now} neutralOrder={suppressRecommendations} />
              )}
            </li>
          );
        })}
      </ul>
    </QavanteCard>
  );
}

/* Ítems de una categoría (ordenados vencido→crítico). */
function CategoryItems({
  items,
  now,
  neutralOrder = false,
}: {
  items: PayableItem[];
  now: Date;
  neutralOrder?: boolean;
}) {
  const ordered = React.useMemo(
    () => (neutralOrder ? items : overdueThenCritical(items, now)),
    [items, neutralOrder, now],
  );
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
            {!neutralOrder && (
              <th scope="col" className="py-1.5 font-medium">
                Criticidad
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ordered.map((it, i) => (
            <tr
              key={i}
              className="border-b border-border/50 last:border-b-0 hover:bg-surface-muted"
            >
              <td className="py-1.5 pr-3 text-neutral-dark">
                <span className="block truncate" title={payableItemLabel(it)}>
                  {it.counterparty_name ?? payableItemLabel(it)}
                </span>
                <span className="text-xs text-neutral-mid">
                  {it.folio
                    ? `${paymentCategoryLabel(it.category)} · folio ${it.folio}`
                    : it.source}
                </span>
                {/* Drill-down de nómina → detalle por empleado de ese período. */}
                <PayrollDetailLink item={it} />
              </td>
              <td className="py-1.5 pr-3 text-neutral-mid">
                <span className="inline-flex items-center gap-1.5">
                  {formatDateLike(it.due_date)}
                  {!neutralOrder && isOverdue(it, now) && (
                    <QavanteBadge variant="danger">Vencido</QavanteBadge>
                  )}
                </span>
              </td>
              <td className="py-1.5 pr-3 text-right tabular-nums text-neutral-dark">
                {montoEnRevision(it) ? (
                  <span className="text-neutral-mid" title={MONTO_EN_REVISION_MOTIVO}>
                    {MONTO_EN_REVISION.toLowerCase()}
                  </span>
                ) : montoCLPFaltante(it) ? (
                  <span
                    className="text-neutral-mid"
                    title="Monto en moneda extranjera sin convertir a pesos"
                  >
                    sin convertir
                  </span>
                ) : (
                  formatClp(montoCLP(it))
                )}
              </td>
              {!neutralOrder && (
                <td className="py-1.5">
                  <QavanteBadge variant={CRIT_VARIANT[it.criticality]}>
                    {CRIT_LABEL[it.criticality]}
                  </QavanteBadge>
                </td>
              )}
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
