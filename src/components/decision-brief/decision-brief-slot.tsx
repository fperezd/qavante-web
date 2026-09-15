"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { QavanteButton, QavanteCard } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { type CashDecisionBrief, useCashDecisionBrief } from "@/lib/api/cash-decision-brief";
import { DecisionBriefRenderer } from "./decision-brief-renderer";

export const DECISION_BRIEF_SURFACES = ["inicio", "caja", "bandeja", "pagar", "cobrar"] as const;

export type DecisionBriefSurface = (typeof DECISION_BRIEF_SURFACES)[number];

/** Valores publicados por el servidor que identifican un corte. No se derivan
 * de una ruta, ni se fabrican con datos de la UI: sólo se comparan para avisar
 * que una sincronización devolvió un contexto nuevo. */
export type DecisionBriefIdentity = Pick<CashDecisionBrief, "decision_id" | "context_hash">;

export function hasDecisionBriefContextChanged(
  previous: DecisionBriefIdentity | null,
  next: DecisionBriefIdentity | null,
): boolean {
  return Boolean(
    previous &&
    next &&
    (previous.decision_id !== next.decision_id || previous.context_hash !== next.context_hash),
  );
}

/** Un 404 significa que la lectura todavía no existe para este tenant/release;
 * cualquier otro error conserva una salida visible y reintentable, sin una
 * recomendación local de respaldo. */
export function decisionBriefFailureMode(error: unknown): "omit" | "retry" {
  return error instanceof ApiError && error.isNotFound() ? "omit" : "retry";
}

/** Reintento explícito heredado de #288: mientras la consulta sigue en vuelo el
 * botón queda inhabilitado y lo dice, para no disparar dos lecturas del mismo
 * corte ni sugerir que ya llegó una respuesta. */
export function decisionBriefRetryLabel(isFetching: boolean): string {
  return isFetching ? "Reintentando…" : "Reintentar";
}

/**
 * Slot único para las cinco superficies operativas. La consulta, el id, el
 * orden y los CTA pertenecen al servidor; `surface` sólo identifica dónde se
 * presentó el mismo envelope para pruebas y accesibilidad.
 */
export function DecisionBriefSlot({ surface }: { surface: DecisionBriefSurface }) {
  const query = useCashDecisionBrief();
  const initialIdentity = React.useRef<DecisionBriefIdentity | null>(null);
  const [hasUpdatedContext, setHasUpdatedContext] = React.useState(false);
  const decisionId = query.data?.decision_id;
  const contextHash = query.data?.context_hash;

  React.useEffect(() => {
    if (!decisionId || !contextHash) return;
    const identity = { decision_id: decisionId, context_hash: contextHash };
    if (initialIdentity.current === null) {
      initialIdentity.current = identity;
      return;
    }
    if (hasDecisionBriefContextChanged(initialIdentity.current, identity)) {
      initialIdentity.current = identity;
      setHasUpdatedContext(true);
    }
  }, [contextHash, decisionId]);

  if (query.isLoading) return <DecisionBriefSkeleton surface={surface} />;

  if (query.isError) {
    /* El endpoint puede no estar desplegado todavía. No sustituimos el brief con
       una decisión local ni con una invitación a clasificar movimientos. */
    if (decisionBriefFailureMode(query.error) === "omit") return null;
    return (
      <DecisionBriefError
        surface={surface}
        isRetrying={query.isFetching}
        onRetry={() => void query.refetch()}
      />
    );
  }

  if (!query.data) return null;

  return (
    <section data-decision-brief-surface={surface} aria-label="Decisión de caja">
      {hasUpdatedContext && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-warning-500/40 bg-warning-50 px-3 py-2 text-sm text-warning-700"
        >
          La evaluación se actualizó con información nueva. Revisa nuevamente las alternativas antes
          de continuar.
        </p>
      )}
      <DecisionBriefRenderer brief={query.data} />
    </section>
  );
}

function DecisionBriefError({
  surface,
  isRetrying,
  onRetry,
}: {
  surface: DecisionBriefSurface;
  isRetrying: boolean;
  onRetry: () => void;
}) {
  return (
    <QavanteCard variant="bordered" data-decision-brief-surface={surface} aria-live="polite">
      <p className="text-sm font-medium text-neutral-dark">
        No pudimos actualizar la decisión de caja.
      </p>
      <p className="mt-1 text-sm text-neutral-mid">
        No mostramos una recomendación anterior como si siguiera vigente.
      </p>
      <QavanteButton
        className="mt-3"
        size="sm"
        variant="secondary"
        loading={isRetrying}
        onClick={onRetry}
      >
        {!isRetrying && <RefreshCw className="h-4 w-4" aria-hidden="true" />}
        {decisionBriefRetryLabel(isRetrying)}
      </QavanteButton>
    </QavanteCard>
  );
}

function DecisionBriefSkeleton({ surface }: { surface: DecisionBriefSurface }) {
  return (
    <div
      data-decision-brief-surface={surface}
      className="h-48 animate-pulse rounded-xl bg-neutral-light/30"
      aria-busy="true"
      aria-label="Cargando la decisión de caja"
    />
  );
}
