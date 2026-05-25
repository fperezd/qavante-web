"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* Métrica individual del bloque "Resumen de movimientos clasificados".
 *
 * Sin borde propio — vive dentro de un container card del padre (un solo
 * borde para todo el bloque). Layout más limpio que cards anidadas.
 *
 * Estados:
 * - info-only (sin onClick): label + value;
 * - clickeable (onClick): role=button, foco visible, hover tenue;
 * - clickeable activa (active=true): ring brand + bg tinte + caller pone
 *   sublabel tipo "Filtro activo · clic para quitar";
 * - muted (muted=true): opacidad 40 + cursor default + sin hover. Se usa
 *   cuando un filtro activo en otra métrica hace tautológico el valor de
 *   esta (ej. al filtrar a Ingresos, Egresos siempre vale 0).
 *
 * Tokens DS Qavante. Tooltip nativo `title`. */

export type StatCardTone = "neutral" | "success" | "warning";

export interface ClasificadosStatCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  tone?: StatCardTone;
  tooltip?: string;
  onClick?: () => void;
  active?: boolean;
  /** Filtro hermano hace tautológica esta métrica. Bloquea la interacción y
   *  baja el contraste, sin sacarla del layout (evita layout shift). */
  muted?: boolean;
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
  active = false,
  muted = false,
  actionLabel,
}: ClasificadosStatCardProps) {
  const isInteractive = typeof onClick === "function" && !muted;

  const interactiveClasses = isInteractive
    ? cn(
        "cursor-pointer rounded-md transition-colors -mx-2 px-2",
        "hover:bg-neutral-light/40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
      )
    : "";

  const activeClasses =
    isInteractive && active ? "bg-brand-primary/5 ring-1 ring-brand-primary/30 -mx-2 px-2" : "";

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!isInteractive) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  }

  const valueAsString = typeof value === "string" ? value : undefined;

  return (
    <div
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? (actionLabel ?? label) : undefined}
      aria-pressed={isInteractive ? active : undefined}
      aria-disabled={muted || undefined}
      title={tooltip}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={cn(
        "flex min-w-0 flex-col gap-0.5 py-1",
        muted && "opacity-40",
        interactiveClasses,
        activeClasses,
      )}
    >
      <p className="text-xs font-normal text-neutral-mid">{label}</p>
      <p
        className={cn(
          "truncate text-base font-semibold tabular-nums leading-tight",
          toneClasses[tone],
        )}
        title={valueAsString}
      >
        {value}
      </p>
      {sublabel && (
        <p
          className="truncate text-xs text-neutral-mid"
          title={typeof sublabel === "string" ? sublabel : undefined}
        >
          {sublabel}
        </p>
      )}
    </div>
  );
}
