"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Landmark, RefreshCw, ShieldCheck } from "lucide-react";
import { QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { usePutBiceCredential } from "@/lib/api/bank-credentials";
import { isValidRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 4 — Conectar banco. Trae los movimientos bancarios para clasificarlos y
   proyectar caja. BICE se conecta por credenciales (RUT + clave de acceso) vía
   `PUT /api/credentials/bice` (solo lectura, cifradas). Paso OPCIONAL. Gated por
   `onboarding`. */

const NEXT = routeAfter("connect-bank");

const BENEFITS = [
  { Icon: RefreshCw, text: "Traemos tus movimientos automáticamente, sin cargar nada a mano." },
  { Icon: ShieldCheck, text: "Conexión de solo lectura: nunca movemos tu plata." },
];

export function ConnectBankView() {
  const router = useRouter();
  const save = usePutBiceCredential();
  const [rut, setRut] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const rutValid = isValidRut(rut);
  // `!isPending` corta el doble-submit (Enter repetido antes de que React deshabilite).
  const canSubmit = rutValid && password.length >= 4 && !save.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    save.mutate({ rut, password }, { onSuccess: () => router.push(NEXT) });
  }

  return (
    <OnboardingShell
      step="connect-bank"
      description="Conecta tu banco para traer tus movimientos y proyectar tu caja."
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-5">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-muted p-4">
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-brand-primary-50">
            <Landmark className="h-6 w-6 text-brand-primary" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium text-neutral-dark">Banco BICE</p>
            <p className="text-xs text-neutral-mid">
              Ingresa tus datos de acceso. Si prefieres, puedes hacerlo más tarde desde
              Administración.
            </p>
          </div>
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

        <div className="space-y-1">
          <label htmlFor="bice-rut" className="text-sm font-medium text-neutral-dark">
            RUT
          </label>
          <QavanteInput
            id="bice-rut"
            variant="rut"
            placeholder="76.123.456-7"
            value={rut}
            onValueChange={setRut}
            invalid={touched && !rutValid}
          />
          {touched && !rutValid && (
            <p className="text-xs text-danger-500" role="alert">
              Ingresa un RUT válido.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="bice-clave" className="text-sm font-medium text-neutral-dark">
            Clave de acceso al banco
          </label>
          <PasswordInput
            id="bice-clave"
            placeholder="Tu clave del banco"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={touched && password.length < 4}
          />
        </div>

        {save.isError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>
              {save.error instanceof ApiError
                ? apiErrorToUserMessage(save.error)
                : "No pudimos conectar el banco. Verifica tus datos e intenta de nuevo."}
            </p>
          </div>
        )}

        <OnboardingStepActions
          continueType="submit"
          continueLabel="Conectar y continuar"
          continueLoading={save.isPending}
          continueDisabled={!canSubmit}
          onSkip={() => router.push(NEXT)}
        />
      </form>
    </OnboardingShell>
  );
}
