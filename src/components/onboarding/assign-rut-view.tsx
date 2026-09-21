"use client";

import * as React from "react";
import { QavanteInput } from "@/components/qavante";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { usePatchMe } from "@/lib/api/users";
import { isValidRut } from "@/lib/validators/rut";
import { OnboardingShell } from "./onboarding-shell";
import { OnboardingStepActions } from "./onboarding-step-actions";
import { ONBOARDING_DONE_ROUTE } from "./onboarding-steps";

export function AssignRutView() {
  const patchMe = usePatchMe();
  const [rut, setRut] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const rutValid = isValidRut(rut);
  const canSubmit = rutValid && !patchMe.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSubmitError(null);
    if (!canSubmit) return;
    try {
      await patchMe.mutateAsync({ rut });
      /* Vuelve al panel: UserRutGuard ya no aplica y OnboardingGuard
         retoma SII/banco si el tenant no terminó el wizard. */
      window.location.assign(ONBOARDING_DONE_ROUTE);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(apiErrorToUserMessage(err));
      } else {
        setSubmitError("No pudimos guardar tu RUT. Reintentá.");
      }
    }
  }

  return (
    <OnboardingShell
      step="assign-rut"
      description="Tu RUT queda en la cuenta. No es el de la empresa: ese se pide al conectar el SII."
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-md space-y-4">
        <div className="space-y-1">
          <label htmlFor="assign-rut" className="text-sm font-medium text-neutral-dark">
            Tu RUT
          </label>
          <QavanteInput
            id="assign-rut"
            variant="rut"
            placeholder="12.345.678-9"
            autoComplete="off"
            autoFocus
            value={rut}
            onValueChange={setRut}
            onBlur={() => setTouched(true)}
            invalid={touched && !rutValid}
          />
          {touched && !rutValid && (
            <p className="text-xs text-danger-500" role="alert">
              {rut.trim() ? "RUT inválido." : "Ingresa tu RUT."}
            </p>
          )}
        </div>

        {submitError && (
          <div
            role="alert"
            className="rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
          >
            {submitError}
          </div>
        )}

        <OnboardingStepActions
          continueType="submit"
          continueLabel="Continuar"
          continueLoading={patchMe.isPending}
          continueDisabled={!canSubmit}
        />
      </form>
    </OnboardingShell>
  );
}
