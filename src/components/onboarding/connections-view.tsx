"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Landmark, PlugZap, Receipt } from "lucide-react";
import { QavanteButton, QavanteBadge, QavanteCard, QavanteInlineError } from "@/components/qavante";
import { BancosConectadosPanel } from "@/components/banco/bancos-conectados-panel";
import {
  ONBOARDING_SOURCE_IDS,
  useOnboardingSources,
  type OnboardingSourceId,
  type OnboardingSourceState,
} from "@/lib/api/onboarding-sources";
import { undeferSource } from "@/lib/onboarding/deferred-sources";
import { OnboardingShell } from "./onboarding-shell";
import {
  ONBOARDING_SOURCE_META,
  SOURCE_STATE_BADGE,
  SOURCE_STATE_LABEL,
  sourceActionLabel,
  sourceStateDescription,
} from "./onboarding-source-meta";
import { useOnboardingImportWindow } from "@/lib/api/onboarding-import-window";
import { ONBOARDING_DONE_ROUTE, onboardingResumeRoute, routeForSource } from "./onboarding-steps";

const SOURCE_ICON: Record<OnboardingSourceId, typeof Landmark> = {
  sii: Receipt,
  bank: Landmark,
};

function SourceRow({
  id,
  state,
  onConnect,
}: {
  id: OnboardingSourceId;
  state: OnboardingSourceState;
  onConnect: (id: OnboardingSourceId) => void;
}) {
  const meta = ONBOARDING_SOURCE_META[id];
  const Icon = SOURCE_ICON[id];
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-4">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary-50">
          <Icon className="h-4 w-4 text-brand-primary" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-neutral-dark">
            {meta.label}
            <QavanteBadge variant={SOURCE_STATE_BADGE[state]}>
              {SOURCE_STATE_LABEL[state]}
            </QavanteBadge>
          </p>
          <p className="mt-0.5 text-xs text-neutral-mid">{sourceStateDescription(id, state)}</p>
        </div>
      </div>
      <QavanteButton
        size="sm"
        variant={state === "connected" ? "ghost" : "primary"}
        onClick={() => onConnect(id)}
      >
        {sourceActionLabel(state)}
      </QavanteButton>
    </li>
  );
}

export function ConnectionsView() {
  const router = useRouter();
  const { states, isUnknown, isLoading, isError, error, refetch, completed } =
    useOnboardingSources(true);
  const importWindow = useOnboardingImportWindow();
  const importStartSelected = importWindow.data?.selected_start_date != null;

  function handleConnect(id: OnboardingSourceId) {
    undeferSource(id);
    router.push(routeForSource(id));
  }

  const pendingCount = ONBOARDING_SOURCE_IDS.filter((id) => states[id] !== "connected").length;
  const bankConnected = states.bank === "connected";

  return (
    <OnboardingShell
      title="Tus conexiones"
      description="Conecta lo que dejaste para después. Puedes hacerlo cuando quieras: tu cuenta ya está creada y funcionando."
    >
      <div className="space-y-6">
        {isError && (
          <QavanteInlineError
            error={error}
            what="el estado de tus conexiones"
            onRetry={() => refetch()}
          />
        )}

        {isLoading && (
          <div className="space-y-2" aria-busy="true">
            {ONBOARDING_SOURCE_IDS.map((id) => (
              <div key={id} className="h-16 animate-pulse rounded-xl bg-neutral-light/30" />
            ))}
          </div>
        )}

        {!isUnknown && (
          <QavanteCard
            variant="bordered"
            header={
              <div className="flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-brand-primary" aria-hidden="true" />
                <span>Fuentes de datos</span>
              </div>
            }
          >
            <ul className="divide-y divide-border">
              {ONBOARDING_SOURCE_IDS.map((id) => (
                <SourceRow key={id} id={id} state={states[id]} onConnect={handleConnect} />
              ))}
            </ul>
          </QavanteCard>
        )}

        {!isUnknown && pendingCount === 0 && (
          <p className="flex items-center gap-2 text-sm text-success-700">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            Tienes todas tus fuentes conectadas.
          </p>
        )}

        {!isUnknown && pendingCount > 0 && (
          <p className="flex items-start gap-2 text-sm text-neutral-mid">
            <Clock className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            Mientras una fuente no esté conectada, sus datos no estarán disponibles en Qavante.
          </p>
        )}

        {bankConnected && <BancosConectadosPanel />}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
          <QavanteButton
            variant="ghost"
            onClick={() =>
              router.push(
                completed
                  ? ONBOARDING_DONE_ROUTE
                  : onboardingResumeRoute(states, { importStartSelected }),
              )
            }
          >
            {completed ? "Volver a mi panel" : "Seguir con el registro"}
          </QavanteButton>
        </div>
      </div>
    </OnboardingShell>
  );
}
