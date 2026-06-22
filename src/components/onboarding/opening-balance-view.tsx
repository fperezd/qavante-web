"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { QavanteInlineError } from "@/components/qavante";
import { useSetOpeningBalance } from "@/lib/api/opening-balance";
import { formatClp } from "@/lib/formatters/clp";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 6 — Saldo de apertura. Punto de partida de la caja. Monto manual opcional
   (string-decimal CLP) a nivel tenant. FE-first (endpoint manual aún no existe).
   Si lo omites, podés cargarlo después. */

const NEXT = routeAfter("opening-balance");

export function OpeningBalanceView() {
  const router = useRouter();
  const save = useSetOpeningBalance();
  const [raw, setRaw] = React.useState("");

  // Solo dígitos (CLP entero); el preview formatea.
  const digits = raw.replace(/\D/g, "");
  const amount = digits ? Number(digits) : 0;

  function handleContinue() {
    if (!digits) {
      router.push(NEXT);
      return;
    }
    save.mutate({ balance: digits }, { onSuccess: () => router.push(NEXT) });
  }

  return (
    <OnboardingShell
      step="opening-balance"
      description="Registra el saldo de tus cuentas hoy. Es el punto de partida de tu caja; puedes ajustarlo después."
    >
      <div className="max-w-md space-y-5">
        <div className="space-y-1">
          <label htmlFor="ob-amount" className="text-sm font-medium text-neutral-dark">
            Saldo inicial (CLP)
          </label>
          <div className="relative">
            <Wallet
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-mid"
              aria-hidden="true"
            />
            <input
              id="ob-amount"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={digits}
              onChange={(e) => setRaw(e.target.value)}
              className="flex h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2 text-sm tabular-nums text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            />
          </div>
          <p className="text-xs text-neutral-mid">
            {digits
              ? formatClp(amount)
              : "Opcional — podés dejarlo en blanco y cargarlo más tarde."}
          </p>
        </div>

        {save.isError && <QavanteInlineError error={save.error} what="el saldo de apertura" />}

        <OnboardingStepActions
          continueType="button"
          continueLabel={digits ? "Guardar y continuar" : "Continuar"}
          continueLoading={save.isPending}
          onContinue={handleContinue}
          onSkip={() => router.push(NEXT)}
        />
      </div>
    </OnboardingShell>
  );
}
