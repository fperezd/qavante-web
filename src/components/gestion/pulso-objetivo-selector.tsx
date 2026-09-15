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
  applicationState?: "base" | "pending" | "applied" | "not_applied" | "unverified";
}

export function PulsoObjetivoSelector({
  value,
  onChange,
  saving,
  applicationState = value === "equilibrado" ? "base" : "pending",
}: PulsoObjetivoSelectorProps) {
  const activa = objetivoOption(value);

  const applicationCopy =
    applicationState === "base"
      ? `${activa.descripcion} Este es el Pulso base del negocio.`
      : applicationState === "applied"
        ? `${activa.descripcion} Este foco sí está aplicado al corte mostrado.`
        : applicationState === "not_applied"
          ? `${activa.descripcion} Este corte no permite aplicar el foco; mostramos el Pulso base sin reponderarlo.`
          : applicationState === "unverified"
            ? `${activa.descripcion} No pudimos verificar si el foco se aplicó; no mostramos una cifra enfocada.`
            : `${activa.descripcion} Estamos verificando si el foco puede aplicarse a este corte.`;

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
        Foco seleccionado:{" "}
        <span className="font-medium text-neutral-dark">{activa.label.toLowerCase()}</span>.{" "}
        {applicationCopy}
      </p>
    </QavanteCard>
  );
}
