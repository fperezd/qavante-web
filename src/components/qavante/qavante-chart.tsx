"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

/* QavanteChart — wrappers tematizados sobre recharts (Capa 1, agnóstico).
   Aplican la paleta de marca (tokens --qv-*), ejes sutiles, grilla mínima y
   tooltip con formato del consumidor. Máx ~5 series (Design System Premium §10).
   Datos genéricos: array de objetos { [index]: x, [serie.key]: number }. */

export type ChartDatum = Record<string, string | number>;

export interface ChartSeries {
  key: string;
  label?: string;
}

export interface QavanteChartProps {
  data: ChartDatum[];
  /** Key del eje X (categoría). */
  index: string;
  series: ChartSeries[];
  height?: number;
  /** Formatea los valores del eje Y y del tooltip (ej. CLP, %). */
  valueFormatter?: (value: number) => string;
}

/* Paleta de marca para series — derivada de los tokens, no el arcoíris default
   de recharts. Daltonismo: el orden prioriza contraste de luminancia. */
const PALETTE = [
  "var(--qv-brand-primary)",
  "var(--qv-brand-light)",
  "var(--qv-brand-deep)",
  "var(--qv-info-500)",
  "var(--qv-warning-500)",
];

const AXIS_PROPS = {
  stroke: "var(--qv-neutral-mid)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const seriesColor = (i: number) => PALETTE[i % PALETTE.length];

function useChartTooltip(valueFormatter?: (v: number) => string) {
  return React.useMemo(
    () => ({
      contentStyle: {
        borderRadius: 12,
        border: "1px solid var(--qv-border)",
        boxShadow: "var(--qv-shadow-lg)",
        fontSize: 13,
        fontFamily: "inherit",
      },
      formatter: valueFormatter
        ? (value: number | string | ReadonlyArray<number | string> | undefined): string =>
            typeof value === "number" ? valueFormatter(value) : value == null ? "" : String(value)
        : undefined,
    }),
    [valueFormatter],
  );
}

export function QavanteAreaChart({
  data,
  index,
  series,
  height = 240,
  valueFormatter,
}: QavanteChartProps) {
  const tooltip = useChartTooltip(valueFormatter);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.key} id={`qv-area-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesColor(i)} stopOpacity={0.25} />
              <stop offset="100%" stopColor={seriesColor(i)} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--qv-border)" vertical={false} />
        <XAxis dataKey={index} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} tickFormatter={valueFormatter} width={64} />
        <Tooltip {...tooltip} />
        {series.map((s, i) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label ?? s.key}
            stroke={seriesColor(i)}
            strokeWidth={2}
            fill={`url(#qv-area-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function QavanteBarChart({
  data,
  index,
  series,
  height = 240,
  valueFormatter,
}: QavanteChartProps) {
  const tooltip = useChartTooltip(valueFormatter);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--qv-border)" vertical={false} />
        <XAxis dataKey={index} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} tickFormatter={valueFormatter} width={64} />
        <Tooltip {...tooltip} cursor={{ fill: "var(--qv-brand-primary-50)" }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label ?? s.key}
            fill={seriesColor(i)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function QavanteLineChart({
  data,
  index,
  series,
  height = 240,
  valueFormatter,
}: QavanteChartProps) {
  const tooltip = useChartTooltip(valueFormatter);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--qv-border)" vertical={false} />
        <XAxis dataKey={index} {...AXIS_PROPS} />
        <YAxis {...AXIS_PROPS} tickFormatter={valueFormatter} width={64} />
        <Tooltip {...tooltip} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label ?? s.key}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
