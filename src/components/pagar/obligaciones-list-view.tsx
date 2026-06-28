"use client";

import Link from "next/link";
import { Landmark, ChevronRight } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useObligations, type ObligationListItem } from "@/lib/api/obligations";
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

export function ObligacionesListView() {
  const query = useObligations();

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
        title="Todavía no registraste obligaciones"
        description="Cuando registres un préstamo, vas a ver acá su capital, cuotas pendientes y el próximo vencimiento."
      />
    );
  }

  const outstanding = items.reduce((acc, o) => acc + (Number(o.outstanding_total) || 0), 0);
  const pending = items.reduce((acc, o) => acc + (o.pending_count || 0), 0);

  return (
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
