import * as React from "react";
import { cn } from "@/lib/utils";
import { indiceMasBajo, type SaldoPunto } from "./caja-curva-model";

/* CajaCurva — la curva de saldo proyectado del Caja v2: baja en el tiempo hacia la
   línea de caja mínima y marca el punto más bajo (cuándo la caja "toca el piso").
   Presentacional puro (SVG sin libs). Grid vertical (una línea por período, ordena),
   línea de caja mínima + zona bajo el mínimo, y eventos como guías verticales con su
   etiqueta alineada arriba. El saldo acumulado se deriva en `caja-curva-model`. */

export interface CajaCurvaEvento {
  /** Índice del punto (0-based) donde ocurre el evento. */
  indice: number;
  label: string;
  /** "crit" (el cruce / punto bajo) se dibuja en rojo; "info" en gris. */
  tono?: "info" | "crit";
}

export interface CajaCurvaProps {
  /** Serie de saldo por período, más antiguo primero (el primero suele ser "hoy"). */
  serie: SaldoPunto[];
  /** Línea de caja mínima. */
  minimo: number;
  /** Eventos a marcar (línea vertical + etiqueta). */
  eventos?: CajaCurvaEvento[];
  /** Alto del gráfico en px (default 250). */
  height?: number;
  className?: string;
}

const W = 820;
const PADX = 12;

export function CajaCurva({ serie, minimo, eventos = [], height = 250, className }: CajaCurvaProps) {
  const id = React.useId();
  if (serie.length < 2) return null; // sin ≥2 puntos no hay curva

  const H = height;
  const plotTop = 46;
  const plotBottom = H - 36;
  const saldos = serie.map((p) => p.saldo);
  let top = Math.max(...saldos, minimo);
  let bot = Math.min(...saldos, minimo);
  const span = top - bot || Math.abs(top) || 1;
  top += span * 0.12;
  bot -= span * 0.12;

  const xOf = (i: number) => PADX + (i * (W - PADX * 2)) / (serie.length - 1);
  const yOf = (v: number) => plotTop + ((top - v) / (top - bot)) * (plotBottom - plotTop);

  const line = serie
    .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(i).toFixed(1)},${yOf(p.saldo).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${xOf(serie.length - 1).toFixed(1)},${plotBottom} L${PADX},${plotBottom} Z`;
  const minY = yOf(minimo);
  const bajoIdx = indiceMasBajo(saldos);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      width="100%"
      height={H}
      className={cn("block", className)}
      role="img"
      aria-label="Curva de saldo proyectado"
    >
      <defs>
        <linearGradient id={`cf-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.2" />
          <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid vertical: una línea por período */}
      <g stroke="var(--color-border)" strokeWidth="1">
        {serie.map((_, i) => (
          <line key={i} x1={xOf(i)} y1={plotTop} x2={xOf(i)} y2={plotBottom} />
        ))}
      </g>

      {/* zona bajo el mínimo + línea de caja mínima */}
      <rect
        x={PADX}
        y={minY}
        width={W - PADX * 2}
        height={Math.max(0, plotBottom - minY)}
        fill="var(--color-danger-500)"
        opacity="0.06"
      />
      <line
        x1={PADX}
        y1={minY}
        x2={W - PADX}
        y2={minY}
        stroke="var(--color-danger-500)"
        strokeWidth="1.5"
        strokeDasharray="5 4"
        opacity="0.7"
      />

      {/* área + curva del saldo */}
      <path d={area} fill={`url(#cf-${id})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--color-brand-primary)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* eventos: guía vertical + etiqueta alineada arriba */}
      {eventos.map((e, k) => {
        const crit = e.tono === "crit";
        const color = crit ? "var(--color-danger-500)" : "var(--color-neutral-mid)";
        return (
          <g key={k}>
            <line
              x1={xOf(e.indice)}
              y1={30}
              x2={xOf(e.indice)}
              y2={yOf(saldos[e.indice] as number)}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity={crit ? 0.75 : 0.5}
            />
            <text x={xOf(e.indice)} y={22} textAnchor="middle" fontSize="10" fontWeight="700" fill={color}>
              {e.label}
            </text>
          </g>
        );
      })}

      {/* punto inicial + punto más bajo */}
      <circle
        cx={xOf(0)}
        cy={yOf(saldos[0] as number)}
        r="3.6"
        fill="var(--color-brand-primary)"
        stroke="var(--color-surface)"
        strokeWidth="1.5"
      />
      {bajoIdx != null && (
        <>
          <circle cx={xOf(bajoIdx)} cy={yOf(saldos[bajoIdx] as number)} r="6.5" fill="var(--color-danger-500)" fillOpacity="0.18" />
          <circle
            cx={xOf(bajoIdx)}
            cy={yOf(saldos[bajoIdx] as number)}
            r="3.6"
            fill="var(--color-danger-500)"
            stroke="var(--color-surface)"
            strokeWidth="1.5"
          />
        </>
      )}

      {/* eje x: una etiqueta por período */}
      {serie.map((p, i) => (
        <text
          key={i}
          x={xOf(i)}
          y={H - 12}
          textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"}
          fontSize="9.5"
          fill="var(--color-neutral-mid)"
        >
          {p.label}
        </text>
      ))}
    </svg>
  );
}
