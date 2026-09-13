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
import { usePayrollWorkers } from "@/lib/api/payroll-workers";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";
import { ConciliacionBoardView } from "./conciliacion-board-view";
import {
  normalizeBoard,
  debitosCandidatos,
  buildReconcileBody,
  normalizeReconcileOutcome,
  normalizeReconcilePreview,
  payrollRutKey,
  periodToYyyymm,
  type PayrollReconcilePreview,
} from "./settlement-board-model";

/* Contenedor de la conciliación accionable (#835): trae el board (fuente de verdad del backend) +
   los débitos del banco del período, cablea las mutations (asignar con dry-run+apply, desasignar) y
   muestra la vista. El board es owner/admin → degrada honesto si 403. Selector de período lo pone el
   contenedor padre (RemuneracionesView) — acá sólo recibe `period` (YYYY-MM). */

function errMsg(e: unknown): string {
  if (e instanceof ApiError && e.status === 403)
    return "La conciliación de sueldos es visible sólo para el dueño o un administrador.";
  if (e instanceof ApiError && (e.status === 400 || e.status === 409))
    return "No pudimos validar la asignación. Revisa el movimiento y el monto.";
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
  const classificationsQuery = usePayrollWorkers(period ?? "", Boolean(period));
  const validateReconcile = usePayrollReconcile();
  const applyReconcile = usePayrollReconcile();
  const revert = usePayrollReconcileRevert();

  const [assigning, setAssigning] = React.useState(false);
  const [revertingId, setRevertingId] = React.useState<string | null>(null);

  const board = React.useMemo(() => normalizeBoard(boardQuery.data), [boardQuery.data]);
  const candidatos = React.useMemo(
    () => debitosCandidatos(bankQuery.data?.items ?? [], board),
    [bankQuery.data, board],
  );

  const onValidate = async (
    debitoId: string,
    workerRuts: string[],
  ): Promise<PayrollReconcilePreview> => {
    const debito = candidatos.find((c) => c.id === debitoId);
    if (!debito || !period) throw new Error("Selección incompleta");
    try {
      const raw = await validateReconcile.mutateAsync(
        buildReconcileBody(period, debito, workerRuts, true),
      );
      const preview = normalizeReconcilePreview(raw);
      if (!preview) throw new Error("La simulación del API no contiene evidencia verificable");
      const selectedRuts = new Set(workerRuts.map(payrollRutKey));
      if (
        preview.period !== periodToYyyymm(period) ||
        preview.amount !== debito.monto ||
        preview.applied.some((row) => !selectedRuts.has(payrollRutKey(row.workerRut)))
      ) {
        throw new Error("La simulación del API no corresponde a la selección vigente");
      }
      return preview;
    } catch (e) {
      toast.error("No se puede conciliar ese débito", { description: errMsg(e) });
      throw e;
    }
  };

  const onAssign = async (debitoId: string, workerRuts: string[]) => {
    const debito = candidatos.find((c) => c.id === debitoId);
    if (!debito || !period) return false;
    setAssigning(true);
    try {
      const raw = await applyReconcile.mutateAsync(
        buildReconcileBody(period, debito, workerRuts, false),
      );
      const outcome = normalizeReconcileOutcome(raw, false);
      if (!outcome) {
        toast.error("La conciliación respondió sin evidencia verificable", {
          description: "Revisa el estado actualizado antes de volver a intentar.",
        });
        return true;
      }
      toast.success(
        workerRuts.length === 1 ? "Sueldo conciliado" : `${workerRuts.length} sueldos conciliados`,
        {
          description: `Monto conciliado: ${outcome.appliedTotal}. Revisa el estado actualizado antes de continuar.`,
        },
      );
      return true;
    } catch (e) {
      toast.error("No se pudo conciliar", { description: errMsg(e) });
      return false;
    } finally {
      setAssigning(false);
    }
  };

  const onRevert = (linkId: string) => {
    setRevertingId(linkId);
    revert.mutate(
      { link_id: linkId },
      {
        onSuccess: (raw) => {
          const result = raw as { reverted?: unknown } | null;
          if (result?.reverted !== true) {
            toast.error("No se confirmó la desasignación", {
              description:
                "No recibimos confirmación del cambio. Revisa el estado antes de reintentar.",
            });
            setRevertingId(null);
            return;
          }
          toast.success("Asignación retirada", { description: "La conciliación se actualizó." });
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
          description="Elige un mes para revisar qué movimientos bancarios pueden conciliarse con cada trabajador."
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
          classifications={classificationsQuery.data?.workers ?? []}
          classificationsState={
            classificationsQuery.isLoading
              ? "loading"
              : classificationsQuery.error
                ? "error"
                : "ready"
          }
          onValidate={onValidate}
          onAssign={onAssign}
          onRevert={onRevert}
          assignPending={assigning}
          revertPendingId={revertingId}
        />
      )}
    </div>
  );
}
