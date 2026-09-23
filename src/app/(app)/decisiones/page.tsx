"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { QavanteCard, QavanteInlineError } from "@/components/qavante";
import { useCompanyScope } from "@/components/shell/company-scope";
import { useCashProjectionRun, scenarioFromRun } from "@/lib/api/cash-projection-runs";
import { formatMoneyFromDecimalString } from "@/lib/formatters/clp";
import { formatDateLong } from "@/lib/formatters/date";

const HORIZONS = [7, 14, 30, 60, 90] as const;

function addDays(raw: string | undefined, days: number) {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const date = new Date(`${raw}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(amount: string | undefined, currency: string | undefined) {
  return formatMoneyFromDecimalString(amount, currency) ?? "Dato pendiente";
}

function isNegative(amount: string | undefined) {
  return typeof amount === "string" && /^-/.test(amount.trim()) && amount.trim() !== "-0";
}

export default function DecisionesPage() {
  const [horizon, setHorizon] = useState<(typeof HORIZONS)[number]>(14);
  const companyScope = useCompanyScope();
  const selectedCompanyId = companyScope.activeCompanyId;
  const selectedCompany = companyScope.activeCompany;

  const projection = useCashProjectionRun(horizon, Boolean(selectedCompanyId), selectedCompanyId);
  const scenario = scenarioFromRun(projection.data, "scheduled_expected_v1");
  const currency = projection.data?.currency;
  const endDate = addDays(projection.data?.as_of, horizon);
  const hasGap = isNegative(scenario?.gap_against_zero);
  const projectionError = projection.error ?? projection.scopeError;

  return (
    <main className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col gap-4 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">
            Decisiones de caja
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-neutral-dark">
            Anticipa. Decide. Avanza.
          </h1>
          <p className="mt-2 text-base text-neutral-mid">
            Entiende el punto de partida y qué necesitas validar.
          </p>
        </div>
      </header>

      {Boolean(companyScope.error) && (
        <QavanteInlineError
          error={companyScope.error}
          what="las empresas"
          onRetry={companyScope.refresh}
        />
      )}
      {!companyScope.isLoading && !companyScope.companies.length && (
        <QavanteCard>
          <p className="font-semibold text-neutral-dark">
            No hay una Empresa disponible para evaluar.
          </p>
        </QavanteCard>
      )}

      {selectedCompanyId && (
        <>
          <section
            aria-label="Horizonte de decisión"
            className="rounded-2xl border border-border bg-surface p-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Horizonte">
                {HORIZONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setHorizon(days)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${horizon === days ? "bg-brand-deep text-white" : "text-neutral-mid hover:bg-surface-muted hover:text-neutral-dark"}`}
                  >
                    {days} días
                  </button>
                ))}
              </div>
              <p className="text-sm text-neutral-mid">
                {projection.data
                  ? `${formatDateLong(projection.data.as_of)} — ${formatDateLong(endDate)}`
                  : "Calculando período"}
              </p>
            </div>
          </section>

          {projectionError && (
            <QavanteInlineError
              error={projectionError}
              what="la caja de esta Empresa"
              onRetry={() => projection.refetch()}
            />
          )}
          {projection.isLoading && (
            <QavanteCard>
              <p className="text-neutral-mid">
                Preparando la posición de caja de {selectedCompany?.legal_name ?? "la Empresa"}…
              </p>
            </QavanteCard>
          )}

          {scenario && (
            <>
              <section
                className={`rounded-2xl border p-5 ${hasGap ? "border-danger-500/35 bg-danger-50/40" : "border-success-500/35 bg-success-50/30"}`}
                aria-labelledby="position-title"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-neutral-mid">
                      {selectedCompany?.legal_name}
                    </p>
                    <h2 id="position-title" className="mt-1 text-xl font-bold text-neutral-dark">
                      {hasGap
                        ? `Saldo proyectado mínimo ${money(scenario.minimum_cash, currency)}`
                        : `Caja cubierta hasta ${formatDateLong(endDate)}`}
                    </h2>
                    <p className="mt-1 text-sm text-neutral-mid">
                      {hasGap
                        ? `Se alcanza el ${formatDateLong(scenario.minimum_cash_date)}.`
                        : "Escenario programado con fuentes vigentes."}
                    </p>
                  </div>
                  {hasGap && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-danger-500/10 px-3 py-1.5 text-sm font-semibold text-danger-700">
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      Requiere decisión
                    </span>
                  )}
                </div>
                <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric label="Saldo hoy" value={money(scenario.opening_cash, currency)} />
                  <Metric
                    label="Saldo mínimo"
                    value={money(scenario.minimum_cash, currency)}
                    detail={formatDateLong(scenario.minimum_cash_date)}
                    negative={isNegative(scenario.minimum_cash)}
                  />
                  <Metric
                    label={`Saldo al ${formatDateLong(endDate)}`}
                    value={money(scenario.ending_cash, currency)}
                    negative={isNegative(scenario.ending_cash)}
                  />
                </dl>
              </section>

              <section
                className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"
                aria-label="Próxima decisión"
              >
                <QavanteCard
                  className="border-brand-primary/25"
                  header="Alternativas para esta necesidad"
                >
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-mid">
                      Las alternativas se calculan sobre esta Empresa, este período y los documentos
                      disponibles. Puedes combinar operaciones; nada se ejecuta desde aquí.
                    </p>
                    <button
                      type="button"
                      disabled
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-muted/40 px-4 py-3 text-left opacity-65"
                    >
                      <span>
                        <span className="block font-semibold text-neutral-dark">
                          Propuestas de cobertura
                        </span>
                        <span className="mt-0.5 block text-sm text-neutral-mid">
                          Se habilitan cuando estén publicados los documentos, líneas y cotizaciones
                          vigentes.
                        </span>
                      </span>
                      <ArrowRight className="h-5 w-5 text-brand-primary" aria-hidden="true" />
                    </button>
                  </div>
                </QavanteCard>
                <QavanteCard header="Alcance de esta lectura">
                  <dl className="space-y-3 text-sm">
                    <Fact label="Empresa" value={selectedCompany?.legal_name ?? "Dato pendiente"} />
                    <Fact label="Moneda funcional" value={currency ?? "Dato pendiente"} />
                    <Fact label="Corte" value={formatDateLong(projection.data?.as_of)} />
                  </dl>
                </QavanteCard>
              </section>
            </>
          )}
        </>
      )}
    </main>
  );
}

function Metric({
  label,
  value,
  detail,
  negative,
}: {
  label: string;
  value: string;
  detail?: string;
  negative?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="text-sm text-neutral-mid">{label}</dt>
      <dd
        className={`mt-1 text-xl font-bold tabular-nums ${negative ? "text-danger-700" : "text-neutral-dark"}`}
      >
        {value}
      </dd>
      {detail && <p className="mt-1 text-xs text-neutral-mid">{detail}</p>}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-neutral-mid">{label}</dt>
      <dd className="text-right font-semibold text-neutral-dark">{value}</dd>
    </div>
  );
}
