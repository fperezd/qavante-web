import * as React from "react";

/* Sparkline — mini-tendencia SVG para un KPI (30 días). Área con degradado suave,
 * línea nítida y punto final destacado. `tone` fija el color semántico. Sin libs. */

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
  className?: string;
}

export function Sparkline({
  data,
  tone = "brand",
  width = 108,
  height = 34,
  className,
}: SparklineProps) {
  const id = React.useId();
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 2.5;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => {
    const x = i * step;
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = pts[pts.length - 1]!;
  const color = STROKE[tone];

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
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${id})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}
