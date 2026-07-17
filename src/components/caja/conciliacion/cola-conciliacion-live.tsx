"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import {
  useConfirmReconciliation,
  useConfirmReconciliationBatch,
  useReconciliationReview,
  useRejectReconciliation,
} from "@/lib/api/reconciliation";
import { ColaConciliacion } from "./cola-conciliacion";
import { mapCola, todosLosIds } from "./reconciliacion-cola-map";

/* Contenedor LIVE de la cola de conciliación, gated por `reconciliationReview` (OFF). Orquesta la
   cola (`review`) + las 3 mutaciones (confirm / reject / confirm-batch) y compone `ColaConciliacion`.
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en `reconciliacion-cola-map`
   (unit) y la interacción en la story presentacional. */

export function ColaConciliacionLive() {
  const review = useReconciliationReview();
  const confirmar = useConfirmReconciliation();
  const rechazar = useRejectReconciliation();
  const batch = useConfirmReconciliationBatch();

  // Ids con una mutación individual en curso → deshabilitan sus botones.
  const [enCurso, setEnCurso] = React.useState<ReadonlySet<string>>(new Set());
  const marcar = React.useCallback((id: string, activo: boolean) => {
    setEnCurso((prev) => {
      const next = new Set(prev);
      if (activo) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  if (review.isLoading) return <LiveSkeleton />;
  if (review.isError) {
    return (
      <QavanteInlineError
        error={review.error}
        what="la cola de conciliación"
        onRetry={() => review.refetch()}
      />
    );
  }

  const filas = mapCola(review.data);

  if (filas.length === 0) {
    return (
      <QavanteEmpty
        icon={CheckCircle2}
        title="No hay nada que revisar"
        description="Qavante concilió solo lo que pudo con certeza. Cuando aparezca un movimiento que calce con un documento pero sin seguridad, va a esperarte acá."
      />
    );
  }

  function onConfirmar(id: string) {
    marcar(id, true);
    confirmar.mutate(id, {
      onSuccess: () => toast.success("Conciliado."),
      onError: () => toast.error("No pudimos conciliar ese movimiento. Intentá de nuevo."),
      onSettled: () => marcar(id, false),
    });
  }

  function onRechazar(id: string) {
    marcar(id, true);
    rechazar.mutate(id, {
      onSuccess: () => toast.success("Descartado. El movimiento queda sin conciliar."),
      onError: () => toast.error("No pudimos descartar esa sugerencia. Intentá de nuevo."),
      onSettled: () => marcar(id, false),
    });
  }

  function onConciliarTodas() {
    const ids = todosLosIds(filas);
    batch.mutate(ids, {
      onSuccess: (res) => {
        if (res.failed > 0) {
          toast.warning(`Conciliamos ${res.confirmed}. Quedaron ${res.failed} para revisar.`);
        } else {
          toast.success(`Conciliamos ${res.confirmed}.`);
        }
      },
      onError: () => toast.error("No pudimos conciliar en lote. Intentá de nuevo."),
    });
  }

  return (
    <ColaConciliacion
      filas={filas}
      onConfirmar={onConfirmar}
      onRechazar={onRechazar}
      onConciliarTodas={onConciliarTodas}
      pendientes={enCurso}
      conciliandoTodas={batch.isPending}
    />
  );
}

function LiveSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-light/30" />
      ))}
      <span className="sr-only">Cargando la cola de conciliación…</span>
    </div>
  );
}
