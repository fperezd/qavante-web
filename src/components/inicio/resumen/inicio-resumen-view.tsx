"use client";

import * as React from "react";
import { DocumentActionButton } from "@/components/documents/document-actions";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown } from "lucide-react";
import { formatClp } from "@/lib/formatters/clp";
import { cn } from "@/lib/utils";
import { crumbHoy } from "../v01/hoy-model";
import type { HoyViewProps } from "../v01/hoy-view";
import { LiquidityEvaluationPanel } from "../v01/liquidity-evaluation-panel";
import { CollectionEvaluationPanel } from "../v01/collection-evaluation-panel";
import { CashGapProposalPanel } from "../v01/cash-gap-proposal-panel";
import { DecisionReadPanel } from "../v01/decision-read-panel";
import { InstrumentDecisionPanel } from "../v01/instrument-decision-panel";
import type { CashProjectionViewModel } from "@/components/cash-projection-runs/cash-projection-run-model";
import { resumenCaja } from "./inicio-resumen-model";
import { isLocalDevAppEnv } from "@/lib/app-env";
import { InicioMaquetaSecciones } from "./inicio-maqueta-secciones";
import { InicioSeccionSeparador } from "./inicio-seccion-separador";

const panel = "min-w-0 rounded-2xl border border-border bg-surface p-6 shadow-sm";
const saldoPanel =
  "relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-blue-50/70 p-6 shadow-sm";

function etiquetaActualizadoBanco(banco: string): string {
  if (banco.startsWith("Banco actualizado ")) {
    return `Actualizado ${banco.slice("Banco actualizado ".length)}`;
  }
  return banco.replace(/^Banco /, "");
}
const link =
  "inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-brand-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary";
const primary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-brand-primary px-5 py-3 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-primary";

export interface InicioResumenViewProps extends HoyViewProps {
  credits?: React.ReactNode;
  balances?: React.ReactNode;
  /** Inmediatamente bajo el par saldo bancario / proyección 14 días. */
  debajoDeCaja?: React.ReactNode;
  /** Foto canónica de proyección H=14 (puente de la sección 05). */
  projection?: CashProjectionViewModel | null;
  /** Cuando el Decision Brief está visible, este resumen conserva evidencia pero no duplica planes. */
  suppressRecommendations?: boolean;
}

export function InicioResumenView(props: InicioResumenViewProps) {
  const {
    data,
    hoy = new Date(),
    credits,
    balances,
    debajoDeCaja,
    projection,
    suppressRecommendations = false,
  } = props;
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
  const heroAmount = cash.needsAttention ? cash.gapAmount : cash.minimum;
  const saldoConfirmado =
    cash.cash.monto != null && !crumb.bancoConReparo && cash.cash.estado !== "estimated";
  const coberturaAtencion = cash.needsAttention;
  const coberturaTitulo = coberturaAtencion
    ? "Requiere atención"
    : cash.noGapReported
      ? "Pagos cubiertos"
      : "Proyección por confirmar";
  const coberturaIntro = coberturaAtencion
    ? "La caja actual no alcanza para cubrir todos los compromisos identificados."
    : cash.noGapReported
      ? "Los compromisos identificados a 14 días están cubiertos con la caja proyectada."
      : "Aún no podemos confirmar la cobertura con los datos disponibles.";
  const coberturaMontoLabel = coberturaAtencion
    ? "Faltante · próximos 14 días · CLP"
    : "Cobertura · próximos 14 días · CLP";
  const coberturaNota = coberturaAtencion
    ? "Se arma con tus facturas por cobrar y los compromisos de pago cargados a 14 días."
    : "Menor saldo proyectado en el horizonte de 14 días.";
  const balancesNode =
    balances && React.isValidElement(balances)
      ? React.cloneElement(balances as React.ReactElement<{ actualizadoLabel?: string }>, {
          actualizadoLabel: etiquetaActualizadoBanco(crumb.banco),
        })
      : balances;

  return (
    <div className="@container" data-testid="inicio-resumen">
      <div
        className="grid items-stretch gap-4 lg:grid-cols-[1.15fr_0.85fr]"
        data-testid="inicio-caja"
      >
        <section aria-labelledby="inicio-saldo" className={saldoPanel}>
          <div
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-blue-100/60 blur-2xl"
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 w-1 bg-brand-primary" aria-hidden="true" />
          <div className="relative flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="inicio-saldo"
                  className="text-3xl font-bold tracking-tight text-neutral-dark"
                >
                  Saldo bancario
                </h2>
              </div>
              {saldoConfirmado && (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/80 bg-surface/80 px-3 py-1 text-xs font-semibold text-emerald-700 backdrop-blur-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Confirmado
                </span>
              )}
            </div>
            {balancesNode ? (
              <div className="mt-3 flex min-h-0 flex-1 flex-col">{balancesNode}</div>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-neutral-mid">CLP</p>
                <p className="mt-1 break-words text-4xl font-bold tabular-nums text-neutral-dark">
                  {cash.cash.monto == null ? "Sin dato" : formatClp(cash.cash.monto)}
                </p>
                <p
                  className={cn(
                    "mt-2 text-sm",
                    crumb.bancoConReparo ? "text-warning-700" : "text-neutral-mid",
                  )}
                >
                  {etiquetaActualizadoBanco(crumb.banco)}
                </p>
                {cash.cash.estado === "estimated" && (
                  <p className="mt-2 text-sm text-warning-700">Saldo estimado</p>
                )}
              </div>
            )}
            {credits}
            {!balances && (
              <div className="mt-auto pt-6">
                <Link
                  className="inline-flex items-center gap-2 text-sm font-semibold text-brand-primary hover:underline"
                  href="/banco"
                >
                  Ver cuentas y composición <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            )}
          </div>
        </section>

        <section
          aria-labelledby="inicio-proyeccion"
          className={cn(
            panel,
            "flex flex-col",
            coberturaAtencion && "border-amber-200 bg-amber-50/60",
          )}
        >
          <div className="flex items-start gap-3">
            {coberturaAtencion && (
              <AlertTriangle className="mt-1 h-6 w-6 shrink-0 text-amber-700" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <h2 id="inicio-proyeccion" className="text-2xl font-bold text-neutral-dark">
                {coberturaTitulo}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-mid">{coberturaIntro}</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-neutral-mid">{coberturaMontoLabel}</p>
          <p
            className={cn(
              "mt-1 break-words text-3xl font-bold tabular-nums",
              coberturaAtencion
                ? "text-danger-700"
                : cash.noGapReported
                  ? "text-success-700"
                  : "text-neutral-dark",
            )}
          >
            {heroAmount == null ? "Sin dato" : formatClp(heroAmount)}
          </p>
          <p
            className={cn(
              "mt-2 text-sm",
              coberturaAtencion ? "text-amber-800" : "text-neutral-mid",
            )}
          >
            {coberturaNota}
          </p>
          {!cash.projectionCurrent && (
            <p className="mt-2 text-sm text-warning-700">Proyección pendiente de actualizar.</p>
          )}
          {!coberturaAtencion && !cash.noGapReported && (
            <p className="mt-2 text-sm text-warning-700">
              No se puede confirmar la cobertura con los datos disponibles.
            </p>
          )}
          <div className="mb-1 mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            {showDecision && (
              <button
                type="button"
                className={cn(primary, "px-4 py-2.5 text-sm font-semibold")}
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
            <Link
              href="/caja"
              className={cn(
                showDecision
                  ? link
                  : "inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90",
              )}
            >
              Ver proyección de caja <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </div>

      {(debajoDeCaja || isLocalDevAppEnv()) && <InicioSeccionSeparador />}

      {debajoDeCaja}

      {debajoDeCaja && isLocalDevAppEnv() ? <InicioSeccionSeparador /> : null}

      {isLocalDevAppEnv() && (
        <InicioMaquetaSecciones
          data={data}
          projection={projection}
          mostrarAcciones={!suppressRecommendations}
        />
      )}

      {showDecision && (
        <>
          <InicioSeccionSeparador />
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
        </>
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
