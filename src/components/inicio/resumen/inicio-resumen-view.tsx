"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown } from "lucide-react";
import type { BudgetVsActualResponse } from "@/lib/api/planning";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateShort } from "@/lib/formatters/date";
import { periodoLargo } from "@/lib/formatters/months";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { cn } from "@/lib/utils";
import { crumbHoy } from "../v01/hoy-model";
import type { HoyViewProps } from "../v01/hoy-view";
import { LiquidityEvaluationPanel } from "../v01/liquidity-evaluation-panel";
import { CollectionEvaluationPanel } from "../v01/collection-evaluation-panel";
import { CashGapProposalPanel } from "../v01/cash-gap-proposal-panel";
import { DecisionReadPanel } from "../v01/decision-read-panel";
import { InstrumentDecisionPanel } from "../v01/instrument-decision-panel";
import { ActivityLogView } from "../v01/activity-log-view";
import { gastosSobrePresupuesto, resumenCaja } from "./inicio-resumen-model";

const panel = "min-w-0 rounded-2xl border border-border bg-surface p-4 md:rounded-xl md:p-5";
const link =
  "inline-flex min-h-11 items-center rounded-md text-sm font-medium text-brand-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary";
const number =
  "mt-2 break-words text-3xl font-semibold tracking-tight tabular-nums text-neutral-dark";

export interface InicioResumenViewProps extends HoyViewProps {
  credits?: React.ReactNode;
  budget?: BudgetVsActualResponse | null;
  budgetPeriod: string;
  budgetLoading?: boolean;
  budgetFailed?: boolean;
}

export function InicioResumenView(props: InicioResumenViewProps) {
  const { data, hoy = new Date(), budget, budgetPeriod, credits } = props;
  const cash = resumenCaja(data, hoy);
  const crumb = crumbHoy(props.empresa, cash.cash, hoy);
  const evaluation = props.liquidityEvaluation;
  const overBudget =
    props.budgetFailed || budget?.period !== budgetPeriod ? [] : gastosSobrePresupuesto(budget);
  const periodLabel = periodoLargo(budgetPeriod) ?? "el período consultado";
  const liquidityPanel = (
    <LiquidityEvaluationPanel
      evaluation={evaluation ?? null}
      loading={props.liquidityLoading}
      failed={props.liquidityFailed}
      now={hoy}
      canSelect={props.canSelectLiquidity}
      operationPlanRead={props.operationPlanRead}
      operationPlanLoading={props.operationPlanLoading}
      operationPlanError={props.operationPlanError}
      onRetryOperationPlan={props.onRetryOperationPlan}
    />
  );
  const hasPlan =
    !props.operationPlanError &&
    Boolean(props.operationPlanRead?.selection || props.operationPlanRead?.operation_plan);
  const firstAction = data?.priority_actions?.[0];
  const balanceCard = (
    <section className={panel} aria-labelledby="inicio-saldo" key="saldo">
      <h2 id="inicio-saldo" className="text-sm font-medium text-neutral-mid md:text-base">
        Saldo bancario · CLP
      </h2>
      <p className={number}>{cash.cash.monto == null ? "Sin dato" : formatClp(cash.cash.monto)}</p>
      {cash.cash.estado === "estimated" && (
        <p className="mt-2 text-sm text-warning-700">Saldo estimado</p>
      )}
      {credits}
      <Link className={cn(link, "mt-2")} href="/banco">
        Ver cuentas y tarjetas
      </Link>
    </section>
  );
  const projectionCard = (
    <section
      key="proyeccion"
      className={cn(
        panel,
        cash.needsAttention &&
          "border-t-4 border-t-danger-700 shadow-sm md:[&:has(details[open])]:col-span-2",
      )}
      aria-labelledby="inicio-proyeccion"
    >
      <h2 id="inicio-proyeccion" className="text-sm font-medium text-neutral-mid md:text-base">
        {cash.needsAttention ? "Faltante proyectado · CLP" : "Saldo proyectado a 14 días · CLP"}
      </h2>
      <p className={cn(number, cash.needsAttention && "text-danger-700")}>
        {cash.needsAttention
          ? cash.gapAmount == null
            ? "Por confirmar"
            : formatClp(cash.gapAmount)
          : cash.projected == null
            ? "Sin dato"
            : formatClp(cash.projected)}
      </p>
      <p className="mt-2 text-sm text-neutral-mid">
        {cash.needsAttention
          ? "Para evitar un saldo bajo cero en los próximos 14 días."
          : "Después de los cobros y pagos previstos."}
      </p>
      <p
        className={cn(
          "mt-2 text-xs",
          cash.projectionCurrent ? "text-neutral-mid" : "text-warning-700",
        )}
      >
        Horizonte: 14 días ·{" "}
        {data?.cash_gap?.last_updated
          ? `Cálculo del ${formatDateShort(data.cash_gap.last_updated)}`
          : "Sin fecha de cálculo"}
        {!cash.projectionCurrent && " · Proyección pendiente de actualizar"}
      </p>
      <Link className={cn(link, "mt-1")} href="/caja">
        Ver flujo de caja
      </Link>
      {cash.needsAttention && (
        <Disclosure label={hasPlan ? "Ver plan y seguimiento" : "Evaluar decisión"} prominent>
          <p className="text-sm text-neutral-mid">
            Las evaluaciones disponibles tienen su propia fecha, moneda y horizonte. Revisa si
            corresponden a este faltante antes de decidir.
          </p>
          {liquidityPanel}
          <CashGapProposalPanel
            proposals={props.cashGapProposals ?? []}
            loading={props.cashGapProposalsLoading ?? false}
          />
        </Disclosure>
      )}
    </section>
  );

  return (
    <div className="space-y-4" data-testid="inicio-resumen">
      <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-neutral-mid">
        <span>{crumb.fecha}</span>
        <span aria-hidden="true">·</span>
        <span>{crumb.empresa}</span>
        <span aria-hidden="true">·</span>
        <span className={cn(crumb.bancoConReparo && "text-warning-700")}>{crumb.banco}</span>
      </p>
      {cash.noGapReported && (
        <p className="flex items-start gap-2 rounded-lg bg-success-50 px-4 py-3 text-sm text-success-700">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Sin necesidad de caja informada para los próximos 14 días.
        </p>
      )}
      <div className="grid items-start gap-3 md:grid-cols-2 md:gap-4" data-testid="inicio-caja">
        {cash.needsAttention ? [projectionCard, balanceCard] : [balanceCard, projectionCard]}
      </div>

      {!cash.needsAttention && firstAction && (
        <section className={cn(panel, "border-l-4 border-l-brand-primary")}>
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-mid">
            Por revisar
          </p>
          <h2 className="mt-2 text-lg font-medium">{firstAction.reason}</h2>
          <Link className={cn(link, "mt-2")} href={firstAction.cta_href}>
            {firstAction.cta_label}
          </Link>
        </section>
      )}

      {overBudget.map((expense) => (
        <section key={expense.concept} className={cn(panel, "border-l-4 border-l-warning-500")}>
          <p className="text-xs font-medium text-neutral-mid">
            {expense.concept === "direct_cost" ? "Costos directos" : "Gastos"} · {periodLabel} · CLP
          </p>
          <h2 className="mt-2 text-xl font-semibold leading-snug">
            {formatClp(expense.over)}{" "}
            <span className="block text-sm font-normal text-neutral-mid">sobre presupuesto</span>
          </h2>
          <Disclosure label="Ver comparación" compact>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-neutral-mid">Presupuestado</dt>
                <dd className="mt-1 break-words font-medium tabular-nums">
                  {formatClp(expense.budget)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-neutral-mid">Registrado</dt>
                <dd className="mt-1 break-words font-medium tabular-nums">
                  {formatClp(expense.actual)}
                </dd>
              </div>
            </dl>
            <Link href="/presupuesto" className={link}>
              Ver detalle en Presupuesto
            </Link>
          </Disclosure>
        </section>
      ))}

      <div
        className="overflow-hidden rounded-xl border border-border bg-surface"
        data-testid="inicio-detalles"
      >
        <Disclosure label="Revisión operativa" grouped>
          <Link href="/bandeja" className={link}>
            Revisar movimientos
          </Link>
          {(data?.priority_actions?.length ?? 0) > 0 && (
            <ul className="mt-3 divide-y divide-border">
              {data?.priority_actions?.map((action, index) => (
                <li key={`${action.priority}-${index}`} className="py-3">
                  <p className="font-medium">{action.reason}</p>
                  {parseAmountOrNull(action.amount) != null && (
                    <p className="mt-1 tabular-nums">
                      {formatClp(parseAmountOrNull(action.amount)!)}
                    </p>
                  )}
                  <Link className={link} href={action.cta_href}>
                    {action.cta_label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <CollectionEvaluationPanel
            situation={props.collectionSituation ?? null}
            evaluation={props.collectionEvaluation ?? null}
            loading={props.collectionLoading}
            error={props.collectionError}
            scopeAvailable={props.collectionScopeAvailable}
            onRetry={props.onRetryCollection}
          />
        </Disclosure>

        <Disclosure label="Control de decisiones y actividad" grouped>
          {!cash.needsAttention && liquidityPanel}
          {props.decisionLayer && <InstrumentDecisionPanel layer={props.decisionLayer} />}
          {props.decisionReaders && <DecisionReadPanel readers={props.decisionReaders} />}
          <ActivityLogView
            activities={props.activities ?? null}
            loading={props.activitiesLoading}
            error={props.activitiesError}
            onRetry={props.onRetryActivities}
            onUndo={props.onUndoActivity}
            detailLinks
          />
        </Disclosure>

        <Disclosure label="Datos del resumen" grouped>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-neutral-mid">Menor saldo proyectado en 14 días · CLP</dt>
              <dd className="tabular-nums">
                {cash.minimum == null ? "Sin dato" : formatClp(cash.minimum)}
              </dd>
            </div>
            <div>
              <dt className="text-neutral-mid">Actualización de la proyección</dt>
              <dd>
                {data?.cash_gap?.last_updated
                  ? formatDateShort(data.cash_gap.last_updated)
                  : "Sin fecha informada"}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-sm text-neutral-mid">
            El saldo en CLP no incorpora una conversión calculada aquí de cuentas en otras monedas.
            Los cupos de crédito se muestran por separado.
          </p>
          <p className="mt-2 text-sm text-neutral-mid">
            {props.budgetLoading
              ? "Consultando el presupuesto…"
              : props.budgetFailed
                ? "No se pudo consultar el presupuesto."
                : !budget?.has_budget
                  ? `Sin presupuesto informado para ${periodLabel}.`
                  : budget.data_state !== "available" || budget.missing_sources?.length
                    ? "La comparación de presupuesto está incompleta."
                    : `Presupuesto consultado: ${periodLabel}.`}
          </p>
        </Disclosure>
      </div>
    </div>
  );
}

function Disclosure({
  label,
  children,
  prominent = false,
  compact = false,
  grouped = false,
}: {
  label: string;
  children: React.ReactNode;
  prominent?: boolean;
  compact?: boolean;
  grouped?: boolean;
}) {
  return (
    <details
      className={cn(
        "group/disclosure min-w-0 bg-surface",
        grouped ? "border-b border-border last:border-b-0" : "rounded-lg border border-border",
        prominent && "mt-2",
        compact && "mt-3 border-x-0 border-b-0 rounded-none",
      )}
    >
      <summary
        className={cn(
          "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-primary [&::-webkit-details-marker]:hidden",
          prominent && "bg-brand-primary text-white focus-visible:outline-white",
          compact && "px-0 text-brand-primary",
        )}
      >
        {label}
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open/disclosure:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div
        className={cn(
          "min-w-0 space-y-4 border-t border-border p-3 md:p-4",
          compact && "px-0 md:px-0",
        )}
      >
        {children}
      </div>
    </details>
  );
}
