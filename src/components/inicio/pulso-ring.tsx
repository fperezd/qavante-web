"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/hooks/use-count-up";
import type { PulsoStatus } from "@/lib/api/dashboard";

/* Anillo del Pulso (nivel dios). El número más importante deja de ser plano: un
   anillo que se llena según el score, respira sutilmente y cuyo color comunica
   el estado de un vistazo. El score cuenta desde 0. Respeta reduce-motion (el
   count-up salta al valor; el latido se apaga vía CSS). */

const R = 54;
const CIRC = 2 * Math.PI * R; // ≈ 339.29
const SIZE = 132;
const STROKE = 11;

/** Color del anillo/estado según el status canónico del Pulso. */
const STATUS_COLOR: Record<PulsoStatus, string> = {
  strong: "var(--color-success-500)",
  stable: "var(--color-success-400)",
  weak: "var(--color-warning-500)",
  critical: "var(--color-danger-500)",
};

const STATUS_LABEL: Record<PulsoStatus, string> = {
  strong: "Fuerte",
  stable: "Estable",
  weak: "Débil",
  critical: "Crítica",
};

const STATUS_TEXT: Record<PulsoStatus, string> = {
  strong: "text-success-700",
  stable: "text-success-700",
  weak: "text-warning-700",
  critical: "text-danger-500",
};

/** Lookup con fallback a `stable`: el backend no valida el enum en runtime, un
 *  `status` fuera de contrato NO debe dejar el anillo sin color ni el label en
 *  "undefined". */
function statusValue<T>(rec: Record<PulsoStatus, T>, status: PulsoStatus): T {
  return (rec as Record<string, T>)[status] ?? rec.stable;
}

export interface PulsoRingProps {
  /** 0–100. */
  score: number;
  status: PulsoStatus;
  className?: string;
}

export function PulsoRing({ score, status, className }: PulsoRingProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const animated = useCountUp(clamped, 1200);
  const offset = CIRC * (1 - animated / 100);
  const color = statusValue(STATUS_COLOR, status);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`Pulso del negocio: ${Math.round(clamped)} de 100, ${statusValue(STATUS_LABEL, status)}`}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="animate-qv-breathe -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--color-neutral-light)"
          strokeOpacity={0.35}
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div
            className={cn(
              "text-4xl font-bold tabular-nums leading-none",
              statusValue(STATUS_TEXT, status),
            )}
          >
            {Math.round(animated)}
          </div>
          <div
            className={cn(
              "mt-1 text-[11px] font-semibold uppercase tracking-wider",
              statusValue(STATUS_TEXT, status),
            )}
          >
            {statusValue(STATUS_LABEL, status)}
          </div>
        </div>
      </div>
    </div>
  );
}
