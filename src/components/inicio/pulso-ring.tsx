"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useCountUp } from "@/lib/hooks/use-count-up";
import type { PulsoStatus } from "@/lib/api/dashboard";
import { anilloDelPulso } from "./pulso-ring-model";

/* Anillo del Pulso (nivel dios). El número más importante deja de ser plano: un
   anillo que se llena según el score, respira sutilmente y cuyo color comunica
   el estado de un vistazo. El score cuenta desde 0. Respeta reduce-motion (el
   count-up salta al valor; el latido se apaga vía CSS).

   QUÉ pintar vive en `pulso-ring-model.ts`, puro y testeado. Acá quedó sólo el SVG. La decisión
   que se separó es justamente la que estaba mal: con `status: null` —la abstención de la API
   cuando no hay saldo de apertura— el fallback mandaba a `stable` y la pantalla decía "Estable"
   en verde. Una decisión así tiene que poder afirmarse en un test sin montar un DOM. */

const R = 54;
const CIRC = 2 * Math.PI * R; // ≈ 339.29
const SIZE = 132;
const STROKE = 11;

export interface PulsoRingProps {
  /** 0–100, o `null` cuando el pulso es preliminar y la API se abstiene. */
  score: number | null;
  /** `null` cuando el pulso es preliminar: sin saldo de apertura no hay estado que publicar. */
  status: PulsoStatus | null;
  className?: string;
}

export function PulsoRing({ score, status, className }: PulsoRingProps) {
  const anillo = anilloDelPulso(score, status);
  const animated = useCountUp(anillo.score, 1200);
  // El anillo vacío es parte del mensaje: no hay número que llenar.
  const offset = anillo.sinDato ? CIRC : CIRC * (1 - animated / 100);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={
        anillo.sinDato
          ? "Pulso del negocio: sin datos suficientes para calcularlo"
          : `Pulso del negocio: ${Math.round(anillo.score)} de 100, ${anillo.label}`
      }
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        // El anillo vacio NO late: un anillo que respira se lee como "calculando", y esto
        // no esta calculando nada -- no hay dato. Quieto refuerza "no sabemos".
        className={cn("-rotate-90", !anillo.sinDato && "animate-qv-breathe")}
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
          stroke={anillo.color}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${anillo.color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className={cn("text-4xl font-bold tabular-nums leading-none", anillo.textClass)}>
            {anillo.sinDato ? anillo.numero : Math.round(animated)}
          </div>
          <div
            className={cn(
              "mt-1 text-[11px] font-semibold uppercase tracking-wider",
              anillo.textClass,
            )}
          >
            {anillo.label}
          </div>
        </div>
      </div>
    </div>
  );
}
