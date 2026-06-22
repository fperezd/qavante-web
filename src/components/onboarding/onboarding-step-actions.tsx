"use client";

import * as React from "react";
import { QavanteButton } from "@/components/qavante";

/* Footer de acciones compartido de los pasos del wizard: Atrás (opcional),
   Omitir (opcional) y Continuar. `continueType="submit"` para pasos con form
   (el botón dispara el submit); "button" + onContinue para pasos sin form. */

export interface OnboardingStepActionsProps {
  /** "submit" → dentro de un <form> (sin onContinue). "button" → usa onContinue. */
  continueType?: "button" | "submit";
  continueLabel?: string;
  continueLoading?: boolean;
  continueDisabled?: boolean;
  onContinue?: () => void;
  /** Si se pasa, muestra "Omitir por ahora" (pasos opcionales). */
  onSkip?: () => void;
  skipLabel?: string;
  /** Si se pasa, muestra "Atrás". */
  onBack?: () => void;
}

export function OnboardingStepActions({
  continueType = "button",
  continueLabel = "Continuar",
  continueLoading,
  continueDisabled,
  onContinue,
  onSkip,
  skipLabel = "Omitir por ahora",
  onBack,
}: OnboardingStepActionsProps) {
  return (
    <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        {onBack && (
          <QavanteButton type="button" variant="ghost" onClick={onBack}>
            Atrás
          </QavanteButton>
        )}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {onSkip && (
          <QavanteButton type="button" variant="ghost" onClick={onSkip}>
            {skipLabel}
          </QavanteButton>
        )}
        <QavanteButton
          type={continueType}
          onClick={continueType === "button" ? onContinue : undefined}
          loading={continueLoading}
          disabled={continueDisabled}
        >
          {continueLabel}
        </QavanteButton>
      </div>
    </div>
  );
}
