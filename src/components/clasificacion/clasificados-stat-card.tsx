"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* Card individual del bloque "Resumen de movimientos clasificados".
 *
 * Dos modos:
 * - info-only (sin onClick): no muestra affordance de click, no es
 *   tabbable, no captura cursor pointer;
 * - clickeable (con onClick): se ve clickeable — borde acentuado en hover,
 *   cursor pointer, foco visible, role="button", aceptás Enter/Space.
 *
 * Tokens del DS Qavante exclusivamente (success-/warning-/neutral-),
 * sin colores hardcodeados.
 *
 * El tooltip es nativo `title` por simplicidad; cuando exista un
 * QavanteTooltip lo migramos. */

export type StatCardTone = "neutral" | "success" | "warning";

export interface ClasificadosStatCardProps {
  label: string;
  /** Valor principal ya formateado (`formatClp(...)`, `"5"`, `"hace 2h"`...). */
  value: React.ReactNode;
  /** Línea secundaria opcional (ej. "{N} movimientos", "{path}"). */
  sublabel?: React.ReactNode;
  tone?: StatCardTone;
  /** Texto del tooltip (native `title`). Idealmente una frase corta que
   *  explique qué representa esta métrica. */
  tooltip?: string;
  /** Si está presente, la card es accionable. Etiqueta accesible para SR:
   *  `actionLabel` describe el efecto del click (ej. "Filtrar por ingresos"). */
  onClick?: () => void;
  /** Texto para SR cuando la card es clickeable. Si se omite y onClick
   *  existe, usamos `label` como fallback. */
  actionLabel?: string;
}

const toneClasses: Record<StatCardTone, string> = {
  neutral: "text-neutral-dark",
  success: "text-success-700",
  warning: "text-warning-700",
};

export function ClasificadosStatCard({
  label,
  value,
  sublabel,
  tone = "neutral",
  tooltip,
  onClick,
  actionLabel,
}: ClasificadosStatCardProps) {
  const isInteractive = typeof onClick === "function";

  const interactiveClasses = isInteractive
    ? cn(
        "cursor-pointer transition-colors",
        "hover:border-brand-primary/40 hover:bg-neutral-light/30",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
      )
    : "";

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? (actionLabel ?? label) : undefined}
      title={tooltip}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-neutral-light bg-surface p-4",
        interactiveClasses,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-mid">{label}</p>
      <p className={cn("text-xl font-semibold tabular-nums", toneClasses[tone])}>{value}</p>
      {sublabel && (
        <p
          className="line-clamp-1 text-xs text-neutral-mid"
          title={typeof sublabel === "string" ? sublabel : undefined}
        >
          {sublabel}
        </p>
      )}
    </div>
  );
}
