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
   navegación real la maneja cada page. Lenguaje visual v1.3.

   Sin `step` funciona en modo HUB (pantalla del wizard que no es un paso
   numerado, ej. el hub de conexiones): sin barra de progreso ni "Paso N de 7" —
   mostrar un progreso ahí sería inventar una posición que el usuario no tiene. */

export interface OnboardingShellProps {
  /** Paso activo. Omitirlo → modo hub (sin progreso); requiere `title`. */
  step?: OnboardingStepId;
  /** Contenido del paso. */
  children: React.ReactNode;
  /** Subtítulo opcional bajo el título. */
  description?: React.ReactNode;
  /** Título en modo hub (sin `step`). Ignorado si hay `step`. */
  title?: string;
}

export function OnboardingShell({ step, children, description, title }: OnboardingShellProps) {
  const current = step ? ONBOARDING_STEPS.find((s) => s.id === step) : undefined;
  const activeIndex = step ? stepIndex(step) : -1;
  const pct = step ? progressPct(step) : 0;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-8 sm:py-12">
      {/* Encabezado: progreso (solo en modo paso). */}
      {step && (
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
      )}

      {/* Título + contenido. */}
      <div className={cn("flex flex-1 flex-col", step && "mt-8")}>
        <h1 className="text-2xl font-bold text-neutral-dark">{current?.title ?? title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-mid">{description}</p>}
        <div className="mt-6 flex-1">{children}</div>
      </div>
    </div>
  );
}
