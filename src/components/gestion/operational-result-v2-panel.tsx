"use client";

import { useDashboardSummary } from "@/lib/api/dashboard";
import { useFinancialScope, toFinancialDecisionReadScope } from "@/lib/api/financial-scope";
import { useOperationalResultV2, type OperationalResultV2Response } from "@/lib/api/gestion";
import { RESULTADO_HORIZONTE } from "@/lib/gestion-titulos";
import { formatPeriodLabel } from "./gestion-format";
import {
  money,
  ResultadoBloque,
  ResultadoBloqueAbstenido,
  ResultadoDesgloseCostoDirecto,
  ResultadoFuentes,
  ResultadoMetric,
  ResultadoMetricRow,
  ResultadoMetricRowCompact,
} from "./resultado-bloque";

/* Bloque del HORIZONTE de /gestion.
 *
 * `GET /api/management/operational-result/v2` NO mira lo corrido: arma el período de `as_of+1`
 * a `as_of+horizon_days` (el hook pide 90), así que abierto el 4 de octubre de 2026 cubre
 * oct 2026 a ene 2027. Por eso dejó de titularse "Resultado operacional" — ese nombre quedó
 * para el bloque de lo corrido — y pasó a `RESULTADO_HORIZONTE`. El rango sigue publicándose
 * bajo el título, como ya lo hacía.
 *
 * El diseño (tarjetas, espaciado, chip) salió a `./resultado-bloque` SIN cambios, para que el
 * bloque de lo corrido lo reuse. */

const TITULO_ID = "resultado-horizonte-title";

function sourceLabel(source: string): string {
  const normalized = source.toLowerCase();
  if (normalized.includes("rcv") && normalized.includes("sale")) return "Ventas del SII";
  if (normalized.includes("rcv") && normalized.includes("purchase")) return "Compras del SII";
  if (normalized.includes("payroll")) return "Remuneraciones";
  if (normalized.includes("bhe") || normalized.includes("honor")) return "Honorarios";
  return "Fuente requerida";
}

const SOURCE_STATE_LABELS = {
  current: "vigente",
  missing: "faltante",
  stale: "atrasada",
  partial: "parcial",
  error: "con error",
} as const;

/** "2026-10" a "2027-01" → "oct 2026 a ene 2027". El scope del V2 trae `YYYY-MM`
 *  (`operational_result_v2.py` lo arma así), no fechas completas. */
export function rangoHorizonte(periodFrom: string, periodTo: string): string {
  const desde = formatPeriodLabel(periodFrom);
  const hasta = formatPeriodLabel(periodTo);
  const rango = desde === hasta ? desde : `${desde} a ${hasta}`;
  return `${rango} · base devengada · CLP`;
}

export function OperationalResultV2Panel() {
  const dashboard = useDashboardSummary();
  const scope = useFinancialScope(dashboard.data?.generated_at);
  const decisionScope = toFinancialDecisionReadScope(scope.data);
  const result = useOperationalResultV2(decisionScope);

  if (dashboard.isLoading || scope.isLoading || result.isLoading) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4" role="status">
        <p className="text-sm text-neutral-mid">Preparando {RESULTADO_HORIZONTE.toLowerCase()}…</p>
      </section>
    );
  }

  if (dashboard.isError || scope.isError || result.isError || !result.data) {
    return (
      <ResultadoBloqueAbstenido titulo={RESULTADO_HORIZONTE} tituloId={TITULO_ID}>
        Qavante se abstiene de publicar una cifra del tramo que viene mientras las fuentes
        requeridas no acrediten una lectura completa. Revisa el estado de las fuentes en Salud del
        dato y vuelve a abrir este bloque cuando estén al día.
      </ResultadoBloqueAbstenido>
    );
  }

  return <OperationalResultV2View response={result.data} />;
}

export function OperationalResultV2View({ response }: { response: OperationalResultV2Response }) {
  const statement = response.statement_v2;
  if (!statement) {
    return (
      <ResultadoBloqueAbstenido
        titulo={RESULTADO_HORIZONTE}
        periodo={rangoHorizonte(response.scope.period_from, response.scope.period_to)}
        tituloId={TITULO_ID}
      >
        Qavante se abstuvo de publicar el tramo que viene porque las fuentes requeridas no acreditan
        una lectura completa para este corte. Revisa el estado de las fuentes en Salud del dato y
        vuelve a abrir este bloque cuando estén al día.
      </ResultadoBloqueAbstenido>
    );
  }

  const eligible =
    response.coverage.decision_support === "eligible" &&
    statement.coverage.decision_support === "eligible";

  return (
    <ResultadoBloque
      titulo={RESULTADO_HORIZONTE}
      eyebrow="Una definición para toda Qavante"
      periodo={rangoHorizonte(statement.scope.period_from, statement.scope.period_to)}
      apto={eligible}
      tituloId={TITULO_ID}
    >
      <ResultadoMetricRow>
        <ResultadoMetric label="Ingresos" value={money(statement.revenue)} />
        <ResultadoMetric label="Costo Directo" value={money(statement.direct_cost.total)} />
        <ResultadoMetric label="Gastos operacionales" value={money(statement.recurring_expenses)} />
        <ResultadoMetric
          label="Resultado antes de gastos financieros"
          value={money(statement.result_before_financial)}
        />
      </ResultadoMetricRow>

      <ResultadoDesgloseCostoDirecto
        base={money(statement.direct_cost.base)}
        remuneraciones={money(statement.direct_cost.remunerations)}
        honorarios={money(statement.direct_cost.professional_fees)}
        nota="La base contiene compras asociadas a la entrega y trabajo directo. Remuneraciones y honorarios se muestran aparte y se suman una sola vez."
      />

      <ResultadoMetricRowCompact>
        <ResultadoMetric
          label="Compras sin clasificar"
          value={money(statement.unclassified_purchases)}
          compact
        />
        <ResultadoMetric
          label="Otras partidas sin clasificar"
          value={money(statement.unclassified)}
          compact
        />
        <ResultadoMetric
          label="Gastos financieros"
          value={money(statement.financial_expense)}
          compact
        />
        <ResultadoMetric
          label="Resultado final"
          value={money(statement.result_after_financial)}
          compact
        />
      </ResultadoMetricRowCompact>

      <ResultadoFuentes
        items={statement.source_coverage.map(
          (source) => `${sourceLabel(source.source)}: ${SOURCE_STATE_LABELS[source.state]}`,
        )}
      />
      {statement.coverage.omitted_count > 0 && (
        <p className="text-sm text-warning-700" role="status">
          {statement.coverage.omitted_count}{" "}
          {statement.coverage.omitted_count === 1 ? "partida quedó" : "partidas quedaron"} fuera por
          falta de conversión verificable; no se reemplazaron por $0.
        </p>
      )}
    </ResultadoBloque>
  );
}
