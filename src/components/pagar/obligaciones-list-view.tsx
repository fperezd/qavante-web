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
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";

/* Lista de obligaciones / préstamos del tenant (Pagar). Cada fila enlaza al
   detalle (calendario de cuotas). Montos string-decimal → formatClp; fechas
   YYYY-MM-DD → DD-MM-AAAA (formatDateLike, convención Qavante). Gated por
   `obligations`. */

function clp(decimalString: string): string {
  const n = Number(decimalString);
  return Number.isFinite(n) ? formatClp(n) : decimalString;
}

const TYPE_LABEL: Record<string, string> = {
  loan: "Préstamo",
  prestamo: "Préstamo",
  // La mayoría de las "obligaciones" NO son préstamos: son COMPRAS A PLAZO con la tarjeta (SII/TGR/
  // proveedores financiados en cuotas). El backend las tipa `card_purchase`; antes caían al string
  // crudo y se leían como préstamo (pedido de Fernando 2026-08-05).
  card_purchase: "Compra a plazo",
};

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

  if (items.length === 0) {
    return (
      <QavanteEmpty
        icon={Landmark}
        title="Todavía no hay compras a plazo ni préstamos"
        description="Acá vas a ver tus compras a plazo con la tarjeta (SII, TGR, proveedores) y los préstamos que registres, con sus cuotas pendientes y próximos vencimientos."
        cta={
          <QavanteButton size="sm" onClick={() => router.push(NUEVO_HREF)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Registrar préstamo
          </QavanteButton>
        }
      />
    );
  }

  const outstanding = items.reduce((acc, o) => acc + (Number(o.outstanding_total) || 0), 0);
  const pending = items.reduce((acc, o) => acc + (o.pending_count || 0), 0);

  return (
    <div className="space-y-3">
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

      <QavanteCard
        variant="bordered"
        header={
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              {items.length} {items.length === 1 ? "obligación" : "obligaciones"}
            </span>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <QavanteBadge variant="info">{pending} cuotas pendientes</QavanteBadge>
              <span className="text-neutral-mid">
                Saldo:{" "}
                <span className="font-medium text-neutral-dark tabular-nums">
                  {formatClp(outstanding)}
                </span>
              </span>
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
                Nuevo préstamo
              </QavanteButton>
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
    </div>
  );
}

function ObligationRow({ obligation: o }: { obligation: ObligationListItem }) {
  const badge = statusBadge(o.status);
  return (
    <li>
      <Link
        href={`/pagar/obligaciones/${o.id}`}
        className="flex items-center gap-3 py-3 transition-colors hover:bg-brand-primary-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-neutral-dark">
              {o.counterparty || TYPE_LABEL[o.type] || "Obligación"}
            </span>
            <QavanteBadge variant={badge.variant}>{badge.label}</QavanteBadge>
            {o.needs_review && <QavanteBadge variant="warning">Revisar</QavanteBadge>}
          </div>
          <p className="mt-0.5 text-xs text-neutral-mid">
            {TYPE_LABEL[o.type] || o.type} · {o.pending_count}/{o.installments_total} cuotas
            pendientes
            {o.next_due_date && <> · próximo {formatDateLike(o.next_due_date)}</>}
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium tabular-nums text-neutral-dark">{clp(o.outstanding_total)}</p>
          <p className="text-xs text-neutral-mid">de {clp(o.principal_total)}</p>
        </div>
        <ChevronRight className="h-4 w-4 flex-shrink-0 text-neutral-mid" aria-hidden="true" />
      </Link>
    </li>
  );
}
