"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { QavanteCard, QavanteEmpty, QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { useDashboardSummary, type DashboardSummaryResponse } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import {
  parseAmount,
  pulsoStatusLabel,
  pulsoStatusTone,
  pulsoStatusDotBg,
  confidenceLabel,
  isEmptySummary,
} from "./dashboard-format";

/* Inicio Ejecutivo (Sprint C8, Maestro §7.1): "¿Cómo está mi empresa hoy?".
   Refresh v1.3 — diseñado alrededor de LA DECISIÓN: el Pulso es la respuesta
   héroe; cada card defiende un dato y su origen (capa de confianza visible);
   números tabulares; las cards son clickeables con feedback de hover; deltas con
   ícono+color (daltonismo-safe). Cada bloque es NULLABLE (una fuente puede faltar
   sin tumbar el dashboard). Contrato FE-first gated por `dashboardSummary`. */

export function InicioEjecutivoView() {
  const query = useDashboardSummary();

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
      >
        <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
        <p>
          {query.error instanceof ApiError
            ? apiErrorToUserMessage(query.error)
            : "No pudimos cargar tu resumen. Intenta nuevamente."}
        </p>
      </div>
    );
  }
  if (!query.data) return null;
  return <Dashboard data={query.data} />;
}

function Dashboard({ data }: { data: DashboardSummaryResponse }) {
  /* Empresa nueva / sin fuentes: el backend responde 200 con todo null. */
  if (isEmptySummary(data)) return <EmptySummary />;

  return (
    <div className="space-y-5">
      {/* Frase ejecutiva — lectura humana, calma (contexto, no titular). */}
      {data.executive_phrase && (
        <p className="max-w-3xl text-[15px] font-medium leading-relaxed text-neutral-dark sm:text-base">
          {data.executive_phrase}
        </p>
      )}

      {/* Pulso — la respuesta héroe ("¿estoy bien?"). */}
      {data.pulso ? (
        <QavanteCard variant="bordered" className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-stretch gap-4">
              <span
                className={cn("w-1.5 shrink-0 rounded-full", pulsoStatusDotBg(data.pulso.status))}
                aria-hidden="true"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                  Pulso del negocio
                </p>
                <p className="flex items-baseline gap-2">
                  <span
                    className={cn(
                      "text-4xl font-bold tabular-nums tracking-tight",
                      pulsoStatusTone(data.pulso.status),
                    )}
                  >
                    {data.pulso.score}
                  </span>
                  <span
                    className={cn("text-base font-semibold", pulsoStatusTone(data.pulso.status))}
                  >
                    {pulsoStatusLabel(data.pulso.status)}
                  </span>
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-neutral-mid">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  {confidenceLabel(data.pulso.confidence)}
                  {data.pulso.preliminary && " · preliminar"}
                </p>
              </div>
            </div>
            <div className="space-y-1.5 text-sm">
              {data.pulso.top_driver_positive && (
                <p className="flex items-center gap-1.5 font-medium text-success-700">
                  <TrendingUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {data.pulso.top_driver_positive}
                </p>
              )}
              {data.pulso.top_driver_negative && (
                <p className="flex items-center gap-1.5 font-medium text-danger-500">
                  <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {data.pulso.top_driver_negative}
                </p>
              )}
            </div>
          </div>
        </QavanteCard>
      ) : (
        <DashCard title="Pulso del negocio">
          <NoData />
        </DashCard>
      )}

      {/* Grid de bloques de soporte — cada card es clickeable. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Caja hoy. */}
        <DashCard title="Caja hoy" href="/caja/proyeccion" cta="Ver caja">
          {data.cash_today ? (
            <>
              <p className="text-xl font-bold tabular-nums text-neutral-dark">
                {formatClp(parseAmount(data.cash_today.total))}
              </p>
              <Freshness
                updated={data.cash_today.last_updated}
                state={data.cash_today.data_state}
              />
            </>
          ) : (
            <NoData />
          )}
        </DashCard>

        {/* Caja proyectada. */}
        <DashCard title="Caja proyectada" href="/caja/proyeccion" cta="Ver proyección">
          {data.cash_forecast ? (
            <dl className="space-y-1.5 text-sm">
              <Row
                label="Mínima 14 días"
                value={formatClp(parseAmount(data.cash_forecast.min_14d))}
              />
              <Row
                label="Mínima 30 días"
                value={formatClp(parseAmount(data.cash_forecast.min_30d))}
              />
              {data.cash_forecast.days_of_cash != null && (
                <Row label="Días de caja" value={`~${data.cash_forecast.days_of_cash}`} />
              )}
            </dl>
          ) : (
            <NoData />
          )}
        </DashCard>

        {/* Brecha de caja. */}
        <DashCard title="Brecha de caja" href="/caja/proyeccion" cta="Ver detalle">
          {data.cash_gap ? (
            data.cash_gap.has_gap ? (
              <div className="flex items-start gap-2 text-sm text-danger-500">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  Obligaciones críticas 14d:{" "}
                  <b className="tabular-nums">
                    {formatClp(parseAmount(data.cash_gap.critical_obligations_14d))}
                  </b>{" "}
                  vs caja{" "}
                  <span className="tabular-nums">
                    {formatClp(parseAmount(data.cash_gap.projected_cash_14d))}
                  </span>
                  . Hay brecha.
                </span>
              </div>
            ) : (
              <p className="flex items-start gap-2 text-sm text-success-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span>
                  La caja proyectada cubre las obligaciones críticas de los próximos 14 días.
                </span>
              </p>
            )
          ) : (
            <NoData />
          )}
        </DashCard>

        {/* Cobranza vencida. */}
        <DashCard title="Cobranza vencida" href="/cobrar" cta="Ver cobranza">
          {data.overdue_collections ? (
            <>
              <p className="text-sm">
                <span className="text-xl font-bold tabular-nums text-danger-500">
                  {formatClp(parseAmount(data.overdue_collections.overdue))}
                </span>{" "}
                <span className="text-neutral-mid">
                  vencido de{" "}
                  <span className="tabular-nums">
                    {formatClp(parseAmount(data.overdue_collections.total_receivable))}
                  </span>
                </span>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-neutral-mid">
                {(data.overdue_collections.top_clients ?? []).slice(0, 3).map((c) => (
                  <li key={c.name} className="flex justify-between gap-2">
                    <span className="truncate">{c.name}</span>
                    <span className="tabular-nums">{formatClp(parseAmount(c.amount))}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <NoData />
          )}
        </DashCard>

        {/* Pagos críticos. */}
        <DashCard title="Pagos críticos" href="/pagar" cta="Ver pagos">
          {data.critical_payments ? (
            <>
              <dl className="space-y-1.5 text-sm">
                <Row
                  label="Próx. 7 días"
                  value={formatClp(parseAmount(data.critical_payments.due_7d))}
                />
                <Row
                  label="Próx. 14 días"
                  value={formatClp(parseAmount(data.critical_payments.due_14d))}
                />
              </dl>
              {data.critical_payments.next_critical && (
                <p className="mt-2 text-xs text-neutral-mid">
                  Próximo: {data.critical_payments.next_critical.label} ·{" "}
                  {formatDate(new Date(data.critical_payments.next_critical.due_date))}
                </p>
              )}
            </>
          ) : (
            <NoData />
          )}
        </DashCard>

        {/* Resultado operacional. */}
        <DashCard title="Resultado del mes" href="/gestion" cta="Ver gestión">
          {data.operational_result ? (
            <dl className="space-y-1.5 text-sm">
              <Row
                label="Ingresos"
                value={formatClp(parseAmount(data.operational_result.revenue))}
              />
              <Row
                label="Margen bruto"
                value={formatClp(parseAmount(data.operational_result.gross_margin))}
              />
              <Row
                label="Resultado"
                value={formatClp(parseAmount(data.operational_result.result))}
                strong
              />
            </dl>
          ) : (
            <NoData />
          )}
        </DashCard>
      </div>

      {/* Qué hacer primero — la decisión (máx 3 acciones priorizadas). */}
      {data.priority_actions && data.priority_actions.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Qué hacer primero
            </span>
          }
        >
          <ul className="divide-y divide-border">
            {data.priority_actions.slice(0, 3).map((a, i) => (
              <li
                key={a.priority}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary-50 text-[11px] font-bold text-brand-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-dark">{a.reason}</p>
                    {a.deadline && <p className="text-xs text-neutral-mid">Plazo: {a.deadline}</p>}
                  </div>
                </div>
                <Link
                  href={a.cta_href}
                  className="group inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-primary/40 px-2.5 py-1 text-xs font-semibold text-brand-primary transition-colors hover:bg-brand-primary hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
                >
                  {a.cta_label}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </QavanteCard>
      )}
    </div>
  );
}

/* Card de KPI: label uppercase + contenido. Clickeable (con href) → todo el card
   reacciona al mouse (eleva + borde de marca + flecha), no solo el link chico. */
function DashCard({
  title,
  href,
  cta,
  children,
}: {
  title: string;
  href?: string;
  cta?: string;
  children: React.ReactNode;
}) {
  const card = (
    <QavanteCard
      variant="bordered"
      className={cn(
        "h-full transition-all duration-150",
        href &&
          "group-hover:-translate-y-0.5 group-hover:border-brand-primary/50 group-hover:shadow-lg",
      )}
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
            {title}
          </span>
          {href && cta && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-primary">
              {cta}
              <ArrowRight
                className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </span>
          )}
        </div>
      }
    >
      {children}
    </QavanteCard>
  );

  return href ? (
    <Link
      href={href}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  ) : (
    card
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-neutral-mid">{label}</dt>
      <dd className={cn("tabular-nums text-neutral-dark", strong ? "font-bold" : "font-medium")}>
        {value}
      </dd>
    </div>
  );
}

/* Capa de confianza: frescura + estado del dato. Un número sin origen no se cree. */
function Freshness({ updated, state }: { updated: string; state?: string }) {
  return (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-neutral-mid">
      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
      Actualizado {formatDate(new Date(updated))}
      {state === "stale" && " · puede estar desactualizado"}
      {state === "estimated" && " · estimado"}
    </p>
  );
}

function NoData() {
  return (
    <p className="flex items-center gap-1.5 text-sm text-neutral-mid">
      <Banknote className="h-4 w-4" aria-hidden="true" />
      Sin dato por ahora (no se asume en cero).
    </p>
  );
}

function EmptySummary() {
  return (
    <QavanteEmpty
      icon={Sparkles}
      title="Estamos preparando tu resumen"
      description="Todavía no hay datos para mostrar. A medida que conectes tus fuentes (SII, banco) y clasifiques tus movimientos, acá vas a ver tu Pulso, tu caja, alertas y las acciones prioritarias."
      cta={
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/administracion/credenciales">
            <QavanteButton size="sm">Conectar SII</QavanteButton>
          </Link>
          <Link href="/caja/por-clasificar">
            <QavanteButton size="sm" variant="ghost">
              Clasificar movimientos
            </QavanteButton>
          </Link>
        </div>
      }
    />
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5" aria-hidden="true">
      <div className="h-6 w-3/4 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="h-24 animate-pulse rounded-xl bg-neutral-light/30" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-light/30" />
        ))}
      </div>
    </div>
  );
}
