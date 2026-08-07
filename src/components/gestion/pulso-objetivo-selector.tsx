"use client";

import * as React from "react";
import { Loader2, Target } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { PULSO_OBJETIVOS, objetivoOption, type PulsoObjetivo } from "./pulso-objetivo";

/* Selector del objetivo del Pulso: el dueño elige qué prioriza su empresa y eso re-pondera los ejes.
   Presentacional (el contenedor persiste el objetivo en prefs + lo manda al endpoint). No inventa un
   score: solo captura la intención; el número re-ponderado lo devuelve el backend. */

export interface PulsoObjetivoSelectorProps {
  value: PulsoObjetivo;
  onChange: (o: PulsoObjetivo) => void;
  /** Persistencia en curso → deshabilita + spinner. */
  saving?: boolean;
}

export function PulsoObjetivoSelector({ value, onChange, saving }: PulsoObjetivoSelectorProps) {
  const activa = objetivoOption(value);

  return (
    <QavanteCard
      variant="bordered"
      header={
        <span className="flex items-center gap-1.5 font-medium">
          <Target className="h-4 w-4 text-brand-primary" aria-hidden="true" />
          ¿Con qué foco quieres mirar tu salud?
        </span>
      }
    >
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Objetivo del Pulso">
        {PULSO_OBJETIVOS.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={saving}
              onClick={() => !active && onChange(o.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60",
                active
                  ? "border-brand-primary bg-brand-primary text-white"
                  : "border-border bg-surface text-neutral-mid hover:text-neutral-dark",
              )}
            >
              {active && saving && (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              )}
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-xs text-neutral-mid">
        Estás midiendo tu salud con foco en{" "}
        <span className="font-medium text-neutral-dark">{activa.label.toLowerCase()}</span>.{" "}
        {activa.descripcion} Tu Pulso pondera más los ejes de ese foco.
      </p>
    </QavanteCard>
  );
}
