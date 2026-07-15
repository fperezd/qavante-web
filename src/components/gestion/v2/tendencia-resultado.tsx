import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* TendenciaResultado — el resultado operacional de los últimos meses en mini-barras: contesta
   "¿voy mejorando o empeorando?". Junto a los drivers (qué cambió ESTE mes) cierra la lectura.
   Presentacional (SVG sin libs); barras verdes si hay ganancia, rojas si hay pérdida; el mes en
   curso resaltado. Alimentado por la serie del breakdown por rango (que ya existe). */

export interface TendenciaPunto {
  /** Etiqueta corta del período (ej. "jul"). */
  periodo: string;
  /** Resultado operacional del mes (firmado). */
  resultado: number;
  /** Marca el mes en curso (parcial) → se resalta. */
  actual?: boolean;
}

export interface TendenciaResultadoProps {
  titulo?: string;
  puntos: TendenciaPunto[];
  className?: string;
}

const W = 360;
const H = 118;
const PAD_T = 18;
const PAD_B = 20;

/** Monto abreviado en millones ($4,5M / −$3,0M) para no saturar las etiquetas. */
function abreviar(v: number): string {
  const millones = v / 1_000_000;
  const num = Math.abs(millones).toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${v < 0 ? "−" : ""}$${num}M`;
}

export function TendenciaResultado({ titulo = "Resultado en el tiempo", puntos, className }: TendenciaResultadoProps) {
  const vacio = puntos.length === 0;
  const vals = puntos.map((p) => p.resultado);
  const maxV = Math.max(0, ...vals);
  const minV = Math.min(0, ...vals);
  const span = maxV - minV || Math.abs(maxV) || 1;
  const top = maxV + span * 0.16;
  const bot = minV - span * 0.16;
  const plotH = H - PAD_T - PAD_B;
  const yOf = (v: number) => PAD_T + ((top - v) / (top - bot)) * plotH;
  const y0 = yOf(0);
  const colW = puntos.length > 0 ? W / puntos.length : W;
  const barW = Math.min(30, colW * 0.5);

  return (
    <section className={cn("overflow-hidden rounded-xl border border-border bg-surface shadow-sm", className)} aria-label={titulo}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-neutral-dark">{titulo}</h2>
      </div>
      {vacio ? (
        <p className="px-4 py-6 text-center text-xs text-neutral-mid">Sin histórico para mostrar la tendencia.</p>
      ) : (
        <div className="px-3 py-3">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={titulo} className="block">
            {/* eje 0 */}
            <line x1="0" y1={y0} x2={W} y2={y0} stroke="var(--color-border)" strokeWidth="1" />
            {puntos.map((p, i) => {
              const cx = i * colW + colW / 2;
              const yv = yOf(p.resultado);
              const y = Math.min(y0, yv);
              const h = Math.max(2, Math.abs(yv - y0));
              const neg = p.resultado < 0;
              const fill = neg ? "var(--color-danger-500)" : "var(--color-success-600)";
              return (
                <g key={p.periodo + i}>
                  <rect
                    x={cx - barW / 2}
                    y={y}
                    width={barW}
                    height={h}
                    rx="3"
                    fill={fill}
                    opacity={p.actual ? 1 : 0.55}
                  />
                  <text
                    x={cx}
                    y={neg ? y0 + 12 : y - 4}
                    textAnchor="middle"
                    fontSize="8.5"
                    fontWeight={p.actual ? 700 : 400}
                    fill={p.actual ? "var(--color-neutral-dark)" : "var(--color-neutral-mid)"}
                  >
                    {abreviar(p.resultado)}
                  </text>
                  <text
                    x={cx}
                    y={H - 6}
                    textAnchor="middle"
                    fontSize="9.5"
                    fontWeight={p.actual ? 700 : 400}
                    fill={p.actual ? "var(--color-neutral-dark)" : "var(--color-neutral-mid)"}
                  >
                    {p.periodo}
                  </text>
                </g>
              );
            })}
          </svg>
          <p className="mt-1 px-1 text-[11.5px] text-neutral-mid">
            Último mes <b className="text-neutral-dark">{formatClp(puntos[puntos.length - 1]!.resultado)}</b>
            {puntos[puntos.length - 1]!.actual && " · en curso"}
          </p>
        </div>
      )}
    </section>
  );
}
