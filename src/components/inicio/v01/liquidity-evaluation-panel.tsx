"use client";

import * as React from "react";
import { CheckCircle2, Clock, HelpCircle, ShieldCheck } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import type { DecisionSelectionResponse, LiquidityEvaluation } from "@/lib/api/financial-decisions";
import { cn } from "@/lib/utils";
import { liquidityEvaluationView } from "./liquidity-evaluation-model";
import { LiquiditySelectionDialog } from "./liquidity-selection-dialog";
import { selectionSuccessMessage } from "./liquidity-selection-model";

export interface LiquidityEvaluationPanelProps {
  evaluation: LiquidityEvaluation | null;
  loading?: boolean;
  failed?: boolean;
  now?: Date;
  /** Ayuda visual; el backend vuelve a autorizar owner/admin al registrar la selección. */
  canSelect?: boolean;
}

export function LiquidityEvaluationPanel({
  evaluation,
  loading = false,
  failed = false,
  now,
  canSelect = false,
}: LiquidityEvaluationPanelProps) {
  const confirmationRef = React.useRef<HTMLDivElement>(null);
  const [selectionResult, setSelectionResult] = React.useState<DecisionSelectionResponse | null>(
    null,
  );
  const currentSelection =
    selectionResult?.decision_id === evaluation?.decision_id ? selectionResult : null;
  React.useEffect(() => {
    if (currentSelection) confirmationRef.current?.focus();
  }, [currentSelection]);
  if (loading) {
    return (
      <section aria-label="Evaluación de liquidez" className="space-y-2">
        <p className="text-sm text-neutral-mid">Buscando una evaluación financiera vigente…</p>
        <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" aria-hidden="true" />
      </section>
    );
  }

  if (failed) {
    return (
      <QavanteCard variant="bordered">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning-700" aria-hidden="true" />
          <div>
            <p className="font-semibold text-neutral-dark">
              No pudimos leer la evaluación financiera
            </p>
            <p className="mt-1 text-sm text-neutral-mid">
              Tu resumen diario sigue disponible, pero no mostraremos alternativas hasta recuperar
              el snapshot persistido.
            </p>
          </div>
        </div>
      </QavanteCard>
    );
  }

  if (!evaluation) {
    return (
      <QavanteCard variant="bordered">
        <div className="flex items-start gap-3">
          <HelpCircle className="mt-0.5 h-5 w-5 shrink-0 text-neutral-mid" aria-hidden="true" />
          <div>
            <p className="font-semibold text-neutral-dark">
              Aún no hay una evaluación de liquidez persistida
            </p>
            <p className="mt-1 text-sm text-neutral-mid">
              Cuando Qavante detecte una brecha con evidencia suficiente, aquí comparará no
              financiar, línea y factoring sin asumir tasas ni costos faltantes.
            </p>
          </div>
        </div>
      </QavanteCard>
    );
  }

  const view = liquidityEvaluationView(evaluation, now);
  const usable = view.decisionSupport === "eligible" && view.status === "evaluated" && view.valid;

  return (
    <section aria-labelledby="liquidity-evaluation-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Decisión de liquidez
          </p>
          <h3
            id="liquidity-evaluation-title"
            className="mt-1 text-lg font-semibold text-neutral-dark"
          >
            {usable ? "Alternativas para proteger tu caja" : "Evaluación sin recomendación vigente"}
          </h3>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            usable ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700",
          )}
        >
          {usable ? <ShieldCheck className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          {view.validityLabel}
        </span>
      </div>

      {currentSelection && (
        <QavanteCard variant="bordered" className="border-success-500/40 bg-success-50">
          <div
            ref={confirmationRef}
            role="status"
            aria-live="polite"
            tabIndex={-1}
            className="flex items-start gap-3 outline-none focus-visible:ring-2 focus-visible:ring-success-500"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-700" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-semibold text-success-700">
                {selectionSuccessMessage(currentSelection)}
              </p>
              <p className="mt-1 break-all text-xs text-neutral-mid">
                Selección: {currentSelection.selection_id}
                {currentSelection.operation_plan_id
                  ? ` · OperationPlan: ${currentSelection.operation_plan_id} · estado ${currentSelection.operation_status ?? "sin estado"}`
                  : " · sin OperationPlan"}
              </p>
            </div>
          </div>
        </QavanteCard>
      )}

      {view.decisionSupport === "abstain" ? (
        <QavanteCard variant="bordered">
          <p className="font-semibold text-neutral-dark">Qavante se abstuvo de recomendar</p>
          <p className="mt-1 text-sm text-neutral-mid">
            La evidencia disponible no permite comparar alternativas de manera responsable. No se
            asumieron tasas, costos ni montos faltantes.
          </p>
        </QavanteCard>
      ) : (
        <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Metric label="Brecha detectada" value={view.gapLabel} />
            <Metric label="Caja mínima sin actuar" value={view.minimumCashLabel} />
            <Metric label="Recuperación proyectada" value={view.recoveryLabel} />
          </dl>

          <div className="space-y-2">
            {view.alternatives.map((alternative) => (
              <QavanteCard
                key={alternative.id}
                variant="bordered"
                className={cn(
                  alternative.recommended && usable && "border-brand-primary/40 bg-brand-primary/5",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-neutral-dark">
                        {alternative.position != null ? `${alternative.position}. ` : ""}
                        {alternative.title}
                      </p>
                      {alternative.recommended && usable && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-primary">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          Mejor alternativa evaluada
                        </span>
                      )}
                      {alternative.rejected && (
                        <span className="rounded-full bg-neutral-light px-2 py-0.5 text-[11px] font-semibold text-neutral-mid">
                          No evaluable
                        </span>
                      )}
                    </div>
                    {alternative.explanation && (
                      <p className="mt-1 text-sm text-neutral-mid">{alternative.explanation}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-neutral-dark">
                      {alternative.costLabel}
                    </p>
                    {alternative.evidenceLabel && (
                      <p className="mt-0.5 text-xs text-neutral-mid">{alternative.evidenceLabel}</p>
                    )}
                    {canSelect && usable && alternative.selectable && !currentSelection && (
                      <div className="mt-3">
                        <LiquiditySelectionDialog
                          decisionId={evaluation.decision_id}
                          alternativeId={alternative.id}
                          alternativeTitle={alternative.title}
                          isNoAction={alternative.isNoAction}
                          onSelected={setSelectionResult}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </QavanteCard>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-neutral-mid">
        Datos al {view.asOfLabel} · horizonte {view.horizonLabel} · modelo{" "}
        {evaluation.model_version}.
        {usable
          ? " Esta vista no ejecuta operaciones financieras."
          : " Snapshot histórico o sin vigencia verificable: no usar para decidir."}
      </p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string | null }) {
  return (
    <QavanteCard variant="bordered" className="h-full">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
        {label}
      </dt>
      <dd className="mt-1.5 text-lg font-bold tabular-nums text-neutral-dark">
        {value ?? "Sin dato verificable"}
      </dd>
    </QavanteCard>
  );
}
