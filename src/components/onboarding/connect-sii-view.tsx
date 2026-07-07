"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { QavanteInput } from "@/components/qavante";
import { PasswordInput } from "@/components/credenciales/password-input";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { usePutSiiCredential } from "@/lib/api/credentials";
import { isValidRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { routeAfter } from "./onboarding-steps";

/* Paso 3 — Conectar SII. Guarda la clave tributaria (RUT + clave) para traer
   documentos del SII. Reusa el data layer de credenciales (`usePutSiiCredential`,
   `/api/admin/sources/sii_rcv/credential`). Paso OPCIONAL (se puede omitir).
   ⚠️ Esos endpoints son api-key-only en prod (gap escalado a CC-API) — el wizard
   está gated `onboarding` OFF hasta que acepten cookie. */

const NEXT = routeAfter("connect-sii");

export function ConnectSiiView() {
  const router = useRouter();
  const save = usePutSiiCredential();
  const [rut, setRut] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [touched, setTouched] = React.useState(false);

  const rutValid = isValidRut(rut);
  // `>= 4` alinea con el dialog de Credenciales (misma clave SII); `!isPending`
  // corta el doble-submit (Enter repetido antes de que React deshabilite).
  const canSubmit = rutValid && password.length >= 4 && !save.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    save.mutate({ rut, password }, { onSuccess: () => router.push(NEXT) });
  }

  return (
    <OnboardingShell
      step="connect-sii"
      description="Conecta el SII con tu clave tributaria para traer tus facturas, boletas e impuestos automáticamente."
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-info-500/30 bg-info-500/5 p-3 text-sm text-neutral-dark">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-info-600" aria-hidden="true" />
          <p>
            Usa el RUT y la clave tributaria del <strong>representante legal</strong> (con los que
            ingresa al SII). Se guardan cifrados y solo se usan para consultar tus datos.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="sii-rut" className="text-sm font-medium text-neutral-dark">
            RUT del representante legal
          </label>
          <QavanteInput
            id="sii-rut"
            variant="rut"
            placeholder="12.345.678-5"
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
          <label htmlFor="sii-clave" className="text-sm font-medium text-neutral-dark">
            Clave tributaria
          </label>
          <PasswordInput
            id="sii-clave"
            placeholder="Tu clave del SII"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={touched && password.length === 0}
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
                : "No pudimos conectar el SII. Verifica tus datos e intenta de nuevo."}
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
