"use client";

import * as React from "react";
import { toast } from "sonner";
import { Landmark, HelpCircle } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useBankMovements } from "@/lib/api/treasury";
import {
  usePayrollSettlementBoard,
  usePayrollReconcile,
  usePayrollReconcileRevert,
} from "@/lib/api/payroll-settlements";
import { ApiError } from "@/lib/api/errors";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { ConciliacionBoardView } from "./conciliacion-board-view";
import {
  normalizeBoard,
  debitosCandidatos,
  buildReconcileBody,
  periodToYyyymm,
} from "./settlement-board-model";

/* Contenedor de la conciliación accionable (#835): trae el board (fuente de verdad del backend) +
   los débitos del banco del período, cablea las mutations (asignar con dry-run+apply, desasignar) y
   muestra la vista. El board es owner/admin → degrada honesto si 403. Selector de período lo pone el
   contenedor padre (RemuneracionesView) — acá sólo recibe `period` (YYYY-MM). */

function errMsg(e: unknown): string {
  if (e instanceof ApiError && e.status === 403)
    return "La conciliación de sueldos es visible sólo para el dueño o un administrador.";
  if (e instanceof ApiError && (e.status === 400 || e.status === 409))
    return "El backend rechazó la asignación (revisa el débito y el monto).";
  return "Intenta de nuevo en un momento.";
}

export function ConciliacionBoardLive({
  period,
  periodForm,
}: {
  period: string | null;
  periodForm?: React.ReactNode;
}) {
  const yyyymm = period ? periodToYyyymm(period) : "";
  const boardQuery = usePayrollSettlementBoard(yyyymm, Boolean(period));
  const bankQuery = useBankMovements({ period: period ?? "" });
  const reconcile = usePayrollReconcile();
  const revert = usePayrollReconcileRevert();

  const [assigning, setAssigning] = React.useState(false);
  const [revertingId, setRevertingId] = React.useState<string | null>(null);

  const board = React.useMemo(() => normalizeBoard(boardQuery.data), [boardQuery.data]);
  const candidatos = React.useMemo(
    () => debitosCandidatos(bankQuery.data?.items ?? [], board),
    [bankQuery.data, board],
  );

  const onAssign = (debitoId: string, workerRuts: string[]) => {
    const debito = candidatos.find((c) => c.id === debitoId);
    if (!debito || !period) return;
    setAssigning(true);
    // 1) dry-run: valida sin mutar (el backend rechaza montos/movimientos inválidos).
    reconcile.mutate(buildReconcileBody(period, debito, workerRuts, true), {
      onSuccess: () => {
        // 2) apply: recién ahora muta e invalida el board + la cartola.
        reconcile.mutate(buildReconcileBody(period, debito, workerRuts, false), {
          onSuccess: () => {
            toast.success(
              workerRuts.length === 1
                ? "Sueldo conciliado"
                : `${workerRuts.length} sueldos conciliados`,
            );
            setAssigning(false);
          },
          onError: (e) => {
            toast.error("No se pudo conciliar", { description: errMsg(e) });
            setAssigning(false);
          },
        });
      },
      onError: (e) => {
        toast.error("No se puede conciliar ese débito", { description: errMsg(e) });
        setAssigning(false);
      },
    });
  };

  const onRevert = (linkId: string) => {
    setRevertingId(linkId);
    revert.mutate(
      { link_id: linkId },
      {
        onSuccess: () => {
          toast.success("Match desasignado");
          setRevertingId(null);
        },
        onError: (e) => {
          toast.error("No se pudo desasignar", { description: errMsg(e) });
          setRevertingId(null);
        },
      },
    );
  };

  const forbidden = boardQuery.error instanceof ApiError && boardQuery.error.status === 403;

  return (
    <div className="space-y-4">
      {periodForm}

      {!period && (
        <QavanteEmpty
          icon={Landmark}
          title="Concilia los sueldos del período"
          description="Elige un mes: vas a cruzar cada trabajador contra los débitos de la cartola y marcar qué está pagado."
        />
      )}

      {period && boardQuery.isLoading && (
        <div
          className="h-40 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Cargando conciliación"
        />
      )}

      {period && !boardQuery.isLoading && forbidden && (
        <QavanteEmpty
          icon={HelpCircle}
          title="Conciliación solo para el dueño"
          description="La conciliación de sueldos por trabajador es visible sólo para el dueño de la cuenta o un administrador."
        />
      )}

      {period && !boardQuery.isLoading && !forbidden && boardQuery.error != null && (
        <QavanteInlineError error={boardQuery.error} what="la conciliación de sueldos" />
      )}

      {period && !boardQuery.isLoading && !forbidden && boardQuery.error == null && (
        <ConciliacionBoardView
          periodLabel={formatPeriodLabel(period)}
          board={board}
          candidatos={candidatos}
          onAssign={onAssign}
          onRevert={onRevert}
          assignPending={assigning}
          revertPendingId={revertingId}
        />
      )}
    </div>
  );
}
