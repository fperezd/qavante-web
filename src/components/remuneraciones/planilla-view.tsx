"use client";

import * as React from "react";
import { Wallet, Inbox, Lock } from "lucide-react";
import type { UseQueryResult } from "@tanstack/react-query";
import { QavanteBadge, QavanteCard, QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import type { PayrollResponse, PayrollTotales } from "@/lib/api/buk";
import { formatClp } from "@/lib/formatters/clp";
import { SiiPeriodForm } from "@/components/sii/sii-period-form";
import { formatPeriodLabel } from "@/components/sii/sii-period-form-schema";

/* Planilla — totales AGREGADOS de remuneraciones del período (BUK). Por privacidad
   el backend NO expone detalle por empleado, solo agregados. Presentacional:
   recibe la query por prop (el page invoca useBukPayroll). */

export interface PlanillaViewProps {
  /** Período consultado (null = todavía no se consultó). */
  period: string | null;
  onPeriodChange: (period: string) => void;
  query: UseQueryResult<PayrollResponse, unknown>;
}

export function PlanillaView({ period, onPeriodChange, query }: PlanillaViewProps) {
  const totales = query.data?.totales;

  return (
    <div className="space-y-4">
      <SiiPeriodForm
        onSubmit={onPeriodChange}
        loading={query.isFetching}
        hint="Totales de la planilla de remuneraciones del mes (haberes, descuentos y líquido)."
      />

      {!period && (
        <QavanteEmpty
          icon={Wallet}
          title="Consulta la planilla del período"
          description="Elige un mes y vas a ver los totales de remuneraciones: haberes, descuentos, líquido a pagar e imponible, más la cantidad de empleados considerados."
        />
      )}

      {period && query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Consultando la planilla"
        />
      )}

      {period && query.isError && (
        <QavanteInlineError error={query.error} what="la planilla de remuneraciones" />
      )}

      {period && query.data && !totales && (
        <QavanteEmpty
          icon={Inbox}
          title="Sin planilla en el período"
          description="No hay totales de remuneraciones para este mes. Prueba con otro período."
        />
      )}

      {period && totales && <PlanillaTotales period={period} totales={totales} />}
    </div>
  );
}

function PlanillaTotales({ period, totales }: { period: string; totales: PayrollTotales }) {
  return (
    <QavanteCard
      variant="bordered"
      header={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium">{formatPeriodLabel(period)}</span>
          <QavanteBadge variant="info">
            {totales.empleados_contados}{" "}
            {totales.empleados_contados === 1 ? "empleado" : "empleados"}
          </QavanteBadge>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Líquido = figura principal */}
        <div className="rounded-xl bg-brand-primary-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-primary-700">
            Líquido a pagar
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-brand-deep">
            {formatClp(totales.total_liquido)}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Metric label="Total haberes" value={totales.total_haberes} />
          <Metric label="Total descuentos" value={totales.total_descuentos} tone="muted" />
          <Metric label="Total imponible" value={totales.total_imponible} tone="muted" />
        </div>

        <p className="flex items-start gap-1.5 text-xs text-neutral-mid">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            Por privacidad se muestran solo <strong>totales agregados</strong> del período — sin
            detalle por empleado. Fuente: conector de Remuneraciones (BUK).
          </span>
        </p>
      </div>
    </QavanteCard>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">{label}</p>
      <p
        className={
          "mt-1 text-lg font-semibold tabular-nums " +
          (tone === "muted" ? "text-neutral-mid" : "text-neutral-dark")
        }
      >
        {formatClp(value)}
      </p>
    </div>
  );
}
