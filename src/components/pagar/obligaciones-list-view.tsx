"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Landmark, ChevronRight, Plus, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  QavanteCard,
  QavanteBadge,
  QavanteButton,
  QavanteEmpty,
  QavanteInlineError,
} from "@/components/qavante";
import {
  useObligations,
  useReconcileObligations,
  type ObligationListItem,
} from "@/lib/api/obligations";
import { concordar } from "@/lib/formatters/count";
import { formatMoney, formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

/* Obligaciones con entidades financieras (Pagar). Van SEPARADAS por categoría
   —Créditos, Compras en cuotas, Leasing, en ese orden fijo— porque antes caían todas
   revueltas en una sola lista y no se distinguía un crédito bancario de una compra a
   plazo (pedido de Fernando 2026-09-18). Cada categoría es una tarjeta destacada
   (filo azul arriba + sombra) y cada fila enlaza a su detalle (calendario de cuotas).
   Montos string-decimal, cada uno en SU moneda; fechas YYYY-MM-DD → DD-MM-AAAA (formatDateLike,
   convención Qavante). Gated por `obligations`. */

/* Los montos se pintan en SU moneda. Pintarlos todos como peso venía de cuando el alta
   sólo permitía CLP; desde que se puede registrar en UF o dólar, eso mezcla unidades en la
   misma columna y en el mismo total. */
const money = (raw: string, currency: string | null | undefined) =>
  formatMoneyFromDecimalString(raw, currency) ?? raw;

/** Saldos POR MONEDA: sumar unidades distintas no da un número, da un invento. */
function saldoTexto(items: ReadonlyArray<ObligationListItem>) {
  const porMoneda = new Map<string, number>();
  for (const o of items) {
    const code = o.currency_code || "CLP";
    porMoneda.set(code, (porMoneda.get(code) ?? 0) + (Number(o.outstanding_total) || 0));
  }
  return [...porMoneda.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, total]) => formatMoney(total, code))
    .join(" · ");
}

/* Las categorías de la pantalla, en orden de despliegue. Los demás tipos de
   `treasury.obligations` NO se listan acá y siguen viviendo donde ya vivían:
   `card_charge` (intereses rotativos, mora, impuesto DL 3475) es gasto financiero del
   mes y no una deuda en cuotas; `other` no es deuda con una entidad financiera.
   Consecuencia buscada: los totales del encabezado suman SOLO lo que se lista. */
const CATEGORIES: ReadonlyArray<{ type: string; label: string; hint: string }> = [
  { type: "loan", label: "Créditos", hint: "Créditos con bancos e instituciones financieras" },
  {
    type: "card_purchase",
    label: "Compras en cuotas",
    hint: "Compras a plazo con la tarjeta (SII, TGR, proveedores)",
  },
  { type: "leasing", label: "Leasing", hint: "Bienes en leasing con su calendario de cuotas" },
];

/** Estado canónico → variante de badge + label legible. */
function statusBadge(status: string): {
  variant: "success" | "warning" | "danger" | "info" | "default";
  label: string;
} {
  switch (status) {
    case "paid":
    case "settled":
    case "pagada":
      return { variant: "success", label: "Pagada" };
    case "overdue":
    case "vencida":
      return { variant: "danger", label: "Vencida" };
    case "pending":
    case "pendiente":
      return { variant: "warning", label: "Pendiente" };
    case "active":
    case "vigente":
      return { variant: "info", label: "Vigente" };
    default:
      return { variant: "default", label: status };
  }
}

const NUEVO_HREF = "/pagar/obligaciones/nuevo";

const sumPending = (items: ReadonlyArray<ObligationListItem>) =>
  items.reduce((acc, o) => acc + (o.pending_count || 0), 0);

export function ObligacionesListView() {
  const router = useRouter();
  const query = useObligations();
  const reconcile = useReconcileObligations();

  if (query.isLoading) {
    return (
      <div
        className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
        aria-busy="true"
        aria-label="Cargando obligaciones"
      />
    );
  }

  if (query.isError) {
    return <QavanteInlineError error={query.error} what="tus obligaciones" />;
  }

  const items = query.data?.items ?? [];
  /* Agrupa respetando el orden de CATEGORIES. Una categoría sin nada no se pinta: una
     tarjeta "Leasing" en cero no le dice nada al dueño. */
  const sections = CATEGORIES.map((c) => ({
    ...c,
    items: items.filter((o) => o.type === c.type),
  })).filter((s) => s.items.length > 0);
  const listed = sections.flatMap((s) => s.items);

  if (listed.length === 0) {
    return (
      <QavanteEmpty
        icon={Landmark}
        title="Todavía no hay créditos, compras en cuotas ni leasing"
        description="Acá vas a ver tus obligaciones con entidades financieras: los créditos que registres, las compras a plazo con la tarjeta (SII, TGR, proveedores) y los leasing, con sus cuotas pendientes y próximos vencimientos."
        cta={
          <QavanteButton size="sm" onClick={() => router.push(NUEVO_HREF)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Registrar crédito
          </QavanteButton>
        }
      />
    );
  }

  const totalPending = sumPending(listed);

  return (
    <div className="space-y-4">
      {reconcile.isSuccess && (
        <div className="flex items-start gap-2 rounded-lg border border-success-500/40 bg-success-500/10 p-2.5 text-sm text-success-700">
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>
            {reconcile.data.reconciled === 0
              ? "No había cuotas nuevas para conciliar."
              : `Conciliamos ${reconcile.data.reconciled} ${reconcile.data.reconciled === 1 ? "cuota" : "cuotas"} contra tus débitos bancarios.`}
          </p>
        </div>
      )}
      {reconcile.isError && <QavanteInlineError error={reconcile.error} what="la conciliación" />}

      {/* Resumen de TODO lo listado + acciones de la pantalla. Deliberadamente plano
          (sin sombra ni filo) para que destaquen las tarjetas de categoría. */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-muted/60 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium text-neutral-dark">
            {listed.length} {concordar(listed.length, "obligación", "obligaciones")}
          </span>
          <QavanteBadge variant="info">
            {totalPending} {concordar(totalPending, "cuota pendiente", "cuotas pendientes")}
          </QavanteBadge>
          <span className="text-neutral-mid">
            Saldo total:{" "}
            <span className="font-semibold text-neutral-dark tabular-nums">
              {saldoTexto(listed)}
            </span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <QavanteButton
            size="sm"
            variant="secondary"
            loading={reconcile.isPending}
            onClick={() => reconcile.mutate()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Conciliar cuotas
          </QavanteButton>
          <QavanteButton size="sm" onClick={() => router.push(NUEVO_HREF)}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Nuevo crédito
          </QavanteButton>
        </div>
      </div>

      {sections.map((s) => (
        <CategorySection key={s.type} label={s.label} hint={s.hint} items={s.items} />
      ))}

      {/* Lo que queda fuera de las tres categorías no se lista acá, pero tampoco se esconde:
          antes de separar por categoría, estos tipos sí aparecían en la lista plana. */}
      {items.length > listed.length && (
        <p className="px-1 text-xs text-neutral-mid">
          {items.length - listed.length}{" "}
          {concordar(items.length - listed.length, "obligación", "obligaciones")} de otro tipo
          (cargos de la tarjeta y otras) no se{" "}
          {items.length - listed.length === 1 ? "lista" : "listan"} en esta pantalla: los cargos
          financieros se ven en el resultado del mes.
        </p>
      )}
    </div>
  );
}

/* Una categoría = una tarjeta destacada: filo azul de marca arriba + sombra que sube
   al pasar el mouse. El saldo de la categoría va grande a la derecha del título. */
function CategorySection({
  label,
  hint,
  items,
}: {
  label: string;
  hint: string;
  items: ReadonlyArray<ObligationListItem>;
}) {
  const pending = sumPending(items);
  return (
    <QavanteCard
      variant="elevated"
      className="overflow-hidden border-t-4 border-brand-primary hover:shadow-xl"
      header={
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-neutral-dark">{label}</h2>
            <p className="mt-0.5 text-xs font-normal text-neutral-mid">
              {hint} · {items.length} {concordar(items.length, "obligación", "obligaciones")} ·{" "}
              {pending} {concordar(pending, "cuota pendiente", "cuotas pendientes")}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-normal text-neutral-mid">Saldo</p>
            <p className="text-xl font-bold text-neutral-dark tabular-nums">{saldoTexto(items)}</p>
          </div>
        </div>
      }
    >
      <ul className="divide-y divide-border">
        {items.map((o) => (
          <ObligationRow key={o.id} obligation={o} />
        ))}
      </ul>
    </QavanteCard>
  );
}

function ObligationRow({ obligation: o }: { obligation: ObligationListItem }) {
  const badge = statusBadge(o.status);
  return (
    <li>
      <Link
        href={`/pagar/obligaciones/${o.id}`}
        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-brand-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-neutral-dark">
              {o.counterparty || "Obligación"}
            </span>
            <QavanteBadge variant={badge.variant}>{badge.label}</QavanteBadge>
            {o.needs_review && <QavanteBadge variant="warning">Revisar</QavanteBadge>}
          </div>
          <p className="mt-0.5 text-xs text-neutral-mid">
            {/* Sin prefijo de tipo: la tarjeta que contiene la fila ya dice la categoría
                (y una compra a plazo nunca debe leerse como "préstamo"). */}
            {o.pending_count}/{o.installments_total}{" "}
            {concordar(o.pending_count, "cuota pendiente", "cuotas pendientes")}
            {o.next_due_date && <> · próximo {formatDateLike(o.next_due_date)}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium tabular-nums text-neutral-dark">
            {money(o.outstanding_total, o.currency_code)}
          </p>
          <p className="text-xs text-neutral-mid">de {money(o.principal_total, o.currency_code)}</p>
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-neutral-mid" aria-hidden="true" />
      </Link>
    </li>
  );
}
