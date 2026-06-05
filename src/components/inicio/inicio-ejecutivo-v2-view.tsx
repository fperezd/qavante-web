"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { QavanteCard, QavanteEmpty, QavanteButton } from "@/components/qavante";
import {
  useDashboardSummary,
  type DashboardSummaryV2,
  type DashboardKeyObligation,
} from "@/lib/api/dashboard";
import { useMe } from "@/lib/api/users";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { formatClp } from "@/lib/formatters/clp";
import { formatDate } from "@/lib/formatters/date";
import {
  parseAmount,
  pulsoStatusLabel,
  pulsoStatusTone,
  firstName,
  runwayDateLabel,
  obligationCoverageLabel,
  obligationCoverageTone,
  deltaPctLabel,
  isEmptySummary,
} from "./dashboard-format";

/* Inicio Ejecutivo v2 (rediseño, lente Xero). Jerarquía: saludo + Pulso compacto
   → frase ejecutiva (héroe) → caja (con tendencia) → LAS 3 FECHAS CLAVE del mes
   (imposiciones / impuestos mensuales / sueldos) → qué hacer primero → money
   in/out/resultado. Gated por `dashboardSummary` (reusa su flag; mismo endpoint). Campos nuevos
   (key_obligations, sparkline, delta) son FE-first y degradan si faltan. */

export function InicioEjecutivoV2View() {
  const query = useDashboardSummary();
  const me = useMe();

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
  return <DashboardV2 data={query.data} name={me.data?.user?.name ?? null} />;
}

function DashboardV2({ data, name }: { data: DashboardSummaryV2; name: string | null }) {
  if (isEmptySummary(data)) return <EmptySummary />;

  const now = new Date();
  const greetingDate = new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(now);
  const hello = firstName(name) ? `Hola, ${firstName(name)}` : "Hola";

  return (
    <div className="space-y-4">
      {/* Saludo + Pulso compacto. */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-neutral-mid">
          {hello} <span className="text-neutral-light">·</span> {greetingDate}
        </p>
        {data.pulso && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-light/60 px-2.5 py-1 text-xs">
            <span className="text-neutral-mid">Pulso</span>
            <span className={"font-bold " + pulsoStatusTone(data.pulso.status)}>
              {data.pulso.score}
            </span>
            <span className="text-neutral-mid">{pulsoStatusLabel(data.pulso.status)}</span>
          </span>
        )}
      </div>

      {/* Frase ejecutiva = héroe. */}
      {data.executive_phrase && (
        <p className="text-xl font-semibold leading-snug text-neutral-dark sm:text-2xl">
          {data.executive_phrase}
        </p>
      )}

      {/* Caja (con tendencia). */}
      {data.cash_today || data.cash_forecast ? (
        <QavanteCard variant="bordered">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <CashMetric
              label="Caja hoy"
              value={data.cash_today ? formatClp(parseAmount(data.cash_today.total)) : "—"}
              delta={deltaPctLabel(data.cash_delta_pct)}
              deltaUp={(data.cash_delta_pct ?? 0) >= 0}
              sub={
                data.cash_today
                  ? `actualizado ${formatDate(new Date(data.cash_today.last_updated))}`
                  : undefined
              }
            />
            <CashMetric
              label="Caja mín. 14 días"
              value={data.cash_forecast ? formatClp(parseAmount(data.cash_forecast.min_14d)) : "—"}
              sub="proyectada"
            />
            <CashMetric
              label="Días de caja"
              value={
                data.cash_forecast?.days_of_cash != null
                  ? `~${data.cash_forecast.days_of_cash} días`
                  : "—"
              }
              sub={runwayLabel(data.cash_forecast?.days_of_cash, now)}
            />
          </div>
          {data.cash_sparkline && data.cash_sparkline.length > 1 && (
            <Sparkline points={data.cash_sparkline} />
          )}
        </QavanteCard>
      ) : null}

      {/* Las 3 fechas clave del mes. */}
      {data.key_obligations && data.key_obligations.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <span className="flex items-center gap-1.5 font-medium">
              <CalendarClock className="h-4 w-4 text-brand-primary" aria-hidden="true" />
              Tus fechas clave del mes
            </span>
          }
        >
          <ul className="divide-y divide-neutral-light/40">
            {data.key_obligations.map((o) => (
              <KeyObligationRow key={o.key} o={o} />
            ))}
          </ul>
        </QavanteCard>
      )}

      {/* Qué hacer primero. */}
      {data.priority_actions && data.priority_actions.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <span className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-4 w-4 text-warning-700" aria-hidden="true" />
              Qué hacer primero
            </span>
          }
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

      {/* Money in / out / resultado. */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SupportCard title="Por cobrar" href="/cobrar" cta="Ver cobranza">
          {data.overdue_collections ? (
            <>
              <p className="text-lg font-bold text-danger-500">
                {formatClp(parseAmount(data.overdue_collections.overdue))}
              </p>
              <p className="text-xs text-neutral-mid">
                vencido de {formatClp(parseAmount(data.overdue_collections.total_receivable))}
                {data.overdue_collections.top_clients?.length
                  ? ` · ${data.overdue_collections.top_clients.length} clientes`
                  : ""}
              </p>
            </>
          ) : (
            <NoData />
          )}
        </SupportCard>

        <SupportCard title="Por pagar (30d)" href="/pagar" cta="Ver pagos">
          {data.critical_payments ? (
            <>
              <p className="text-lg font-bold text-neutral-dark">
                {formatClp(parseAmount(data.critical_payments.due_14d))}
              </p>
              <p className="text-xs text-neutral-mid">
                próximos 14 días · 7d {formatClp(parseAmount(data.critical_payments.due_7d))}
              </p>
            </>
          ) : (
            <NoData />
          )}
        </SupportCard>

        <SupportCard title="Resultado del mes" href="/gestion" cta="Ver gestión">
          {data.operational_result ? (
            <>
              <p
                className={
                  "text-lg font-bold " +
                  (parseAmount(data.operational_result.result) >= 0
                    ? "text-success-700"
                    : "text-danger-500")
                }
              >
                {formatClp(parseAmount(data.operational_result.result))}
              </p>
              <p className="text-xs text-neutral-mid">
                ingresos {formatClp(parseAmount(data.operational_result.revenue))}
              </p>
            </>
          ) : (
            <NoData />
          )}
        </SupportCard>
      </div>
    </div>
  );
}

function runwayLabel(days: number | null | undefined, now: Date): string | undefined {
  const date = runwayDateLabel(days, now);
  return date ? `te alcanza hasta el ${date}` : "de runway";
}

function CashMetric({
  label,
  value,
  delta,
  deltaUp,
  sub,
}: {
  label: string;
  value: string;
  delta?: string | null;
  deltaUp?: boolean;
  sub?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-neutral-mid">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5 text-2xl font-bold text-neutral-dark">
        {value}
        {delta && (
          <span
            className={
              "text-sm font-semibold " + (deltaUp ? "text-success-700" : "text-danger-500")
            }
          >
            {delta}
          </span>
        )}
      </p>
      {sub && <p className="mt-0.5 text-xs text-neutral-mid">{sub}</p>}
    </div>
  );
}

function KeyObligationRow({ o }: { o: DashboardKeyObligation }) {
  const Icon = o.coverage === "covered" ? CheckCircle2 : AlertTriangle;
  return (
    <li className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Icon
          className={"h-4 w-4 flex-shrink-0 " + obligationCoverageTone(o.coverage)}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="truncate font-medium text-neutral-dark">{o.label}</p>
          <p className="text-xs text-neutral-mid">vence {formatDate(new Date(o.due_date))}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums text-neutral-dark">
          {formatClp(parseAmount(o.amount))}
        </p>
        <p className={"text-xs " + obligationCoverageTone(o.coverage)}>
          {obligationCoverageLabel(o.coverage)}
        </p>
      </div>
    </li>
  );
}

function Sparkline({ points }: { points: number[] }) {
  const max = Math.max(...points, 1);
  return (
    <div className="mt-3 flex h-10 items-end gap-0.5" aria-hidden="true">
      {points.map((p, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-brand-primary/40"
          style={{ height: `${Math.max(4, (Math.max(0, p) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function SupportCard({
  title,
  href,
  cta,
  children,
}: {
  title: string;
  href: string;
  cta: string;
  children: React.ReactNode;
}) {
  return (
    <QavanteCard
      variant="bordered"
      className="h-full"
      header={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-mid">
            {title}
          </span>
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            {cta}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      }
    >
      {children}
    </QavanteCard>
  );
}

function NoData() {
  return <p className="text-sm text-neutral-mid">Sin dato por ahora.</p>;
}

function EmptySummary() {
  return (
    <QavanteEmpty
      icon={Sparkles}
      title="Estamos preparando tu resumen"
      description="Todavía no hay datos para mostrar. A medida que conectes tus fuentes (SII, banco) y clasifiques tus movimientos, acá vas a ver tu caja, tus fechas clave y las acciones prioritarias."
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
    <div className="space-y-4" aria-hidden="true">
      <div className="h-5 w-2/3 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="h-8 w-full animate-pulse rounded-md bg-neutral-light/30" />
      <div className="h-28 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="h-32 animate-pulse rounded-md bg-neutral-light/30" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-md bg-neutral-light/30" />
        ))}
      </div>
    </div>
  );
}
