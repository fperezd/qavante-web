import * as React from "react";
import { QavanteCard } from "@/components/qavante";
import { Timeline, type TimelineStep } from "@/components/ui/timeline";
import { concordar } from "@/lib/formatters/count";
import { formatDateLike } from "@/lib/formatters/date";
import { computeObligationProgress, type ObligationInstallmentLike } from "./obligation-lifecycle";

/** "2 de 6 cuotas pagadas" / "1 de 1 cuota pagada" — concuerda sobre el TOTAL (issue #94: un
 * préstamo de una sola cuota, ya pagada, es un caso real, no de laboratorio). */
function cuotasPagadasLabel(n: number, total: number): string {
  return `${n} de ${total} ${concordar(total, "cuota pagada", "cuotas pagadas")}`;
}

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
          children: `${cuotasPagadasLabel(p.total, p.total)}${
            p.payoffDate ? ` · última venció el ${formatDateLike(p.payoffDate)}` : ""
          }`,
        },
      ]
    : [
        originado,
        {
          status: "current",
          title: "En curso",
          children: `${cuotasPagadasLabel(p.paidCount, p.total)}${
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
