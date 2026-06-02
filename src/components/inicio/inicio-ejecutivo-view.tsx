"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Banknote,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { QavanteCard } from "@/components/qavante";
import { useDashboardSummary, type DashboardSummaryResponse } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import {
  parseAmount,
  pulsoStatusLabel,
  pulsoStatusTone,
  confidenceLabel,
} from "./dashboard-format";

/* Inicio Ejecutivo (Sprint C8, Maestro §7.1): "¿Cómo está mi empresa hoy?".
   Frase ejecutiva + Pulso + caja hoy/proyectada + brecha + cobranza + pagos +
   resultado + 3 acciones prioritarias. Cada bloque es NULLABLE (una fuente
   puede faltar sin tumbar el dashboard). Container: resuelve el summary + monta
   las cards. Contrato FE-first gated por `dashboardSummary` (la page resuelve). */

export function InicioEjecutivoView() {
  const query = useDashboardSummary();

  if (query.isLoading) return <LoadingSkeleton />;
  if (query.isError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark"
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
  return (
    <div className="space-y-4">
      {/* Frase ejecutiva. */}
      <p className="text-lg font-medium text-neutral-dark">{data.executive_phrase}</p>

      {/* Pulso (destacado). */}
      {data.pulso ? (
        <QavanteCard variant="bordered">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-neutral-mid">Pulso del negocio</p>
              <p className={"text-3xl font-bold " + pulsoStatusTone(data.pulso.status)}>
                {data.pulso.score}
                <span className="ml-2 text-lg">{pulsoStatusLabel(data.pulso.status)}</span>
              </p>
              <p className="mt-0.5 text-xs text-neutral-mid">
                {confidenceLabel(data.pulso.confidence)}
                {data.pulso.preliminary && " · preliminar"}
              </p>
            </div>
            <div className="space-y-1 text-sm">
              {data.pulso.top_driver_positive && (
                <p className="flex items-center gap-1 text-success-700">
                  <TrendingUp className="h-4 w-4" aria-hidden="true" />
                  {data.pulso.top_driver_positive}
                </p>
              )}
              {data.pulso.top_driver_negative && (
                <p className="flex items-center gap-1 text-danger-500">
                  <TrendingDown className="h-4 w-4" aria-hidden="true" />
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

      {/* Grid de bloques. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Caja hoy. */}
        <DashCard title="Caja hoy" href="/caja/proyeccion" cta="Ver caja">
          {data.cash_today ? (
            <>
              <p className="text-2xl font-bold text-neutral-dark">
                {formatClp(parseAmount(data.cash_today.total))}
              </p>
              <p className="mt-1 text-xs text-neutral-mid">
                Actualizado {formatDate(new Date(data.cash_today.last_updated))}
                {data.cash_today.data_state === "stale" && " · puede estar desactualizado"}
                {data.cash_today.data_state === "estimated" && " · estimado"}
              </p>
            </>
          ) : (
            <NoData />
          )}
        </DashCard>

        {/* Caja proyectada. */}
        <DashCard title="Caja proyectada" href="/caja/proyeccion" cta="Ver proyección">
          {data.cash_forecast ? (
            <dl className="space-y-1 text-sm">
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
                  <b>{formatClp(parseAmount(data.cash_gap.critical_obligations_14d))}</b> vs caja{" "}
                  {formatClp(parseAmount(data.cash_gap.projected_cash_14d))}. Hay brecha.
                </span>
              </div>
            ) : (
              <p className="text-sm text-success-700">
                La caja proyectada cubre las obligaciones críticas de los próximos 14 días.
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
                <span className="font-semibold text-danger-500">
                  {formatClp(parseAmount(data.overdue_collections.overdue))}
                </span>{" "}
                vencido de {formatClp(parseAmount(data.overdue_collections.total_receivable))}
              </p>
              <ul className="mt-2 space-y-0.5 text-xs text-neutral-mid">
                {data.overdue_collections.top_clients.slice(0, 3).map((c) => (
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
              <dl className="space-y-1 text-sm">
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
            <dl className="space-y-1 text-sm">
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

      {/* Acciones prioritarias (máx 3). */}
      {data.priority_actions.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={<span className="font-medium">Qué hacer primero</span>}
        >
          <ul className="space-y-2">
            {data.priority_actions.slice(0, 3).map((a) => (
              <li key={a.priority} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-neutral-dark">{a.reason}</p>
                  {a.deadline && <p className="text-xs text-neutral-mid">Plazo: {a.deadline}</p>}
                </div>
                <Link
                  href={a.cta_href}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-primary/40 px-2 py-1 text-xs font-medium text-brand-primary hover:bg-brand-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  {a.cta_label}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </QavanteCard>
      )}
    </div>
  );
}

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
  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium">{title}</span>
          {href && cta && (
            <Link
              href={href}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              {cta}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      }
    >
      {children}
    </QavanteCard>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-neutral-mid">{label}</dt>
      <dd
        className={
          "tabular-nums " + (strong ? "font-semibold text-neutral-dark" : "text-neutral-dark")
        }
      >
        {value}
      </dd>
    </div>
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

function LoadingSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-6 w-3/4 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="h-24 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-md bg-neutral-light/30" />
        ))}
      </div>
    </div>
  );
}
