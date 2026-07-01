"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ShieldCheck, TrendingDown } from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import { DynamicTable } from "@/components/proposals/dynamic-table/dynamic-table";
import {
  computeRunning,
  firstBreachIndex,
  parseAmount,
  type ProjRow,
} from "./projection-format";
import type { CashFlowProjectionData } from "./types";

/* Proyección de Caja v2 — propuesta UX (control de gestión) para `/caja/proyeccion`.
 *
 * Hoy la pantalla es una tabla contable de netos por período. Esta propuesta la
 * convierte en una proyección de tesorería de verdad: **saldo acumulado** (¿dónde
 * cruzo cero?), **línea de caja mínima** y **marcado del quiebre** (el primer
 * período que cae bajo el umbral). Insumos ya disponibles: saldo inicial =
 * CashToday, netos por bucket del reporte de cash-flow, umbral = cash-minimum.
 *
 * Presentacional (props + Storybook). §17.4: el acumulado es suma de netos ya
 * entregados (ayuda visual), no un cálculo financiero nuevo. */

const GRAN_LABEL: Record<CashFlowProjectionData["granularity"], string> = {
  day: "día",
  week: "semana",
  month: "mes",
};

export function CashFlowProjectionView({ data }: { data: CashFlowProjectionData }) {
  const rows = React.useMemo(
    () => computeRunning(data.initial_balance, data.buckets, data.cash_minimum),
    [data],
  );
  const breachIdx = firstBreachIndex(rows);
  const breachRow = breachIdx >= 0 ? rows[breachIdx] : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-dark">Proyección de caja</h1>
        <p className="mt-1 text-sm text-neutral-mid">
          ¿Me alcanza la caja las próximas {GRAN_LABEL[data.granularity]}s? ¿Dónde cruzo el mínimo?
        </p>
      </div>

      {breachRow ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/5 p-4 text-sm"
        >
          <TrendingDown className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
          <div>
            <p className="font-medium text-neutral-dark">
              Quiebre de caja proyectado en <span className="text-danger-500">{breachRow.label}</span>.
            </p>
            <p className="text-neutral-mid">
              Tu saldo caería a {formatClp(breachRow.running)}, bajo la caja mínima de{" "}
              {formatClp(parseAmount(data.cash_minimum))}. Adelanta cobranzas o posterga egresos antes
              de esa fecha.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-success-500/30 bg-success-500/5 p-4 text-sm">
          <ShieldCheck className="h-5 w-5 flex-shrink-0 text-success-500" aria-hidden="true" />
          <p className="text-neutral-dark">
            Sin quiebre de caja en el horizonte proyectado{" "}
            {data.cash_minimum && <>(te mantienes sobre la caja mínima de {formatClp(parseAmount(data.cash_minimum))})</>}.
          </p>
        </div>
      )}

      <QavanteCard
        variant="bordered"
        header={<span className="font-medium">Saldo de caja proyectado</span>}
      >
        <ProjectionChart rows={rows} cashMinimum={data.cash_minimum} breachIdx={breachIdx} />
      </QavanteCard>

      <ProjectionTable rows={rows} cashMinimum={data.cash_minimum} />
    </div>
  );
}

/* ── Gráfico de línea del saldo acumulado + caja mínima + quiebre ─────── */

function ProjectionChart({
  rows,
  cashMinimum,
  breachIdx,
}: {
  rows: ProjRow[];
  cashMinimum: string | null;
  breachIdx: number;
}) {
  const W = 1000;
  const H = 300;
  const padY = 28;
  const n = rows.length;
  const running = rows.map((r) => r.running);
  const minCash = cashMinimum == null ? null : parseAmount(cashMinimum);

  const candidates = [0, ...running, ...(minCash != null ? [minCash] : [])];
  const rawMin = Math.min(...candidates);
  const rawMax = Math.max(...candidates);
  const span = rawMax - rawMin || 1;
  const yMin = rawMin - span * 0.08;
  const yMax = rawMax + span * 0.08;

  const x = (i: number) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v: number) => H - padY - ((v - yMin) / (yMax - yMin)) * (H - 2 * padY);

  const linePath = running.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${x(n - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;
  const zeroInRange = yMin < 0 && yMax > 0;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-48 w-full"
        role="img"
        aria-label="Gráfico del saldo de caja proyectado por período"
      >
        {/* área */}
        <path d={areaPath} className="fill-brand-primary/10" />
        {/* cero */}
        {zeroInRange && (
          <line x1={0} y1={y(0)} x2={W} y2={y(0)} className="stroke-neutral-mid/40" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        )}
        {/* caja mínima */}
        {minCash != null && (
          <line
            x1={0}
            y1={y(minCash)}
            x2={W}
            y2={y(minCash)}
            className="stroke-warning-500"
            strokeWidth={1.5}
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* quiebre (línea vertical roja) */}
        {breachIdx >= 0 && (
          <line
            x1={x(breachIdx)}
            y1={0}
            x2={x(breachIdx)}
            y2={H}
            className="stroke-danger-500/70"
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {/* línea del saldo */}
        <path d={linePath} fill="none" className="stroke-brand-primary" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      </svg>
      {/* leyenda + etiquetas de período */}
      <div className="mt-1 flex justify-between gap-1 text-[10px] text-neutral-mid">
        {rows.map((r, i) => (
          <span key={`${r.period}-${i}`} className={cn("flex-1 truncate text-center", r.belowMinimum && "font-semibold text-danger-500")}>
            {r.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-mid">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-brand-primary" aria-hidden="true" />
          Saldo proyectado
        </span>
        {minCash != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t-2 border-dashed border-warning-500" aria-hidden="true" />
            Caja mínima
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Tabla con saldo acumulado ────────────────────────────────────────── */

const PROJECTION_COLUMNS: ColumnDef<ProjRow>[] = [
  { id: "periodo", accessorKey: "label", header: "Período", cell: ({ getValue }) => <span className="text-neutral-dark">{getValue() as string}</span> },
  {
    id: "entradas",
    accessorFn: (r) => parseAmount(r.inflow),
    header: "Entradas",
    enableColumnFilter: false,
    meta: { align: "right" },
    cell: ({ getValue }) => <span className="text-success-700">{formatClp(getValue() as number)}</span>,
  },
  {
    id: "salidas",
    accessorFn: (r) => parseAmount(r.outflow),
    header: "Salidas",
    enableColumnFilter: false,
    meta: { align: "right" },
    cell: ({ getValue }) => <span className="text-neutral-mid">{formatClp(getValue() as number)}</span>,
  },
  {
    id: "neto",
    accessorFn: (r) => parseAmount(r.net),
    header: "Neto",
    enableColumnFilter: false,
    meta: { align: "right" },
    cell: ({ getValue }) => {
      const n = getValue() as number;
      return <span className={n < 0 ? "text-danger-500" : "text-neutral-dark"}>{formatClp(n)}</span>;
    },
  },
  {
    id: "saldo",
    accessorFn: (r) => r.running,
    header: "Saldo proyectado",
    enableColumnFilter: false,
    meta: { align: "right" },
    cell: ({ row }) => (
      <span className={row.original.belowMinimum ? "text-danger-500" : "text-neutral-dark"}>
        {formatClp(row.original.running)}
      </span>
    ),
  },
];

function ProjectionTable({ rows, cashMinimum }: { rows: ProjRow[]; cashMinimum: string | null }) {
  return (
    <div className="space-y-2">
      <DynamicTable
        columns={PROJECTION_COLUMNS as ColumnDef<ProjRow, unknown>[]}
        data={rows}
        minWidth={620}
        rowClassName={(r) => (r.belowMinimum ? "bg-danger-500/5" : undefined)}
      />
      {cashMinimum != null && (
        <p className="text-xs text-neutral-mid">
          Filas en rojo: el saldo proyectado cae bajo tu caja mínima de {formatClp(parseAmount(cashMinimum))}.
        </p>
      )}
    </div>
  );
}
