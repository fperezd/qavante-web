import * as React from "react";
import { cn } from "@/lib/utils";
import { formatClp } from "@/lib/formatters/clp";

/* TendenciaResultado — el MARGEN operacional de los últimos meses en mini-barras: contesta
   "¿estoy siendo más o menos rentable?" (independiente de si vendí más o menos — eso lo dice
   el $ del hero). Junto a los drivers (qué cambió ESTE mes) cierra la lectura. Presentacional
   (SVG sin libs); barras verdes si el margen es positivo, rojas si es negativo; el mes en curso
   resaltado. El % por mes ya lo trae el breakdown por rango (pct_by_month del resultado). */

export interface TendenciaPunto {
  /** Etiqueta corta del período (ej. "jul"). */
  periodo: string;
  /** Margen operacional del mes (%, ej. 9.3). */
  margenPct: number;
  /** Resultado del mes en CLP (secundario, opcional; se muestra chico bajo el %). */
  resultado?: number;
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

function fmtPct(v: number): string {
  return `${v.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function TendenciaResultado({ titulo = "Margen operacional en el tiempo", puntos, className }: TendenciaResultadoProps) {
  const vacio = puntos.length === 0;
  const vals = puntos.map((p) => p.margenPct);
  const maxV = Math.max(0, ...vals);
  const minV = Math.min(0, ...vals);
  const span = maxV - minV || Math.abs(maxV) || 1;
  const top = maxV + span * 0.18;
  const bot = minV - span * 0.18;
  const plotH = H - PAD_T - PAD_B;
  const yOf = (v: number) => PAD_T + ((top - v) / (top - bot)) * plotH;
  const y0 = yOf(0);
  const colW = puntos.length > 0 ? W / puntos.length : W;
  const barW = Math.min(30, colW * 0.5);
  const ultimo = puntos[puntos.length - 1];

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
              const yv = yOf(p.margenPct);
              const y = Math.min(y0, yv);
              const h = Math.max(2, Math.abs(yv - y0));
              const neg = p.margenPct < 0;
              const fill = neg ? "var(--color-danger-500)" : "var(--color-success-600)";
              return (
                <g key={p.periodo + i}>
                  <rect x={cx - barW / 2} y={y} width={barW} height={h} rx="3" fill={fill} opacity={p.actual ? 1 : 0.55} />
                  <text
                    x={cx}
                    y={neg ? y0 + 12 : y - 4}
                    textAnchor="middle"
                    fontSize="8.8"
                    fontWeight={p.actual ? 700 : 400}
                    fill={p.actual ? "var(--color-neutral-dark)" : "var(--color-neutral-mid)"}
                  >
                    {fmtPct(p.margenPct)}
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
          {ultimo && (
            <p className="mt-1 px-1 text-[11.5px] text-neutral-mid">
              Último mes <b className="text-neutral-dark">{fmtPct(ultimo.margenPct)}</b>
              {ultimo.resultado != null && <> · {formatClp(ultimo.resultado)}</>}
              {ultimo.actual && " · en curso"}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
