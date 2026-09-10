"use client";

import * as React from "react";
import { QavanteInlineError } from "@/components/qavante";
import { useDashboardSummary } from "@/lib/api/dashboard";
import {
  collectionReadScopeFromFinancialScope,
  useCollectionEvaluation,
  useCollectionSituation,
  type CollectionReadQuery,
} from "@/lib/api/collection-decisions";
import {
  useLatestLiquidityEvaluation,
  useOperationPlanForDecision,
} from "@/lib/api/financial-decisions";
import { useCollectionDecisionPlan, usePaymentDecisionPlan } from "@/lib/api/decision-plans";
import { toFinancialDecisionReadScope, useFinancialScope } from "@/lib/api/financial-scope";
import {
  useFxEvaluations,
  useFxExposures,
  useInvestableSurplus,
  useLearningCandidates,
  useInvestmentEvaluations,
  useOutcomeValues,
  useSourceFreshness,
  type DecisionReadScope,
} from "@/lib/api/financial-decision-readers";
import { useMe } from "@/lib/api/users";
import { asUserRole } from "@/lib/auth/types";
import { useReversibleActions, useRevertReversibleAction } from "@/lib/api/reversible-actions";
import { actividadesAutomaticas } from "./activity-log-model";
import { cashGapProposals } from "./cash-gap-proposal-model";
import { HoyView } from "./hoy-view";

/* Cableado de V01 · Hoy. La vista es presentacional; acá se resuelven las dos fuentes:
 *
 *   · `GET /api/dashboard/summary` — caja, brecha, cobranza, resultado y las acciones
 *     prioritarias (mismo endpoint que el Inicio actual y que el hero de `/caja`, que es lo que
 *     sostiene la Ley 1: un concepto, un número);
 *   · `GET /api/me` — la razón social y el rol del tenant activo. El rol sólo gobierna la
 *     visibilidad del CTA F2; el POST de selección vuelve a autorizarlo en backend.
 *
 * `/api/me` NO bloquea la pantalla: si falla o tarda, el crumb dice "Tu empresa" y el resto se
 * pinta igual. El nombre de la empresa es contexto, no el dato de la vista. */

export function HoyLive() {
  const summary = useDashboardSummary();
  const liquidity = useLatestLiquidityEvaluation();
  /* No recalculan la caja: sólo se leen con el resumen ya disponible. Si fallan,
     Hoy conserva las acciones prioritarias del summary como fallback. */
  const paymentPlan = usePaymentDecisionPlan(summary.isSuccess);
  const collectionPlan = useCollectionDecisionPlan(summary.isSuccess);
  const operationPlan = useOperationPlanForDecision(liquidity.data?.decision_id ?? null);
  /* F6/F7/F9 use the persisted evaluation only for its server-owned cut-off. Entity and
     currency are resolved again by /api/core/financial-scope, which fails closed when the
     tenant has no single demonstrable financial scope. Neither tenant_id nor browser time is
     ever substituted here. */
  const canonicalScope = useFinancialScope(liquidity.data?.scope.as_of);
  const decisionReadScope: DecisionReadScope | null = toFinancialDecisionReadScope(
    canonicalScope.data,
  );
  const fxExposures = useFxExposures(decisionReadScope);
  const fxEvaluations = useFxEvaluations(decisionReadScope);
  const investableSurplus = useInvestableSurplus(decisionReadScope);
  const investmentEvaluations = useInvestmentEvaluations(decisionReadScope);
  const outcomeValues = useOutcomeValues(decisionReadScope);
  const learningCandidates = useLearningCandidates(decisionReadScope);
  const sourceFreshness = useSourceFreshness(decisionReadScope);
  const me = useMe();
  const role = asUserRole(me.data?.user?.role);
  /* F3's public reader requires legal_entity_id + currency + as_of. The canonical reader owns
     all three values, so this never substitutes `/api/me`'s tenant id, a browser currency or
     today's clock. An absent/ambiguous canonical scope keeps both F3 requests disabled. */
  const collectionScope: CollectionReadQuery | null =
    collectionReadScopeFromFinancialScope(decisionReadScope);
  const collectionSituation = useCollectionSituation(collectionScope);
  const collectionEvaluation = useCollectionEvaluation(collectionScope);
  /* Ley 5 / issue #65: la bitácora viene del reader que publica sólo automatismos de Qavante.
     `onlyUndoable` es un filtro de servidor; la vista todavía lee `undo_available` por fila. */
  const activity = useReversibleActions({ onlyUndoable: true, limit: 5 });
  const revertActivity = useRevertReversibleAction();

  if (summary.isLoading) return <CargandoHoy />;
  if (summary.isError) {
    return (
      <QavanteInlineError
        error={summary.error}
        what="tu parte del día"
        onRetry={() => summary.refetch()}
      />
    );
  }

  return (
    <HoyView
      data={summary.data ?? null}
      empresa={me.data?.user?.tenant_name ?? null}
      liquidityEvaluation={liquidity.data ?? null}
      liquidityLoading={liquidity.isLoading}
      liquidityFailed={liquidity.isError}
      cashGapProposals={cashGapProposals(paymentPlan.data, collectionPlan.data)}
      cashGapProposalsLoading={paymentPlan.isLoading || collectionPlan.isLoading}
      canSelectLiquidity={role === "owner" || role === "admin"}
      operationPlanRead={operationPlan.data ?? null}
      operationPlanLoading={operationPlan.isLoading}
      operationPlanError={operationPlan.error}
      onRetryOperationPlan={() => void operationPlan.refetch()}
      collectionSituation={collectionSituation.data ?? null}
      collectionEvaluation={collectionEvaluation.data ?? null}
      collectionLoading={collectionSituation.isLoading || collectionEvaluation.isLoading}
      collectionError={collectionSituation.error ?? collectionEvaluation.error}
      collectionScopeAvailable={collectionScope !== null}
      onRetryCollection={
        collectionScope
          ? () => {
              void collectionSituation.refetch();
              void collectionEvaluation.refetch();
            }
          : undefined
      }
      decisionReaders={
        decisionReadScope
          ? {
              fxExposures: {
                data: fxExposures.data,
                loading: fxExposures.isLoading,
                failed: fxExposures.isError,
              },
              fxEvaluations: {
                data: fxEvaluations.data,
                loading: fxEvaluations.isLoading,
                failed: fxEvaluations.isError,
              },
              investableSurplus: {
                data: investableSurplus.data,
                loading: investableSurplus.isLoading,
                failed: investableSurplus.isError,
              },
              investmentEvaluations: {
                data: investmentEvaluations.data,
                loading: investmentEvaluations.isLoading,
                failed: investmentEvaluations.isError,
              },
              outcomeValues: {
                data: outcomeValues.data,
                loading: outcomeValues.isLoading,
                failed: outcomeValues.isError,
              },
              learningCandidates: {
                data: learningCandidates.data,
                loading: learningCandidates.isLoading,
                failed: learningCandidates.isError,
              },
              sourceFreshness: {
                data: sourceFreshness.data,
                loading: sourceFreshness.isLoading,
                failed: sourceFreshness.isError,
              },
            }
          : null
      }
      activities={activity.isError ? null : actividadesAutomaticas(activity.data, 5)}
      activitiesLoading={activity.isLoading}
      activitiesError={activity.isError}
      onRetryActivities={() => void activity.refetch()}
      onUndoActivity={(actionId) => revertActivity.mutateAsync(actionId)}
    />
  );
}

/* §5.4 — un estado de carga habla: qué se está trayendo y cuánto tarda. "Cargando…" a secas es
   exactamente lo que el lint del rediseño persigue. */
function CargandoHoy() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-neutral-mid">
        Estamos armando tu parte del día con tu banco y tus documentos del SII (~5 s).
      </p>
      <div className="h-32 animate-pulse rounded-xl bg-neutral-light/30" aria-hidden="true" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
    </div>
  );
}
