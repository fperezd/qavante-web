import * as React from "react";

/* Sparkline — mini-tendencia SVG para un KPI (30 días). Área con degradado suave, línea
 * SUAVIZADA (bezier Catmull-Rom), trazado animado al montar (draw-in, reduced-motion-safe)
 * y punto final con halo. `tone` fija el color semántico. `baseline` dibuja una referencia
 * (p.ej. 0) cuando la serie la cruza. `markers` marca el mín y el máx (opt-in). Sin libs. */

export type SparkTone = "brand" | "success" | "danger" | "neutral";

const STROKE: Record<SparkTone, string> = {
  brand: "var(--color-brand-primary)",
  success: "var(--color-success-500)",
  danger: "var(--color-danger-500)",
  neutral: "var(--color-neutral-mid)",
};

export interface SparklineProps {
  data: number[];
  tone?: SparkTone;
  width?: number;
  height?: number;
  /** Línea de referencia (p.ej. 0). Solo se dibuja si cae dentro del rango. */
  baseline?: number;
  /** Marca el punto mínimo y máximo de la serie (opt-in). */
  markers?: boolean;
  className?: string;
}

type Pt = readonly [number, number];

/** Path suavizado (Catmull-Rom → cubic bezier). Con <3 puntos cae a polilínea. */
function smoothPath(pts: Pt[]): string {
  if (pts.length < 3) {
    return pts
      .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(" ");
  }
  let d = `M${pts[0]![0].toFixed(1)},${pts[0]![1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export function Sparkline({
  data,
  tone = "brand",
  width = 108,
  height = 34,
  baseline,
  markers = false,
  className,
}: SparklineProps) {
  const id = React.useId();
  const uid = id.replace(/[^a-zA-Z0-9]/g, "");
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const step = width / (data.length - 1);
  const yOf = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2);
  const pts: Pt[] = data.map((v, i) => [i * step, yOf(v)] as const);
  const line = smoothPath(pts);
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1]!;
  const color = STROKE[tone];
  const baseY = baseline != null && baseline >= min && baseline <= max ? yOf(baseline) : null;

  const minIdx = data.indexOf(min);
  const maxIdx = data.indexOf(max);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      role="img"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Draw-in del trazado: dibujado por default (reduced-motion); animado solo si se permite motion. */}
      <style>{`
        .sl-${uid}{stroke-dasharray:1;stroke-dashoffset:0}
        @media (prefers-reduced-motion:no-preference){
          .sl-${uid}{stroke-dashoffset:1;animation:dr-${uid} .9s ease .08s forwards}
        }
        @keyframes dr-${uid}{to{stroke-dashoffset:0}}
      `}</style>
      {baseY != null && (
        <line
          x1="0"
          x2={width}
          y1={baseY}
          y2={baseY}
          stroke="var(--color-neutral-mid)"
          strokeWidth="1"
          strokeDasharray="2 3"
          strokeOpacity="0.4"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={area} fill={`url(#spark-${uid})`} />
      <path
        className={`sl-${uid}`}
        d={line}
        pathLength={1}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {markers && minIdx !== maxIdx && (
        <>
          <circle
            cx={pts[minIdx]![0]}
            cy={pts[minIdx]![1]}
            r="1.9"
            fill="var(--color-neutral-mid)"
          />
          <circle cx={pts[maxIdx]![0]} cy={pts[maxIdx]![1]} r="1.9" fill={color} />
        </>
      )}
      <circle cx={last[0]} cy={last[1]} r="4.5" fill={color} fillOpacity="0.18" />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="2.4"
        fill={color}
        stroke="var(--color-surface)"
        strokeWidth="1.25"
      />
    </svg>
  );
}
