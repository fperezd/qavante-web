"use client";

import { useDashboardSummary } from "@/lib/api/dashboard";
import { useFinancialScope, toFinancialDecisionReadScope } from "@/lib/api/financial-scope";
import { useOperationalResultV2, type OperationalResultV2Response } from "@/lib/api/gestion";
import { formatMoney } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";

function money(value: string): string {
  const amount = parseAmountOrNull(value);
  return amount === null ? "Sin dato" : formatMoney(amount, "CLP");
}

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

export function OperationalResultV2Panel() {
  const dashboard = useDashboardSummary();
  const scope = useFinancialScope(dashboard.data?.generated_at);
  const decisionScope = toFinancialDecisionReadScope(scope.data);
  const result = useOperationalResultV2(decisionScope);

  if (dashboard.isLoading || scope.isLoading || result.isLoading) {
    return (
      <section className="rounded-xl border border-border bg-surface p-4" role="status">
        <p className="text-sm text-neutral-mid">Preparando el resultado operacional verificable…</p>
      </section>
    );
  }

  if (dashboard.isError || scope.isError || result.isError || !result.data) {
    return (
      <section
        className="rounded-xl border border-warning-500/30 bg-warning-500/5 p-4"
        role="status"
      >
        <h2 className="font-semibold text-neutral-dark">Resultado operacional</h2>
        <p className="mt-1 text-sm text-neutral-mid">
          No está disponible para este corte. Conservamos el detalle histórico, pero no afirmamos
          una cifra con información incompleta.
        </p>
      </section>
    );
  }

  return <OperationalResultV2View response={result.data} />;
}

export function OperationalResultV2View({ response }: { response: OperationalResultV2Response }) {
  const statement = response.statement_v2;
  if (!statement) {
    return (
      <section
        className="rounded-xl border border-warning-500/30 bg-warning-500/5 p-4"
        role="status"
      >
        <h2 className="font-semibold text-neutral-dark">Resultado operacional</h2>
        <p className="mt-1 text-sm text-neutral-mid">
          Qavante se abstuvo de publicar el resultado porque las fuentes requeridas no acreditan una
          lectura completa para este corte.
        </p>
      </section>
    );
  }

  const eligible =
    response.coverage.decision_support === "eligible" &&
    statement.coverage.decision_support === "eligible";

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
      aria-labelledby="resultado-v2-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-mid">
            Una definición para toda Qavante
          </p>
          <h2 id="resultado-v2-title" className="mt-1 text-lg font-semibold text-neutral-dark">
            Resultado operacional
          </h2>
          <p className="mt-1 text-sm text-neutral-mid">
            {statement.scope.period_from} a {statement.scope.period_to} · base devengada · CLP
          </p>
        </div>
        <span className="rounded-full bg-neutral-light px-3 py-1 text-xs font-semibold text-neutral-dark">
          {eligible ? "Apto para decidir" : "Parcial · no usar para decidir"}
        </span>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Ingresos" value={money(statement.revenue)} />
        <Metric label="Costo Directo" value={money(statement.direct_cost.total)} />
        <Metric label="Gastos operacionales" value={money(statement.recurring_expenses)} />
        <Metric
          label="Resultado antes de gastos financieros"
          value={money(statement.result_before_financial)}
        />
      </dl>

      <div className="rounded-lg border border-border p-3">
        <h3 className="text-sm font-semibold text-neutral-dark">Qué incluye Costo Directo</h3>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <Metric label="Base" value={money(statement.direct_cost.base)} compact />
          <Metric
            label="Remuneraciones"
            value={money(statement.direct_cost.remunerations)}
            compact
          />
          <Metric
            label="Honorarios"
            value={money(statement.direct_cost.professional_fees)}
            compact
          />
        </dl>
        <p className="mt-2 text-xs text-neutral-mid">
          La base contiene compras asociadas a la entrega y trabajo directo. Remuneraciones y
          honorarios se muestran aparte y se suman una sola vez.
        </p>
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Compras sin clasificar"
          value={money(statement.unclassified_purchases)}
          compact
        />
        <Metric
          label="Otras partidas sin clasificar"
          value={money(statement.unclassified)}
          compact
        />
        <Metric label="Gastos financieros" value={money(statement.financial_expense)} compact />
        <Metric label="Resultado final" value={money(statement.result_after_financial)} compact />
      </div>

      {statement.source_coverage.length > 0 && (
        <ul
          className="flex flex-wrap gap-2 text-xs text-neutral-mid"
          aria-label="Cobertura de fuentes"
        >
          {statement.source_coverage.map((source, index) => (
            <li
              key={`${source.source}-${index}`}
              className="rounded-full border border-border px-2 py-1"
            >
              {sourceLabel(source.source)}: {SOURCE_STATE_LABELS[source.state]}
            </li>
          ))}
        </ul>
      )}
      {statement.coverage.omitted_count > 0 && (
        <p className="text-sm text-warning-700" role="status">
          {statement.coverage.omitted_count}{" "}
          {statement.coverage.omitted_count === 1 ? "partida quedó" : "partidas quedaron"} fuera por
          falta de conversión verificable; no se reemplazaron por $0.
        </p>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact ? "rounded-lg bg-neutral-light/30 p-2" : "rounded-lg bg-neutral-light/30 p-3"
      }
    >
      <dt className="text-xs text-neutral-mid">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-neutral-dark">{value}</dd>
    </div>
  );
}
