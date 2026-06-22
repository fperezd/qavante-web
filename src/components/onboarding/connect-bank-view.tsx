"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 4 — Conectar banco. Trae los movimientos bancarios para clasificarlos y
   proyectar caja. Hoy la conexión BICE no tiene flujo web self-serve (auth por
   proceso del backend) → este paso es informativo + opcional. Cuando exista el
   contrato de conexión web, se cablea acá la acción real (FE-first). Gated. */

const NEXT = routeAfter("connect-bank");

const BENEFITS = [
  { Icon: RefreshCw, text: "Traemos tus movimientos automáticamente, sin cargar nada a mano." },
  { Icon: ShieldCheck, text: "Conexión de solo lectura: nunca movemos tu plata." },
];

export function ConnectBankView() {
  const router = useRouter();

  return (
    <OnboardingShell
      step="connect-bank"
      description="Conecta tu banco para traer tus movimientos y proyectar tu caja."
    >
      <div className="max-w-md space-y-5">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-muted p-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-primary-50">
            <Landmark className="h-7 w-7 text-brand-primary" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-neutral-dark">Banco BICE</p>
          <p className="text-sm text-neutral-mid">
            Vas a poder conectar tu cuenta para sincronizar movimientos. Si prefieres, puedes
            hacerlo más tarde desde Administración.
          </p>
        </div>

        <ul className="space-y-2">
          {BENEFITS.map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm text-neutral-dark">
              <Icon
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand-primary"
                aria-hidden="true"
              />
              {text}
            </li>
          ))}
        </ul>

        <OnboardingStepActions
          continueType="button"
          continueLabel="Conectar BICE"
          onContinue={() => router.push(NEXT)}
          onSkip={() => router.push(NEXT)}
        />
      </div>
    </OnboardingShell>
  );
}
