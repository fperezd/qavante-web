"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { QavanteBankConnectWidget } from "@/components/banco/qavante-bank-connect-widget";
import { useOnboardingSources } from "@/lib/api/onboarding-sources";
import { deferSource, undeferSource } from "@/lib/onboarding/deferred-sources";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";
import { useOnboardingBack } from "./use-onboarding-back";

const NEXT = routeAfter("connect-bank");

export function ConnectBankView() {
  const router = useRouter();
  const onBack = useOnboardingBack("connect-bank");
  const { states } = useOnboardingSources(true);
  const connected = states.bank === "connected";

  function handleDefer() {
    deferSource("bank");
    router.push(NEXT);
  }

  const description = connected
    ? "Tu banco quedó conectado. Traemos los movimientos en solo lectura."
    : "Elige tu banco en Fintoc. Qavante no pide ni guarda la clave de acceso.";

  return (
    <OnboardingShell step="connect-bank" description={description}>
      <div className="max-w-xl space-y-5">
        {connected ? (
          <>
            <div
              className="flex items-start gap-3 rounded-xl border border-success-500/30 bg-success-500/5 p-3 text-sm text-neutral-dark"
              role="status"
            >
              <CheckCircle2
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-success-600"
                aria-hidden="true"
              />
              <p>Banco conectado. Solo leemos tus movimientos; nunca movemos tu plata.</p>
            </div>
            <OnboardingStepActions
              continueType="button"
              continueLabel="Continuar"
              onContinue={() => router.push(NEXT)}
              onBack={onBack}
            />
          </>
        ) : (
          <>
            <QavanteBankConnectWidget
              variant="embedded"
              onConnected={() => {
                undeferSource("bank");
                router.push(NEXT);
              }}
            />
            <OnboardingStepActions
              hideContinue
              onSkip={handleDefer}
              skipLabel="Conectar después"
              onBack={onBack}
            />
          </>
        )}
      </div>
    </OnboardingShell>
  );
}
