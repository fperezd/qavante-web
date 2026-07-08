"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { QavanteCard, QavanteBadge, QavanteInlineError } from "@/components/qavante";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { useObligationDetail, type ObligationInstallmentDetail } from "@/lib/api/obligations";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { computeObligationProgress } from "./obligation-lifecycle";

/* Detalle de una obligación / préstamo: cabecera + calendario de cuotas. Montos
   string-decimal → CLP; fechas YYYY-MM-DD → DD-MM-AAAA. Gated por `obligations`. */

function clp(s: string): string {
  const n = Number(s);
  return Number.isFinite(n) ? formatClp(n) : s;
}

function cuotaBadge(status: string): {
  variant: "success" | "warning" | "danger" | "default";
  label: string;
} {
  switch (status) {
    case "paid":
    case "pagada":
      return { variant: "success", label: "Pagada" };
    case "overdue":
    case "vencida":
      return { variant: "danger", label: "Vencida" };
    case "pending":
    case "pendiente":
      return { variant: "warning", label: "Pendiente" };
    default:
      return { variant: "default", label: status };
  }
}

export function ObligacionDetailView({ id }: { id: string }) {
  const query = useObligationDetail(id);

  return (
    <div className="space-y-4">
      <Link
        href="/pagar/obligaciones"
        className="inline-flex items-center gap-1 text-sm text-brand-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a obligaciones
      </Link>

      {query.isLoading && (
        <div
          className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Cargando obligación"
        />
      )}

      {query.isError && <QavanteInlineError error={query.error} what="esta obligación" />}

      {query.data && (
        <>
          <QavanteCard
            variant="bordered"
            header={
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {query.data.obligation.counterparty || "Préstamo"}
                </span>
                {query.data.obligation.needs_review && (
                  <QavanteBadge variant="warning">Revisar</QavanteBadge>
                )}
              </div>
            }
          >
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
              <Field label="Capital">{clp(query.data.obligation.principal_total)}</Field>
              <Field label="Cuotas">{query.data.obligation.installments_total}</Field>
              <Field label="Tasa anual">
                {query.data.obligation.annual_rate
                  ? `${(Number(query.data.obligation.annual_rate) * 100).toFixed(1)}%`
                  : "—"}
              </Field>
              <Field label="Inicio">{formatDateLike(query.data.obligation.origination_date)}</Field>
            </dl>
          </QavanteCard>

          <ProgressCard
            installments={query.data.installments ?? []}
            installmentsTotal={Number(query.data.obligation.installments_total) || undefined}
            originationDate={query.data.obligation.origination_date}
            principalFormatted={clp(query.data.obligation.principal_total)}
          />

          <ScheduleTable installments={query.data.installments ?? []} />
        </>
      )}
    </div>
  );
}

/* Progreso macro del préstamo como Timeline: Originado → En curso (cuota X/N,
   próxima, vencidas) → Liquidado. Complementa la tabla densa con el "así vas"
   de un vistazo. Solo estados derivados de datos reales (helper puro). */
function ProgressCard({
  installments,
  installmentsTotal,
  originationDate,
  principalFormatted,
}: {
  installments: ObligationInstallmentDetail[];
  installmentsTotal?: number;
  originationDate: string;
  principalFormatted: string;
}) {
  if (installments.length === 0) return null;
  const p = computeObligationProgress(installments, installmentsTotal);

  const originado: TimelineStep = {
    status: "done",
    title: "Originado",
    children: `${formatDateLike(originationDate)} · Capital ${principalFormatted}`,
  };

  const steps: TimelineStep[] = p.settled
    ? [
        originado,
        {
          status: "done",
          title: "Liquidado",
          children: `${p.total} de ${p.total} cuotas pagadas${
            p.payoffDate ? ` · última venció el ${formatDateLike(p.payoffDate)}` : ""
          }`,
        },
      ]
    : [
        originado,
        {
          status: "current",
          title: "En curso",
          children: `${p.paidCount} de ${p.total} cuotas pagadas${
            p.nextDueDate ? ` · próxima vence el ${formatDateLike(p.nextDueDate)}` : ""
          }${
            p.overdueCount > 0
              ? ` · ${p.overdueCount} vencida${p.overdueCount > 1 ? "s" : ""}`
              : ""
          }`,
        },
        {
          status: "pending",
          title: "Liquidado",
          children: p.payoffDate
            ? `Término estimado: ${formatDateLike(p.payoffDate)}`
            : "Al pagar todas las cuotas.",
        },
      ];

  return (
    <QavanteCard
      variant="bordered"
      header={<span className="font-medium">Progreso del préstamo</span>}
    >
      <Timeline steps={steps} />
    </QavanteCard>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-mid">{label}</dt>
      <dd className="font-medium tabular-nums text-neutral-dark">{children}</dd>
    </div>
  );
}

function ScheduleTable({ installments }: { installments: ObligationInstallmentDetail[] }) {
  if (installments.length === 0) {
    return <p className="text-sm text-neutral-mid">Sin calendario disponible.</p>;
  }
  return (
    <QavanteCard
      variant="bordered"
      header={<span className="font-medium">Calendario de cuotas</span>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-neutral-mid">
              <th className="py-2 pr-2 font-medium">Cuota</th>
              <th className="py-2 pr-2 font-medium">Vencimiento</th>
              <th className="py-2 pr-2 text-right font-medium">Capital</th>
              <th className="py-2 pr-2 text-right font-medium">Interés</th>
              <th className="py-2 pr-2 text-right font-medium">Total</th>
              <th className="py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {installments.map((c) => {
              const badge = cuotaBadge(c.status);
              return (
                <tr key={c.number}>
                  <td className="py-2 pr-2 tabular-nums">{c.number}</td>
                  <td className="py-2 pr-2 tabular-nums">{formatDateLike(c.due_date)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{clp(c.principal_amount)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{clp(c.interest_amount)}</td>
                  <td className="py-2 pr-2 text-right font-medium tabular-nums">
                    {clp(c.total_amount)}
                  </td>
                  <td className="py-2">
                    <QavanteBadge variant={badge.variant}>{badge.label}</QavanteBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </QavanteCard>
  );
}
