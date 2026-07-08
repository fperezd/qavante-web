import * as React from "react";
import { QavanteCard } from "@/components/qavante";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { formatDateLike } from "@/lib/formatters/date";
import { computeObligationProgress, type ObligationInstallmentLike } from "./obligation-lifecycle";

/* Progreso macro del préstamo como Timeline: Originado → En curso (cuota X/N,
   próxima, vencidas) → Liquidado. Complementa la tabla densa con el "así vas"
   de un vistazo. Solo estados derivados de datos reales (helper puro). */
export function ObligationProgressCard({
  installments,
  installmentsTotal,
  originationDate,
  principalFormatted,
}: {
  installments: ReadonlyArray<ObligationInstallmentLike>;
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
            p.overdueCount > 0 ? ` · ${p.overdueCount} vencida${p.overdueCount > 1 ? "s" : ""}` : ""
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
