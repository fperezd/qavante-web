"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Landmark, PlugZap, Receipt } from "lucide-react";
import { QavanteButton, QavanteBadge, QavanteCard, QavanteInlineError } from "@/components/qavante";
import { SourceConsentCard } from "@/components/credenciales/source-consent-card";
import { LinkBankAccountsCard } from "@/components/treasury/link-bank-accounts-card";
import { useBiceCredentialStatus } from "@/lib/api/bank-credentials";
import { useSourceConsent } from "@/lib/api/source-consent";
import { BANK_SOURCE_CODE } from "@/lib/onboarding/connect-bank";
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
import { ONBOARDING_DONE_ROUTE, onboardingResumeRoute, routeForSource } from "./onboarding-steps";

/* Hub de conexiones — el PUNTO DE RETORNO del patrón "siempre wizard, con
   conexiones diferibles" (Fernando 2026-08-12). Acá el usuario ve, en un solo
   lugar, qué fuentes tiene conectadas y cuáles dejó para después, y retoma
   cualquiera de ellas sin re-registrarse ni pasar por todo el wizard.

   NO es un paso numerado: no muestra "Paso N de 7" (el usuario ya no está
   avanzando linealmente). Honestidad de estados: mientras no sabemos el estado
   real (cargando / el status falló) NO pintamos "sin conectar" como si fuera un
   hecho — se dice explícitamente que no pudimos leerlo, con reintentar. */

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

  function handleConnect(id: OnboardingSourceId) {
    // Retomar una conexión diferida = dejar de diferirla: si no, el guard la
    // seguiría tratando como resuelta y el hub mentiría sobre su estado.
    undeferSource(id);
    router.push(routeForSource(id));
  }

  const pendingCount = ONBOARDING_SOURCE_IDS.filter((id) => states[id] !== "connected").length;
  const bankConnected = states.bank === "connected";
  /* Banco con credencial guardada pero SIN autorización: es el caso que dejaba
     al usuario sin salida (el paso decía "vincúlala después desde Tus
     conexiones" y acá no había nada que hacer). La card de autorización es esa
     salida — la misma que usa Administración. */
  const bankCredential = useBiceCredentialStatus(!bankConnected);
  const bankConsent = useSourceConsent(BANK_SOURCE_CODE, !bankConnected);
  const faltaAutorizarBanco =
    !bankConnected &&
    bankCredential.data?.connected === true &&
    bankConsent.data?.is_valid === false;

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

        {/* Sin dato real NO listamos estados: un "sin conectar" inventado es tan
            engañoso como un cero inventado. */}
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
            Mientras una fuente no esté conectada, Qavante no muestra sus datos. No los inventamos
            ni los damos por cero.
          </p>
        )}

        {/* Autorización del banco pendiente: sin esto la fuente queda en error y
            el banco no sincroniza, por más que la credencial esté guardada. */}
        {faltaAutorizarBanco && (
          <SourceConsentCard
            sourceCode={BANK_SOURCE_CODE}
            label="Autorización de acceso al banco"
          />
        )}

        {/* Cuentas por vincular de BICE: solo tiene sentido con el banco conectado
            (contratos reales `GET/POST /api/bank-movements/bice/accounts…`). */}
        {bankConnected && <LinkBankAccountsCard />}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
          {/* Con el onboarding INCOMPLETO el panel rebota al wizard (el guard hace
              su trabajo), así que no prometemos "ir a mi panel": se ofrece seguir
              con el registro, que es lo que de verdad va a pasar. */}
          <QavanteButton
            variant="ghost"
            onClick={() =>
              router.push(completed ? ONBOARDING_DONE_ROUTE : onboardingResumeRoute(states))
            }
          >
            {completed ? "Volver a mi panel" : "Seguir con el registro"}
          </QavanteButton>
        </div>
      </div>
    </OnboardingShell>
  );
}
