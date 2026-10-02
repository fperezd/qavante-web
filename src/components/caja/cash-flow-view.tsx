"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Banknote } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import {
  defaultCashFlowRange,
  useCashFlowReport,
  type CashFlowReportParams,
  type CashFlowReportResponse,
} from "@/lib/api/treasury-reports";
import { avisosDelReporte, cashFlowQuickRanges } from "./cash-flow-format";
import { CashFlowFilters } from "./cash-flow-filters";
import { CashFlowNetSummary } from "./cash-flow-net-summary";
import { CashFlowTable } from "./cash-flow-table";

/* Orquestador del cash flow report. Combina filtros + query + estados
   (loading / error / empty / data). Defaults a 3 meses desde hoy con
   granularity=week (≈13 semanas) y financial_layer=committed (real, no
   proyectado — alineado a addendum frontend-v2 §25.3).

   `rango` elige el default: "proyeccion" (mes en curso + el siguiente, lo
   que ya está comprometido hacia adelante) o "historico" (los últimos tres
   meses cerrados hasta hoy). Una lectura de lo que YA pasó no puede partir
   mostrando meses futuros. */
export function CashFlowView({ rango = "proyeccion" }: { rango?: "proyeccion" | "historico" }) {
  const [params, setParams] = React.useState<CashFlowReportParams>(() => {
    if (rango === "historico") {
      const trimestre = cashFlowQuickRanges().find((r) => r.key === "trimestre");
      if (trimestre) {
        return {
          period_from: trimestre.period_from,
          period_to: trimestre.period_to,
          granularity: trimestre.granularity,
          financial_layer: "committed",
        };
      }
    }
    return {
      ...defaultCashFlowRange(),
      granularity: "week",
      financial_layer: "committed",
    };
  });

  const query = useCashFlowReport(params);

  const empty = Boolean(query.data && (query.data.buckets ?? []).length === 0);

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

      {empty && query.data && <CashFlowSinMovimientos data={query.data} />}

      {query.data && (query.data.buckets ?? []).length > 0 && (
        <>
          <CashFlowNetSummary data={query.data} />
          <CashFlowTable data={query.data} />
        </>
      )}
    </div>
  );
}

/* Estado del período que vuelve sin un solo bucket. Presentacional y exportado a propósito:
   es el estado que más fácil miente, así que se renderiza en un test sin montar la query.

   Dos cosas que antes faltaban:

   1. DECLARA LAS EXCLUSIONES. Con cero buckets la tabla no se renderiza, y con ella se iba el
      único lugar que declaraba lo que el reporte dejó fuera (moneda sin procedencia verificada,
      filas con clasificación por revisar). Un período que quedó vacío PORQUE se excluyó todo
      se veía igual que un período sin movimientos: la ausencia pasaba por hecho del negocio.

   2. TERMINA EN UNA ACCIÓN. El texto anterior ("Sin datos en este rango") cerraba la pantalla
      sin decir qué hacer. Lo que mueve la aguja es ampliar el período o darle categoría a los
      movimientos pendientes, así que eso es lo que se ofrece. */
export function CashFlowSinMovimientos({ data }: { data: CashFlowReportResponse }) {
  const avisos = avisosDelReporte(data);
  const porRevisar = data.excluded_attention ?? 0;

  return (
    <div className="space-y-3">
      {(avisos.length > 0 || porRevisar > 0) && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-warning-700/30 bg-warning-700/5 p-3 text-xs text-warning-700"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <ul className="space-y-1">
            {avisos.map((aviso, i) => (
              <li key={i}>{aviso}</li>
            ))}
            {porRevisar > 0 && (
              <li>
                {porRevisar === 1
                  ? "1 movimiento del período quedó fuera del cálculo porque su clasificación necesita revisión."
                  : `${porRevisar} movimientos del período quedaron fuera del cálculo porque su clasificación necesita revisión.`}
              </li>
            )}
          </ul>
        </div>
      )}
      <QavanteEmpty
        icon={Banknote}
        title="Amplía el período o clasifica movimientos para ver este flujo"
        description="El flujo se arma con los movimientos bancarios que ya tienen categoría en la capa elegida. Prueba «Últimos 6 meses» o «Este año», o dale categoría a los movimientos pendientes para que entren al cálculo."
        cta={
          <Link
            href="/caja/por-clasificar"
            className="inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            Clasificar movimientos
          </Link>
        }
      />
    </div>
  );
}
