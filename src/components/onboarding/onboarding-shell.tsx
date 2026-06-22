"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  progressPct,
  stepIndex,
  stepNumber,
  type OnboardingStepId,
} from "./onboarding-steps";

/* Shell del wizard de onboarding: layout enfocado (sin nav de la app) con barra
   de progreso + indicador "Paso N de 7" + título del paso, y un slot para el
   contenido de cada pantalla. Presentacional puro (recibe el `step` activo); la
   navegación real la maneja cada page. Lenguaje visual v1.3. */

export interface OnboardingShellProps {
  step: OnboardingStepId;
  /** Contenido del paso. */
  children: React.ReactNode;
  /** Subtítulo opcional bajo el título. */
  description?: React.ReactNode;
}

export function OnboardingShell({ step, children, description }: OnboardingShellProps) {
  const current = ONBOARDING_STEPS.find((s) => s.id === step);
  const activeIndex = stepIndex(step);
  const pct = progressPct(step);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-8 sm:py-12">
      {/* Encabezado: progreso. */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            Paso {stepNumber(step)} de {TOTAL_ONBOARDING_STEPS}
          </span>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-primary">
            {current?.label}
          </span>
        </div>

        {/* Barra de progreso. */}
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-neutral-light/40"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progreso del onboarding: ${pct}%`}
        >
          <div
            className="bg-gradient-brand h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Pasos como puntos (md+). */}
        <ol className="hidden flex-wrap gap-x-4 gap-y-1 pt-1 md:flex" aria-hidden="true">
          {ONBOARDING_STEPS.map((s, i) => {
            const done = i < activeIndex;
            const active = i === activeIndex;
            return (
              <li
                key={s.id}
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  active
                    ? "font-semibold text-brand-primary"
                    : done
                      ? "text-neutral-dark"
                      : "text-neutral-mid",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px]",
                    done
                      ? "bg-success-500 text-surface"
                      : active
                        ? "bg-brand-primary text-surface"
                        : "bg-neutral-light/60 text-neutral-mid",
                  )}
                >
                  {done ? <Check className="h-2.5 w-2.5" /> : i + 1}
                </span>
                {s.label}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Título + contenido. */}
      <div className="mt-8 flex flex-1 flex-col">
        <h1 className="text-2xl font-bold text-neutral-dark">{current?.title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-mid">{description}</p>}
        <div className="mt-6 flex-1">{children}</div>
      </div>
    </div>
  );
}
