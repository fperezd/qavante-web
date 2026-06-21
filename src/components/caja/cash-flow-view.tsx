"use client";

import * as React from "react";
import { Banknote } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import {
  defaultCashFlowRange,
  useCashFlowReport,
  type CashFlowReportParams,
} from "@/lib/api/treasury-reports";
import { CashFlowFilters } from "./cash-flow-filters";
import { CashFlowTable } from "./cash-flow-table";

/* Orquestador del cash flow report. Combina filtros + query + estados
   (loading / error / empty / data). Defaults a 3 meses desde hoy con
   granularity=week (≈13 semanas) y financial_layer=committed (real, no
   proyectado — alineado a addendum frontend-v2 §25.3). */
export function CashFlowView() {
  const [params, setParams] = React.useState<CashFlowReportParams>(() => ({
    ...defaultCashFlowRange(),
    granularity: "week",
    financial_layer: "committed",
  }));

  const query = useCashFlowReport(params);

  const empty = query.data && (query.data.buckets ?? []).length === 0;

  return (
    <div className="space-y-4">
      <CashFlowFilters value={params} onChange={setParams} loading={query.isFetching} />

      {query.isLoading && (
        <div
          className="h-32 animate-pulse rounded-xl bg-neutral-light/30"
          aria-busy="true"
          aria-label="Cargando reporte de caja"
        />
      )}

      {query.isError && <QavanteInlineError error={query.error} what="el reporte de caja" />}

      {empty && (
        <QavanteEmpty
          icon={Banknote}
          title="Sin datos en este rango"
          description="No hay financial impacts clasificados para el rango y la capa elegidos. Prueba con otro rango, otra granularidad u otra capa."
        />
      )}

      {query.data && (query.data.buckets ?? []).length > 0 && <CashFlowTable data={query.data} />}
    </div>
  );
}
