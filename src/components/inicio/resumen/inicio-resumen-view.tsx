"use client";

import * as React from "react";
import { DocumentActionButton } from "@/components/documents/document-actions";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { formatClp } from "@/lib/formatters/clp";
import { parseAmountOrNull } from "@/lib/formatters/amount";
import { cn } from "@/lib/utils";
import { crumbHoy } from "../v01/hoy-model";
import type { HoyViewProps } from "../v01/hoy-view";
import { LiquidityEvaluationPanel } from "../v01/liquidity-evaluation-panel";
import { CollectionEvaluationPanel } from "../v01/collection-evaluation-panel";
import { CashGapProposalPanel } from "../v01/cash-gap-proposal-panel";
import { DecisionReadPanel } from "../v01/decision-read-panel";
import { InstrumentDecisionPanel } from "../v01/instrument-decision-panel";
import { accionesFinancierasInicio, resumenCaja } from "./inicio-resumen-model";

const panel = "min-w-0 rounded-2xl border border-border bg-surface p-5 @3xl:p-6";
const link =
  "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary";

export interface InicioResumenViewProps extends HoyViewProps {
  credits?: React.ReactNode;
  balances?: React.ReactNode;
  /** Cuando el Decision Brief está visible, este resumen conserva evidencia pero no duplica planes. */
  suppressRecommendations?: boolean;
}

export function InicioResumenView(props: InicioResumenViewProps) {
  const { data, hoy = new Date(), credits, balances, suppressRecommendations = false } = props;
  const cash = resumenCaja(data, hoy);
  const crumb = crumbHoy(props.empresa, cash.cash, hoy);
  const [decisionOpen, setDecisionOpen] = React.useState(false);
  const hasPlan = Boolean(
    props.operationPlanRead?.selection || props.operationPlanRead?.operation_plan,
  );
  const showDecision =
    !suppressRecommendations &&
    (cash.needsAttention ||
      hasPlan ||
      Boolean(props.operationPlanError) ||
      props.operationPlanLoading);
  const actions = suppressRecommendations ? [] : accionesFinancierasInicio(data);
  const heroAmount = cash.needsAttention ? cash.gapAmount : cash.minimum;

  return (
    <div className="@container space-y-5" data-testid="inicio-resumen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-neutral-mid">
          <span>{crumb.fecha}</span>
          <span aria-hidden="true">·</span>
          <span>{crumb.empresa}</span>
        </p>
        <Link href="/caja" className={cn(link, "border border-border bg-surface px-4")}>
          Ver caja <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid items-stretch gap-4 @3xl:grid-cols-2" data-testid="inicio-caja">
        <section
          aria-labelledby="inicio-proyeccion"
          className={cn(
            panel,
            "flex flex-col border-t-4",
            cash.needsAttention
              ? "border-t-danger-700"
              : cash.noGapReported
                ? "border-t-success-700"
                : "border-t-warning-500",
          )}
        >
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-mid">
            Próximos 14 días · CLP
          </p>
          <h2
            id="inicio-proyeccion"
            className="mt-3 text-2xl font-semibold tracking-tight text-neutral-dark"
          >
            {cash.needsAttention
              ? "Faltante proyectado"
              : cash.noGapReported
                ? "Pagos cubiertos"
                : "Proyección por confirmar"}
          </h2>
          <p
            className={cn(
              "mt-4 break-words text-4xl font-semibold tracking-tight tabular-nums @3xl:text-5xl",
              cash.needsAttention
                ? "text-danger-700"
                : cash.noGapReported
                  ? "text-success-700"
                  : "text-neutral-dark",
            )}
          >
            {heroAmount == null ? "Sin dato" : formatClp(heroAmount)}
          </p>
          <p className="mt-2 text-sm text-neutral-mid">
            {cash.needsAttention
              ? "Monto faltante para cubrir los pagos previstos."
              : "Menor saldo proyectado en el período."}
          </p>
          {!cash.projectionCurrent && (
            <p className="mt-3 text-sm text-warning-700">Proyección pendiente de actualizar.</p>
          )}
          {!cash.needsAttention && !cash.noGapReported && (
            <p className="mt-2 text-sm text-warning-700">
              No se puede confirmar la cobertura con los datos disponibles.
            </p>
          )}
          <div className="mb-5 mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            {showDecision && (
              <button
                type="button"
                className={primary}
                aria-expanded={decisionOpen}
                aria-controls="inicio-opciones"
                onClick={() => setDecisionOpen(!decisionOpen)}
              >
                {hasPlan || props.operationPlanError || props.operationPlanLoading
                  ? "Ver plan y seguimiento"
                  : "Revisar opciones"}
                <ChevronDown
                  className={cn("size-4", decisionOpen && "rotate-180")}
                  aria-hidden="true"
                />
              </button>
            )}
            <Link href="/caja" className={showDecision ? link : primary}>
              Ver flujo de caja
            </Link>
          </div>
        </section>

        <section aria-labelledby="inicio-saldo" className={cn(panel, "flex flex-col")}>
          <h2 id="inicio-saldo" className="text-2xl font-semibold tracking-tight text-neutral-dark">
            Saldo bancario
          </h2>
          {balances ?? (
            <div className="mt-5">
              <p className="text-xs text-neutral-mid">CLP · Resumen financiero</p>
              <p className="mt-1 break-words text-3xl font-semibold tracking-tight tabular-nums">
                {cash.cash.monto == null ? "Sin dato" : formatClp(cash.cash.monto)}
              </p>
              <p
                className={cn(
                  "mt-2 text-xs",
                  crumb.bancoConReparo ? "text-warning-700" : "text-neutral-mid",
                )}
              >
                {crumb.banco}
              </p>
              {cash.cash.estado === "estimated" && (
                <p className="mt-2 text-sm text-warning-700">Saldo estimado</p>
              )}
            </div>
          )}
          {credits}
          <div className="mt-auto pt-3">
            <Link className={link} href="/banco">
              Ver cuentas y tarjetas <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      {showDecision && (
        <section
          id="inicio-opciones"
          hidden={!decisionOpen}
          className={panel}
          aria-label="Opciones y seguimiento"
        >
          {decisionOpen && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Opciones y seguimiento</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <DocumentActionButton kind="payable" label="Gestionar pagos" />
                <DocumentActionButton kind="receivable" label="Gestionar cobros" />
              </div>
              <p className="text-sm text-neutral-mid">
                Revisa la fecha, moneda y plazo de cada evaluación antes de decidir.
              </p>
              <LiquidityEvaluationPanel
                evaluation={props.liquidityEvaluation ?? null}
                loading={props.liquidityLoading}
                failed={props.liquidityFailed}
                now={hoy}
                canSelect={props.canSelectLiquidity}
                operationPlanRead={props.operationPlanRead}
                operationPlanLoading={props.operationPlanLoading}
                operationPlanError={props.operationPlanError}
                onRetryOperationPlan={props.onRetryOperationPlan}
              />
              <CashGapProposalPanel
                proposals={props.cashGapProposals ?? []}
                loading={props.cashGapProposalsLoading ?? false}
              />
              {props.collectionScopeAvailable && (
                <CollectionEvaluationPanel
                  situation={props.collectionSituation ?? null}
                  evaluation={props.collectionEvaluation ?? null}
                  loading={props.collectionLoading}
                  error={props.collectionError}
                  scopeAvailable={props.collectionScopeAvailable}
                  onRetry={props.onRetryCollection}
                />
              )}
              {(props.decisionLayer || props.decisionReaders) && (
                <InicioDisclosure label="Ver otras evaluaciones">
                  {props.decisionLayer && <InstrumentDecisionPanel layer={props.decisionLayer} />}
                  {props.decisionReaders && <DecisionReadPanel readers={props.decisionReaders} />}
                </InicioDisclosure>
              )}
            </div>
          )}
        </section>
      )}

      {actions.length > 0 && (
        <section className={panel} aria-labelledby="inicio-atencion">
          <h2 id="inicio-atencion" className="text-lg font-semibold">
            Requiere atención
          </h2>
          <ul className="mt-2 divide-y divide-border">
            {actions.map((action, index) => {
              const amount = parseAmountOrNull(action.amount);
              return (
                <li
                  key={`${[action.cta_href, action.reason, action.deadline].join("|")}-${index}`}
                  className="grid min-w-0 gap-3 py-4 @3xl:grid-cols-[1fr_auto] @3xl:items-center"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium">{action.reason}</p>
                    {action.deadline && (
                      <p className="mt-1 text-sm text-neutral-mid">{action.deadline}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-1">
                    {amount != null && (
                      <p className="break-words text-lg font-semibold tabular-nums">
                        {formatClp(amount)}
                      </p>
                    )}
                    <Link href={action.cta_href} className={link}>
                      {action.cta_label} <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

export function InicioDisclosure({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group/disclosure min-w-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-3 text-sm font-medium text-brand-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          className="size-4 shrink-0 transition-transform group-open/disclosure:rotate-180 motion-reduce:transition-none"
          aria-hidden="true"
        />
      </summary>
      <div className="min-w-0 space-y-3 border-t border-border py-3">{children}</div>
    </details>
  );
}
