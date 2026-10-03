"use client";

import * as React from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  CircleDollarSign,
  HandCoins,
  Mail,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  type AccountsReceivableResponse,
  type CollectionReminderItemResult,
  type ReceivableDocumentItem,
  type ReceivableDocumentsResponse,
  useAccountsReceivable,
  useReceivableDocuments,
  useSendCollectionReminders,
} from "@/lib/api/cobranza";
import { formatClp, formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { formatPct } from "@/lib/formatters/pct";
import {
  MONTO_EN_REVISION,
  formatClpODesconocido,
  parseAmountOrNull,
} from "@/lib/formatters/amount";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";

type StatusFilter = "collectable" | "today" | "overdue" | "undated" | "paid" | "archived";
type AttributeFilter = "credit_note" | "ceded" | "claimed";

const STATUS_FILTERS: { id: StatusFilter; label: string; icon?: React.ElementType }[] = [
  { id: "collectable", label: "Todo en por cobrar" },
  { id: "today", label: "Vence hoy" },
  { id: "overdue", label: "Vencido" },
  { id: "undated", label: "Sin vencimiento" },
  { id: "paid", label: "Cobrado", icon: CheckCircle2 },
  { id: "archived", label: "Archivado", icon: Archive },
];

const ATTRIBUTE_FILTERS: { id: AttributeFilter; label: string }[] = [
  { id: "credit_note", label: "Notas de crédito" },
  { id: "ceded", label: "Cedidas" },
  { id: "claimed", label: "Reclamadas" },
];

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago" }).format(new Date());
}

export function formatCollectionMoney(
  values: { currency: string; amount: string | null }[] | null,
) {
  if (values == null) return "Sin información";
  if (values.length === 0) return "$0";
  return values
    .map(({ currency, amount }) =>
      // #907: `amount: null` = en revisión de conciliación en esa moneda; nunca "$0" ni "s/d".
      amount == null
        ? `${MONTO_EN_REVISION} (${currency})`
        : (formatMoneyFromDecimalString(amount, currency) ?? "s/d"),
    )
    .join(" · ");
}

/* ── Los tres recuadros de arriba ────────────────────────────────────────────────────────────
 *
 * EL CERO FABRICADO, medido en producción el 2026-10-02 (tenant Tooxs): la cartera tenía
 * $44.829.044 por cobrar en 22 documentos y **ninguno** con fecha de vencimiento, así que
 * `/accounts-receivable` respondía `overdue: null` y `/documents` respondía `overdue: []`.
 * Un arreglo vacío pasaba por `formatCollectionMoney` y salía "$0": la pantalla afirmaba
 * "no tienes nada vencido" sobre una cartera entera. El contrato lo dice con todas las letras
 * ("`null` ... es 'no sé', no '$0'"), pero el recuadro leía el endpoint que no sabe decirlo.
 *
 * POR QUÉ ESTOS RECUADROS LEEN `/accounts-receivable` Y NO `/documents`: `/documents` publica
 * `overdue` como lista NO nullable, así que no tiene forma de distinguir "nada vencido" de
 * "todavía no se puede calcular". Los dos llegan como `[]`. El resumen agregado sí distingue,
 * y además trae `undated_amount` y `document_count`, que son las dos cifras con las que se
 * explica el caso. Es la misma fuente que ya usa V04 y "Te deben" de Inicio (Ley 1: un número,
 * una definición).
 *
 * Y LAS PALABRAS: nunca "no disponible", "sin dato", "no hay", "preliminar" ni una etiqueta de
 * confianza. Siempre una cifra y de qué está hecha, o una acción concreta. Acá la acción es
 * traer las fechas del SII, porque no existe —hoy— pantalla para escribirlas a mano: el
 * vencimiento viaja en el XML del DTE y el RCV no lo trae. */

/** La única acción que de verdad cierra el hueco: las fechas llegan del SII, no del teclado. */
const ACCION_TRAER_FECHAS = {
  texto: "Revisar la conexión con el SII",
  href: "/conexiones",
} as const;

export type RecuadroCobranza = {
  value: string;
  detail?: string;
  note?: string;
  accion?: { texto: string; href: string };
};

/** `undated_amount` en pesos, o `null`. Es la plata viva SIN vencimiento confirmado: la que
 *  queda fuera del aging y por la que `overdue` puede venir sin computar. */
function sinFechaDe(ar: AccountsReceivableResponse): number | null {
  return parseAmountOrNull(ar.undated_amount);
}

function documentos(n: number) {
  return `${n} ${n === 1 ? "documento" : "documentos"}`;
}

export function recuadroVencido(ar: AccountsReceivableResponse): RecuadroCobranza {
  const vencido = parseAmountOrNull(ar.overdue);
  const sinFecha = sinFechaDe(ar);
  const faltan = sinFecha != null && sinFecha > 0;

  if (vencido == null) {
    // El backend no pudo computar la mora porque los documentos no tienen fecha. Se dice la
    // cifra que SÍ se conoce —la cartera y de cuántos documentos está hecha— y qué falta para
    // separar el vencido. Jamás "$0" ni un rótulo de confianza.
    return {
      value: `${formatClpODesconocido(ar.total, ar.amount_unknown_reason)} por cobrar`,
      detail: documentos(ar.document_count),
      note: "Lo vencido se separa con la fecha de vencimiento de cada factura. El SII la entrega en el XML del DTE y el RCV no la trae, así que entra con la sincronización.",
      accion: ACCION_TRAER_FECHAS,
    };
  }

  const pct = parseAmountOrNull(ar.overdue_pct);
  return {
    value: formatClpODesconocido(ar.overdue, ar.amount_unknown_reason),
    detail: pct != null ? `${formatPct(pct)} de la cartera` : documentos(ar.document_count),
    // Un vencido conocido puede ser un PISO: la plata sin fecha no está en ningún tramo.
    note: faltan
      ? `${formatClp(sinFecha)} se suman a esta cifra en cuanto el SII entregue sus fechas de vencimiento.`
      : undefined,
    accion: faltan ? ACCION_TRAER_FECHAS : undefined,
  };
}

export function recuadroPorCobrar(
  docs: Pick<ReceivableDocumentsResponse, "due_soon">,
  ar: AccountsReceivableResponse,
): RecuadroCobranza {
  const sinFecha = sinFechaDe(ar);
  const total = parseAmountOrNull(ar.total);
  // Lo que ya tiene fecha y por lo tanto PUEDE caer en una ventana de 7 días.
  const agendable = total != null && sinFecha != null ? total - sinFecha : null;

  if (agendable != null && agendable <= 0 && sinFecha != null && sinFecha > 0) {
    // Sin una sola fecha en la cartera, "próximos 7 días" no es un cero medido: es la cartera
    // completa esperando fecha. Eso es lo que dice el recuadro.
    return {
      value: `${formatClp(sinFecha)} por agendar`,
      detail: documentos(ar.document_count),
      note: "Con las fechas cargadas, acá aparece lo que entra en los próximos 7 días.",
      accion: ACCION_TRAER_FECHAS,
    };
  }

  return {
    value: formatCollectionMoney(docs.due_soon),
    detail: "Próximos 7 días",
    note:
      sinFecha != null && sinFecha > 0
        ? `${formatClp(sinFecha)} quedan fuera de esta ventana hasta que tengan fecha de vencimiento.`
        : undefined,
    accion: sinFecha != null && sinFecha > 0 ? ACCION_TRAER_FECHAS : undefined,
  };
}

export function collectedMetric(
  data: Pick<ReceivableDocumentsResponse, "collected" | "collected_coverage" | "collected_reason">,
): RecuadroCobranza {
  if (data.collected != null) {
    return { value: formatCollectionMoney(data.collected), detail: "Últimos 7 días" };
  }

  // `collected: null` = la trazabilidad de conciliación no alcanza para afirmar un monto. Antes
  // acá se leía "Sin información", que no dice qué hacer ni qué se sabe. La cifra existe del
  // otro lado de la conciliación, así que el recuadro lleva a cerrarla.
  const comun = {
    detail: "Últimos 7 días",
    accion: { texto: "Ir a Banco y conciliar", href: "/banco" },
  };
  if (
    data.collected_coverage === "unverified_legacy_collections" &&
    data.collected_reason === "legacy_collection_lineage_unavailable"
  ) {
    return {
      ...comun,
      value: "Conciliación por cerrar",
      note: "Los cobros históricos se suman acá en cuanto cada uno quede conciliado con su movimiento de banco.",
    };
  }

  return {
    ...comun,
    value: "Conciliación por cerrar",
    note: "Los cobros de estos 7 días se suman acá en cuanto queden conciliados con sus movimientos de banco.",
  };
}

function dateLabel(value: string | null | undefined) {
  return value ? formatDateLike(value) : null;
}

export function matchesCollectionStatus(
  item: ReceivableDocumentItem,
  filter: StatusFilter,
  today: string,
) {
  if (filter === "paid") return item.status === "paid";
  if (filter === "archived") return item.status === "cancelled";
  if (!["open", "partially_paid"].includes(item.status) || item.ceded) return false;
  if (filter === "undated") return item.due_date_certainty !== "confirmed";
  if (filter === "today") return item.due_date === today && item.due_date_certainty === "confirmed";
  if (filter === "overdue") return item.days_overdue != null && item.days_overdue > 0;
  return true;
}

export function isReminderEligible(item: ReceivableDocumentItem) {
  // #907: un saldo en revisión de conciliación no se cobra por recordatorio (y nunca `Number(null)`).
  if (item.outstanding_amount == null) return false;
  const outstanding = Number(item.outstanding_amount);
  return (
    ["open", "partially_paid"].includes(item.status) &&
    !item.ceded &&
    !item.credit_note &&
    Number.isFinite(outstanding) &&
    outstanding > 0 &&
    item.due_date_certainty === "confirmed"
  );
}

export function reminderIdempotencyKey(
  keys: Map<string, string>,
  ids: string[],
  create: () => string = () => crypto.randomUUID(),
) {
  const fingerprint = [...ids].sort().join(",");
  const existing = keys.get(fingerprint);
  if (existing) return { fingerprint, key: existing };
  const key = create();
  keys.set(fingerprint, key);
  return { fingerprint, key };
}

export function hasAmbiguousReminderFailure(items: CollectionReminderItemResult[]) {
  return items.some((item) => item.status === "error");
}

export function GestionCobrosLive({
  suppressRecommendations = false,
}: {
  suppressRecommendations?: boolean;
} = {}) {
  const query = useReceivableDocuments();
  // Segunda fuente, SÓLO para los tres recuadros: es la única que distingue "nada vencido" de
  // "todavía sin fecha" (ver el bloque de `recuadroVencido`). La lista de abajo sigue saliendo
  // de `/documents`, que es quien pagina y filtra.
  const resumen = useAccountsReceivable();
  const send = useSendCollectionReminders();
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<StatusFilter>("collectable");
  const [attribute, setAttribute] = React.useState<AttributeFilter | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const idempotencyKeys = React.useRef(new Map<string, string>());
  const today = todayIso();

  const items = React.useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-CL");
    return (query.data?.items ?? []).filter((item) => {
      const statusMatches =
        attribute === "ceded" && status === "collectable"
          ? ["open", "partially_paid"].includes(item.status)
          : matchesCollectionStatus(item, status, today);
      if (!statusMatches) return false;
      if (attribute && !item[attribute]) return false;
      return (
        !term ||
        `${item.customer_name} ${item.customer_rut ?? ""} ${item.folio}`
          .toLocaleLowerCase("es-CL")
          .includes(term)
      );
    });
  }, [attribute, query.data?.items, search, status, today]);

  const eligible = items.filter(isReminderEligible);
  const allSelected = eligible.length > 0 && eligible.every((item) => selected.has(item.id));

  const sendSelected = async () => {
    const ids = [...selected].sort();
    if (!ids.length) return;
    const { fingerprint, key: idempotencyKey } = reminderIdempotencyKey(
      idempotencyKeys.current,
      ids,
    );
    try {
      const result = await send.mutateAsync({
        receivable_ids: ids,
        idempotency_key: idempotencyKey,
      });
      if (hasAmbiguousReminderFailure(result.items)) {
        toast.error("No pudimos confirmar todos los envíos.", {
          description: "Reintenta para consultar el mismo intento sin duplicar correos.",
        });
        return;
      }
      const sent = result.items.filter((item) => item.status === "sent").length;
      toast.success(
        sent
          ? `${sent} recordatorio${sent === 1 ? " enviado" : "s enviados"}`
          : "No se enviaron recordatorios",
        {
          description:
            result.items
              .filter((item) => item.status !== "sent")
              .map((item) => item.detail)
              .join(" · ") || undefined,
        },
      );
      idempotencyKeys.current.delete(fingerprint);
      setSelected(new Set());
    } catch {
      toast.error("No pudimos enviar los recordatorios.");
    }
  };

  if (query.isLoading || resumen.isLoading) return <CobrosSkeleton />;
  if (query.isError || !query.data) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <AlertCircle className="mx-auto mb-3 size-6 text-warning-600" />
        <p className="font-semibold text-neutral-dark">No pudimos cargar la gestión de cobros.</p>
        <button
          className="mt-3 text-sm font-semibold text-brand-primary"
          onClick={() => void query.refetch()}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div
      className="space-y-6"
      data-recommendations-suppressed={suppressRecommendations || undefined}
    >
      <section className="grid gap-4 md:grid-cols-3" aria-label="Resumen de cobranza">
        {resumen.data ? (
          <>
            <MetricCard
              icon={AlertCircle}
              label="Vencido"
              danger
              {...recuadroVencido(resumen.data)}
            />
            <MetricCard
              icon={HandCoins}
              label="Por cobrar"
              {...recuadroPorCobrar(query.data, resumen.data)}
            />
          </>
        ) : (
          // El resumen agregado no llegó. NO se cae de vuelta a `/documents`: ahí `overdue: []`
          // volvería a pintar "$0" sobre una cartera sin fechar, que es justo el cero que este
          // componente dejó de fabricar. Se ofrece reintentar y la lista de abajo sigue entera.
          <MetricCard
            icon={AlertCircle}
            label="Vencido"
            detail="Por cobrar"
            value="Volver a calcular"
            note="La lista de documentos de abajo está completa; el resumen de la cartera se recalcula al reintentar."
            onRetry={() => void resumen.refetch()}
            danger
          />
        )}
        <CollectedMetricCard data={query.data} />
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[16rem] flex-1">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-mid"
              aria-hidden
            />
            <span className="sr-only">Buscar por cliente, RUT o folio</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, folio o RUT"
              className="h-10 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            />
          </label>
          <div className="flex flex-wrap rounded-lg border border-border bg-surface">
            {STATUS_FILTERS.map((filter) => {
              const Icon = filter.icon;
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="radio"
                  aria-checked={status === filter.id}
                  onClick={() => setStatus(filter.id)}
                  className={cn(
                    "flex min-h-10 items-center gap-1.5 border-r border-border px-3 text-xs font-medium text-neutral-mid last:border-r-0 hover:bg-neutral-50",
                    status === filter.id && "bg-brand-primary-50 font-semibold text-brand-primary",
                  )}
                >
                  {Icon && <Icon className="size-3.5" aria-hidden />}
                  {suppressRecommendations && filter.id === "collectable" ? "Todos" : filter.label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="size-4 text-neutral-mid" aria-hidden />
          <span className="text-xs font-semibold text-neutral-mid">Filtros</span>
          {ATTRIBUTE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              aria-pressed={attribute === filter.id}
              onClick={() => setAttribute(attribute === filter.id ? null : filter.id)}
              className={cn(
                "rounded-lg border border-border bg-surface px-3 py-2 text-xs text-neutral-mid",
                attribute === filter.id &&
                  "border-brand-primary bg-brand-primary-50 text-brand-primary",
              )}
            >
              {filter.label}
            </button>
          ))}
          {(attribute || status !== "collectable" || search) && (
            <button
              type="button"
              onClick={() => {
                setAttribute(null);
                setStatus("collectable");
                setSearch("");
              }}
              className="ml-auto text-xs font-semibold text-brand-primary"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </section>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-brand-primary-50 px-4 py-3 text-sm">
          <span className="font-semibold text-neutral-dark">
            {selected.size} documento{selected.size === 1 ? "" : "s"} seleccionado
            {selected.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => void sendSelected()}
            disabled={send.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-semibold text-white disabled:opacity-50"
          >
            <Mail className="size-4" /> {send.isPending ? "Enviando…" : "Enviar recordatorio"}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-neutral-50 text-xs font-semibold text-neutral-mid">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar documentos elegibles"
                    checked={allSelected}
                    onChange={(event) =>
                      setSelected(
                        event.target.checked ? new Set(eligible.map((item) => item.id)) : new Set(),
                      )
                    }
                  />
                </th>
                <th className="px-3 py-3">Folio</th>
                <th className="px-3 py-3">Cliente</th>
                <th className="px-3 py-3">Emisión</th>
                <th className="px-3 py-3">Vencimiento</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3">Atributos</th>
                <th className="px-3 py-3 text-right">Monto pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => {
                const canSelect = isReminderEligible(item);
                return (
                  <tr key={item.id} className="hover:bg-neutral-50/70">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Seleccionar ${item.folio}`}
                        disabled={!canSelect}
                        checked={selected.has(item.id)}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(item.id);
                            else next.delete(item.id);
                            return next;
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-3 font-semibold text-neutral-dark">
                      <span className="mr-1 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium">
                        {item.credit_note ? "NC" : "FACTURA"}
                      </span>
                      {item.folio}
                    </td>
                    <td className="max-w-[250px] px-3 py-3">
                      <p className="truncate font-medium text-neutral-dark">{item.customer_name}</p>
                      <p className="text-xs text-neutral-mid">
                        {item.customer_rut ?? "RUT sin dato"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-neutral-mid">{dateLabel(item.issue_date)}</td>
                    <td className="px-3 py-3">
                      {item.due_date_certainty === "confirmed" ? (
                        dateLabel(item.due_date)
                      ) : (
                        <span className="text-brand-primary">Sin vencimiento confirmado</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill item={item} today={today} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.ceded && <Attribute label="Cedida" />}
                        {item.claimed && <Attribute label="Reclamada" />}
                        {item.credit_note && <Attribute label="Nota de crédito" />}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-neutral-dark">
                      {formatCollectionMoney([
                        { currency: item.currency_code, amount: item.outstanding_amount },
                      ])}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length === 0 && (
          <p className="p-10 text-center text-sm text-neutral-mid">
            No hay documentos para este filtro.
          </p>
        )}
        <div className="border-t border-border px-4 py-3 text-xs text-neutral-mid">
          {items.length} de {query.data.total} documentos
        </div>
      </div>
    </div>
  );
}

/** Límite de presentación del contrato #837: sólo esta tarjeta conoce la
 * abstención de `collected`; el resto de Cobrar sigue mostrando sus datos propios. */
export function CollectedMetricCard({
  data,
}: {
  data: Pick<ReceivableDocumentsResponse, "collected" | "collected_coverage" | "collected_reason">;
}) {
  // Se esparce el modelo completo: enumerar los campos a mano fue lo que dejó la acción del
  // recuadro sin renderizar, o sea el camino concreto perdido justo donde más hace falta.
  return <MetricCard icon={CircleDollarSign} label="Cobrado" {...collectedMetric(data)} />;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  note,
  accion,
  onRetry,
  danger = false,
}: RecuadroCobranza & {
  icon: React.ElementType;
  label: string;
  onRetry?: () => void;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div
        className={cn(
          "flex items-center gap-2 text-sm font-semibold text-neutral-dark",
          danger && "text-danger-600",
        )}
      >
        <Icon className="size-4" />
        {label}
        {detail && <span className="ml-auto font-normal text-neutral-mid">{detail}</span>}
      </div>
      <p
        className={cn(
          "mt-3 text-2xl font-bold tabular-nums text-neutral-dark",
          danger && "text-danger-600",
        )}
      >
        {value}
      </p>
      {note && <p className="mt-2 text-xs leading-relaxed text-neutral-mid">{note}</p>}
      {accion && (
        <Link
          href={accion.href}
          className="mt-3 inline-block text-xs font-semibold text-brand-primary hover:underline"
        >
          {accion.texto}
        </Link>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 text-xs font-semibold text-brand-primary hover:underline"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

function StatusPill({ item, today }: { item: ReceivableDocumentItem; today: string }) {
  if (item.status === "paid")
    return (
      <span className="rounded-full bg-success-50 px-2 py-1 text-xs font-semibold text-success-700">
        Cobrado
      </span>
    );
  if (item.status === "cancelled")
    return (
      <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-mid">
        Archivado
      </span>
    );
  if (item.days_overdue != null && item.days_overdue > 0)
    return (
      <span className="rounded-full bg-danger-50 px-2 py-1 text-xs font-semibold text-danger-700">
        Vencido · {item.days_overdue} d
      </span>
    );
  if (item.due_date === today)
    return (
      <span className="rounded-full bg-warning-50 px-2 py-1 text-xs font-semibold text-warning-700">
        Vence hoy
      </span>
    );
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-mid">
      {item.due_date_certainty === "confirmed" ? "Por cobrar" : "Desconocido"}
    </span>
  );
}

function Attribute({ label }: { label: string }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-neutral-mid">
      {label}
    </span>
  );
}

function CobrosSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl bg-neutral-100" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-xl bg-neutral-100" />
    </div>
  );
}
