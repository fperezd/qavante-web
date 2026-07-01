"use client";

import * as React from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { QavanteBadge, QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { cn } from "@/lib/utils";
import { KpiCell, KpiStrip } from "@/components/proposals/shared/kpi-strip";
import {
  coverageInfo,
  deltaInfo,
  runwayTone,
  sparklinePoints,
  type Tone,
} from "./inicio-v2-format";
import type { InicioV2Data } from "./types";

/* Inicio Ejecutivo v2 — highlights de la propuesta UX (control de gestión).
 *
 * El home hoy muestra niveles pero casi ningún DELTA. Un dueño quiere saber si
 * MEJORÓ o EMPEORÓ. Esta propuesta agrega lo que ya está en el contrato
 * DashboardSummaryV2 pero no se renderiza: runway como número héroe, caja con
 * variación % + sparkline, ventas del mes vs año anterior, y las 3 fechas clave
 * del mes con su cobertura contra caja. FE-only (los campos ya existen). */

const VALUE_COLOR: Record<Tone, string> = {
  success: "text-success-500",
  warning: "text-warning-500",
  danger: "text-danger-500",
  neutral: "text-neutral-dark",
};
const BADGE: Record<Tone, "success" | "warning" | "danger" | "default"> = {
  success: "success",
  warning: "warning",
  danger: "danger",
  neutral: "default",
};

export function InicioV2Highlights({ data }: { data: InicioV2Data }) {
  const runwayT = runwayTone(data.days_of_cash);
  const cashDelta = deltaInfo(data.cash_delta_pct, true);
  const ventasDelta = deltaInfo(data.ventas_delta_yoy, true);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-dark">Inicio</h1>
        <p className="mt-1 text-sm text-neutral-mid">¿Cómo estoy hoy y hacia dónde voy?</p>
      </div>

      <KpiStrip>
        <KpiCell
          label="Días de caja"
          value={data.days_of_cash != null ? `${data.days_of_cash} días` : "—"}
          valueClassName={VALUE_COLOR[runwayT]}
          sub={runwayT === "danger" ? "Caja ajustada" : runwayT === "warning" ? "Vigila de cerca" : "Caja holgada"}
        />
        <KpiCell
          label="Caja hoy"
          value={formatClp(Number(data.cash_today))}
          sub={
            <span className="flex items-center justify-between gap-2">
              {cashDelta ? <DeltaChip info={cashDelta} suffix="vs mes ant." /> : <span>Sin comparativo</span>}
              <Sparkline values={data.cash_sparkline} />
            </span>
          }
        />
        <KpiCell
          label="Ventas del mes"
          value={formatClp(Number(data.ventas_mes))}
          sub={ventasDelta ? <DeltaChip info={ventasDelta} suffix="vs año anterior" /> : "Sin comparativo"}
        />
      </KpiStrip>

      {/* 3 fechas clave del mes */}
      {data.key_obligations.length > 0 && (
        <QavanteCard variant="bordered" header={<span className="font-medium">Fechas clave del mes</span>}>
          <ul className="divide-y divide-border">
            {data.key_obligations.map((o) => {
              const cov = coverageInfo(o.coverage);
              return (
                <li key={o.key} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-neutral-dark">{o.label}</p>
                    <p className="text-xs text-neutral-mid">Vence {formatDateLike(o.due_date)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="tabular-nums font-medium text-neutral-dark">{formatClp(Number(o.amount))}</span>
                    <QavanteBadge variant={BADGE[cov.tone]}>{cov.label}</QavanteBadge>
                  </div>
                </li>
              );
            })}
          </ul>
        </QavanteCard>
      )}
    </div>
  );
}

function DeltaChip({ info, suffix }: { info: { tone: Tone; text: string; up: boolean }; suffix: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", VALUE_COLOR[info.tone])}>
      {info.up ? <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" /> : <TrendingDown className="h-3.5 w-3.5" aria-hidden="true" />}
      {info.text} <span className="font-normal text-neutral-mid">{suffix}</span>
    </span>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const W = 80;
  const H = 24;
  const points = sparklinePoints(values, W, H);
  const rising = (values[values.length - 1] ?? 0) >= (values[0] ?? 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-6 w-20" preserveAspectRatio="none" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        className={rising ? "stroke-success-500" : "stroke-danger-500"}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
