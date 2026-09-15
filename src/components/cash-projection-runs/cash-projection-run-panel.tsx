"use client";

import * as React from "react";
import {
  useCashProjectionRun,
  type CashProjectionScenario,
  type CashProjectionScenarioId,
} from "@/lib/api/cash-projection-runs";
import {
  DEFAULT_SCENARIO,
  SCENARIO_LABELS,
  formatContractMoney,
  dateInSantiago,
  selectProjectionSnapshot,
} from "./cash-projection-run-model";

export interface CashProjectionRunPanelProps {
  horizonDays: 14 | 90;
  title?: string;
  onSnapshot?: (snapshot: ReturnType<typeof selectProjectionSnapshot>) => void;
}

/* El contrato publica `eligible`/`abstain`: en pantalla va el significado, no el código. */
const DECISION_SUPPORT_LABEL: Record<"eligible" | "abstain", string> = {
  eligible: "sirve para decidir",
  abstain: "no sustenta una decisión",
};

export function CashProjectionRunPanel({
  horizonDays,
  title = "Proyección de caja",
  onSnapshot,
}: CashProjectionRunPanelProps) {
  const query = useCashProjectionRun(horizonDays);
  const santiagoDay = useSantiagoDay();
  const [scenarioId, setScenarioId] = React.useState<CashProjectionScenarioId>(DEFAULT_SCENARIO);
  const run = query.data;
  const snapshot = React.useMemo(
    () =>
      run
        ? selectProjectionSnapshot(
            run,
            {
              runId: run.projection_run_id,
              calculationVersion: run.calculation_version,
              scenarioId,
            },
            santiagoDay,
          )
        : null,
    [run, scenarioId, santiagoDay],
  );

  React.useEffect(() => onSnapshot?.(snapshot), [onSnapshot, snapshot]);

  if (query.tenantLoading || query.isLoading) {
    return (
      <section
        className="rounded-xl border border-border bg-surface p-4"
        aria-busy="true"
        role="status"
      >
        <p className="text-sm text-neutral-mid">Creando una foto coherente de tu caja…</p>
      </section>
    );
  }
  if (query.isError || !snapshot) {
    return (
      <section className="rounded-xl border border-warning-500/30 bg-warning-50 p-4" role="status">
        <h2 className="text-sm font-bold text-neutral-dark">{title}</h2>
        <p className="mt-1 text-sm text-neutral-mid">
          Proyección no disponible. No mostramos $0 ni inferimos cobertura con datos parciales.
        </p>
        <button
          className="mt-3 text-sm font-semibold text-brand-primary"
          onClick={() => void query.refetch()}
        >
          Reintentar
        </button>
      </section>
    );
  }

  const { scenario } = snapshot;
  const stateCopy =
    snapshot.state === "current"
      ? "Datos vigentes"
      : snapshot.state === "stale"
        ? "Datos atrasados"
        : "Cobertura parcial · no usar para decidir";

  return (
    <section
      className="space-y-4 rounded-xl border border-border bg-surface p-4"
      data-projection-run={snapshot.runId}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-neutral-dark">{title}</h2>
          <p className="mt-1 text-xs text-neutral-mid">
            Al {snapshot.asOf} · {snapshot.horizonDays} días · {snapshot.currency} · {stateCopy}
          </p>
        </div>
        <label className="text-xs font-semibold text-neutral-mid">
          Escenario
          <select
            className="ml-2 rounded-md border border-border bg-surface px-2 py-1 text-neutral-dark"
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value as CashProjectionScenarioId)}
          >
            {snapshot.scenario &&
              (run?.scenarios ?? []).map((item) => (
                <option key={item.scenario_id} value={item.scenario_id}>
                  {SCENARIO_LABELS[item.scenario_id]}
                </option>
              ))}
          </select>
        </label>
        <button
          className="text-xs font-semibold text-brand-primary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Creando nueva foto…" : "Crear nueva foto"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Saldo final"
          value={formatContractMoney(scenario.ending_cash, snapshot.currency)}
        />
        <Metric
          label={`Mínimo · ${scenario.minimum_cash_date}`}
          value={formatContractMoney(scenario.minimum_cash, snapshot.currency)}
        />
        <Metric
          label="Brecha contra cero"
          value={formatContractMoney(scenario.gap_against_zero, snapshot.currency)}
        />
      </div>

      <div className="grid gap-3 text-xs text-neutral-mid sm:grid-cols-2">
        <div>
          <p className="font-semibold text-neutral-dark">Puente del escenario</p>
          <p>
            {scenario.bridge.component_count} componentes publicados por el servidor · soporte de
            decisión: {DECISION_SUPPORT_LABEL[scenario.bridge.coverage.decision_support]}
          </p>
          <p>Válido hasta: {scenario.bridge.coverage.coverage_valid_through ?? "no informado"}</p>
          <BridgeComponents scenario={scenario} />
        </div>
        <div>
          <p className="font-semibold text-neutral-dark">Exclusiones declaradas</p>
          {scenario.exclusions.length === 0 ? (
            <p>Ninguna exclusión declarada.</p>
          ) : (
            <>
              <ExclusionList items={scenario.exclusions.slice(0, 5)} />
              {scenario.exclusions.length > 5 && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold text-brand-primary">
                    Ver {scenario.exclusions.length - 5} más
                  </summary>
                  <ExclusionList items={scenario.exclusions.slice(5)} />
                </details>
              )}
            </>
          )}
        </div>
      </div>

      <p className="break-all text-[10px] text-neutral-mid">
        Run {snapshot.runId} · {snapshot.calculationVersion} · escenario {scenario.scenario_id}
      </p>
    </section>
  );
}

/** Invalida la presentación al cambiar el día civil chileno, incluso sin nueva respuesta HTTP. */
export function useSantiagoDay(): string {
  const [day, setDay] = React.useState(() => dateInSantiago(new Date()));
  React.useEffect(() => watchSantiagoDay(setDay), []);
  return day;
}

export function watchSantiagoDay(onChange: (day: string) => void): () => void {
  let previous = dateInSantiago(new Date());
  const timer = globalThis.setInterval(() => {
    const current = dateInSantiago(new Date());
    if (current !== previous) {
      previous = current;
      onChange(current);
    }
  }, 15_000);
  return () => globalThis.clearInterval(timer);
}

type BridgeComponent = CashProjectionScenario["bridge"]["components"][number];
type Exclusion = CashProjectionScenario["exclusions"][number];

function BridgeComponents({ scenario }: { scenario: CashProjectionScenario }) {
  const items = scenario.bridge.components;
  return (
    <details className="mt-2">
      <summary className="cursor-pointer font-semibold text-brand-primary">
        Abrir {items.length} componentes del puente
      </summary>
      {items.length === 0 ? (
        <p className="mt-1">El servidor no publicó componentes para este escenario.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item) => (
            <li key={item.component_key} className="rounded-md border border-border p-2">
              <ComponentEvidence item={item} />
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function ComponentEvidence({ item }: { item: BridgeComponent }) {
  return (
    <div className="space-y-1">
      <p className="font-semibold text-neutral-dark">
        {item.direction === "inflow" ? "Entrada" : "Salida"} · {item.component_key}
      </p>
      <p>
        Impacto {item.impact_date} · fuente {item.source_ref}
      </p>
      <p>{formatContractMoney(item.functional_amount, item.currency)}</p>
      <p className="break-all">Evidencia {item.evidence_ref}</p>
    </div>
  );
}

function ExclusionList({ items }: { items: Exclusion[] }) {
  return (
    <ul className="mt-1 space-y-2">
      {items.map((item) => (
        <li
          key={`${item.source_ref}:${item.reason}`}
          className="rounded-md border border-border p-2"
        >
          <p className="font-semibold text-neutral-dark">
            {item.reason} · {item.cash_relevant ? "relevante para caja" : "informativa"}
          </p>
          <p>
            Fuente {item.source_ref} · escenarios {item.scenario_ids.join(", ")}
          </p>
        </li>
      ))}
    </ul>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <p className="text-xs font-semibold text-neutral-mid">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-neutral-dark">{value}</p>
    </div>
  );
}
