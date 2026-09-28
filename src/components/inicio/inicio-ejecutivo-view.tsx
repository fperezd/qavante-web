"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  QavanteCard,
  QavanteEmpty,
  QavanteButton,
  QavanteInlineError,
  AmountCountUp,
} from "@/components/qavante";
import { cn } from "@/lib/utils";
import {
  useDashboardSummary,
  type DashboardCriticalPayments,
  type DashboardSummaryResponse,
} from "@/lib/api/dashboard";
import { formatClp } from "@/lib/formatters/clp";
import { formatDateLike, formatDateTimeLike } from "@/lib/formatters/date";
import { parseAmount, isEmptySummary } from "./dashboard-format";
import {
  MONTO_EN_REVISION,
  MONTO_EN_REVISION_MOTIVO,
  importeDesconocido,
} from "@/lib/formatters/amount";

/** Monto del resumen, o "En revisión" cuando el backend lo publica `null` por cuarentena de
 *  conciliación (qavante-api#907). Nunca `$0`. */
function montoOEnRevision(raw: string | null): string {
  return raw == null ? MONTO_EN_REVISION : formatClp(parseAmount(raw));
}
import { describeCashGap14d } from "./cash-gap-14d";
import type { CashGap14dCifras, CashGap14dInput } from "./cash-gap-14d";
import { PulsoRing } from "./pulso-ring";
import { estadoVencimientoCritico } from "./critical-payment-status";
import { CashProjectionRunPanel } from "@/components/cash-projection-runs/cash-projection-run-panel";

/* Inicio Ejecutivo (Sprint C8, Maestro §7.1): "¿Cómo está mi empresa hoy?".
   Refresh v1.3 — diseñado alrededor de LA DECISIÓN: el Pulso es la respuesta
   héroe; cada card defiende un dato y su origen (capa de confianza visible);
   números tabulares; las cards son clickeables con feedback de hover; deltas con
   ícono+color (daltonismo-safe). Cada bloque es NULLABLE (una fuente puede faltar
   sin tumbar el dashboard). Contrato FE-first gated por `dashboardSummary`. */

export function InicioEjecutivoView({
  suppressRecommendations = false,
}: {
  /** El brief canónico reemplaza sólo la lista heredada de prioridades. */
  suppressRecommendations?: boolean;
}) {
  const query = useDashboardSummary();
  const projection = (
    <CashProjectionRunPanel horizonDays={14} title="Caja para las decisiones de hoy" />
  );

  if (query.isLoading)
    return (
      <div className="space-y-5">
        {projection}
        <LoadingSkeleton />
      </div>
    );
  if (query.isError) {
    return (
      <div className="space-y-5">
        {projection}
        <QavanteInlineError error={query.error} what="tu resumen" onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (!query.data)
    return (
      <div className="space-y-5">
        {projection}
        <EmptySummary />
      </div>
    );
  return (
    <div className="space-y-5">
      {projection}
      <Dashboard data={query.data} suppressRecommendations={suppressRecommendations} />
    </div>
  );
}

/** Etiqueta honesta para el destaque: el contrato #254 sólo llama "próximo" a un pago futuro.
 * Si no hay pago futuro, `next_critical` cae explícitamente al más vencido y trae `is_overdue`.
 * Una respuesta parcial no permite inferir ninguno de los dos estados. */
export function etiquetaProximoPago(
  pago: NonNullable<DashboardCriticalPayments["next_critical"]>,
): "Próximo" | "Más vencido" | "Estado de vencimiento sin dato" {
  const estado = estadoVencimientoCritico(pago);
  if (estado === "sin_dato") return "Estado de vencimiento sin dato";
  return estado === "vencido" ? "Más vencido" : "Próximo";
}

export function Dashboard({
  data,
  suppressRecommendations = false,
}: {
  data: DashboardSummaryResponse;
  suppressRecommendations?: boolean;
}) {
  // El servidor decide qué acciones son prioritarias. Con el brief canónico activo,
  // esta superficie conserva los datos de apoyo sin publicar una segunda decisión.
  const actions = suppressRecommendations ? [] : (data.priority_actions ?? []);
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

      {/* Pulso — la respuesta héroe ("¿estoy bien?"). Clickeable → su detalle
          ("¿por qué está así mi Pulso?"): el diagnóstico principal debe dejar
          profundizar en el porqué. */}
      {data.pulso ? (
        <Link
          href="/alertas"
          className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
        >
          <QavanteCard
            variant="bordered"
            className="overflow-hidden transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-brand-primary/50 group-hover:shadow-lg"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <PulsoRing score={data.pulso.score} status={data.pulso.status} />
                <div>
                  <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
                    Pulso del negocio
                    <span className="inline-flex items-center gap-0.5 font-semibold normal-case tracking-normal text-brand-primary opacity-0 transition-opacity group-hover:opacity-100">
                      Ver por qué
                      <ArrowRight
                        className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </span>
                  </p>
                  {data.pulso.preliminary && (
                    <p className="mt-2 text-xs text-neutral-mid">Preliminar</p>
                  )}
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
                  <p className="flex items-center gap-1.5 font-medium text-danger-700">
                    <TrendingDown className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {data.pulso.top_driver_negative}
                  </p>
                )}
              </div>
            </div>
          </QavanteCard>
        </Link>
      ) : (
        <DashCard title="Pulso del negocio">
          <NoData />
        </DashCard>
      )}

      {/* Grid de bloques de soporte — cada card es clickeable, con entrada
          escalonada (las cards "aparecen" en cascada al cargar). */}
      <div className="qv-stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Caja hoy. */}
        <DashCard title="Caja hoy" href="/caja/proyeccion" cta="Ver caja">
          {data.cash_today ? (
            <>
              <p className="text-xl font-bold tabular-nums text-neutral-dark">
                <AmountCountUp value={parseAmount(data.cash_today.total)} />
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

        {/* Cobranza vencida. */}
        <DashCard title="Cobranza vencida" href="/cobrar" cta="Ver cobranza">
          {data.overdue_collections ? (
            <>
              {importeDesconocido(data.overdue_collections) ? (
                /* #907: cuarentena de conciliación viva → montos desconocidos, ni $0 ni "al día". */
                <>
                  <p className="text-sm">
                    <span className="text-xl font-bold text-neutral-dark">{MONTO_EN_REVISION}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-mid">{MONTO_EN_REVISION_MOTIVO}</p>
                </>
              ) : data.overdue_collections.overdue == null ? (
                /* El SII no entrega los vencimientos (data_state parcial) → el backend manda
                   `overdue: null`. NO lo pintamos como "$0" (mentiría "estás al día"): decimos
                   "sin dato" honesto y dejamos el total por cobrar a la vista. */
                <>
                  <p className="text-sm">
                    <span className="text-xl font-bold text-neutral-dark">Sin dato</span>{" "}
                    <span className="text-neutral-mid">de vencido</span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-mid">
                    de{" "}
                    <span className="tabular-nums">
                      {montoOEnRevision(data.overdue_collections.total_receivable)}
                    </span>{" "}
                    por cobrar · el SII aún no entrega los vencimientos
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm">
                    <span className="text-xl font-bold tabular-nums text-danger-500">
                      {formatClp(parseAmount(data.overdue_collections.overdue))}
                    </span>{" "}
                    <span className="text-neutral-mid">
                      vencido de{" "}
                      <span className="tabular-nums">
                        {montoOEnRevision(data.overdue_collections.total_receivable)}
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
              )}
              <Freshness
                updated={data.overdue_collections.last_updated}
                source={data.overdue_collections.source}
              />
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
                <Row label="Próx. 7 días" value={montoOEnRevision(data.critical_payments.due_7d)} />
                <Row
                  label="Próx. 14 días"
                  value={montoOEnRevision(data.critical_payments.due_14d)}
                />
              </dl>
              {data.critical_payments.next_critical && (
                <p className="mt-2 text-xs text-neutral-mid">
                  {etiquetaProximoPago(data.critical_payments.next_critical)}:{" "}
                  {data.critical_payments.next_critical.label} ·{" "}
                  {formatDateLike(data.critical_payments.next_critical.due_date)}
                </p>
              )}
              <Freshness
                updated={data.critical_payments.last_updated}
                source={data.critical_payments.source}
              />
            </>
          ) : (
            <NoData />
          )}
        </DashCard>

        {/* Resultado operacional. */}
        <DashCard title="Resultado del mes" href="/gestion" cta="Ver gestión">
          {data.operational_result ? (
            <>
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
              <Freshness
                updated={data.operational_result.last_updated}
                source={data.operational_result.source}
              />
            </>
          ) : (
            <NoData />
          )}
        </DashCard>
      </div>

      {/* Qué hacer primero — decisiones publicadas por el servidor, sin límite local. */}
      {actions.length > 0 && (
        <QavanteCard
          variant="bordered"
          header={
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-mid">
              Qué hacer primero
            </span>
          }
        >
          <ul className="divide-y divide-border">
            {actions.map((a, i) => (
              <li
                key={`${a.priority}-${i}`}
                className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary-50 text-[11px] font-bold text-brand-primary">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-dark">{a.reason}</p>
                    {a.amount && (
                      <p className="text-sm font-semibold tabular-nums text-neutral-dark">
                        {formatClp(parseAmount(a.amount))}
                        {a.impact_label && (
                          <span className="ml-1 text-xs font-normal text-neutral-mid">
                            {a.impact_label}
                          </span>
                        )}
                      </p>
                    )}
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

/* Las dos superficies del MISMO hecho (banner de ancho completo + línea de la card del grid) se
   leen juntas, así que comparten vocabulario y, sobre todo, comparten el NÚMERO: la brecha que
   publica el backend (`cash_gap_amount_14d`), leída por `describeCashGap14d`.

   Lo que ninguna de las dos hace (D01/D03, #296): reconstruir la brecha como "críticas menos
   caja" ni publicar el saldo final con el signo cambiado. El fixture canónico del repo tiene
   brecha 14.000.000 con saldo final −10.000.000: la versión anterior mostraba el segundo con el
   apellido del primero. Las tres cifras del contrato se muestran cada una con su nombre y NUNCA
   combinadas; lo ausente dice "Sin dato", no "$0".

   Exportadas y sin hooks de datos a propósito: el signo y el apellido de una cifra de plata se
   fijan en un test de función pura (`cash-gap-banner.test.tsx`), no sólo en Storybook (#54). */

/** "Mínimo a 14 días · saldo al día 14 · pagos críticos", cada uno con su nombre; `null` → "Sin dato". */
function CifrasBrecha({ minimo, saldoFinal, criticas }: CashGap14dCifras) {
  const cifra = (v: number | null) => (
    <span className="tabular-nums text-neutral-dark">{v == null ? "Sin dato" : formatClp(v)}</span>
  );
  return (
    <>
      Mínimo a 14 días {cifra(minimo)} · saldo al día 14 {cifra(saldoFinal)} · pagos críticos{" "}
      {cifra(criticas)}
    </>
  );
}

export function CashGapCardLine({ summary }: { summary: CashGap14dInput }) {
  const gap = describeCashGap14d(summary);
  if (gap.kind === "sin_dato" || gap.kind === "cubierto") return null;
  return (
    <div className="flex items-start gap-2 text-sm text-danger-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      {gap.kind === "brecha" ? (
        <span>
          Te faltan <b className="tabular-nums">{formatClp(gap.faltante)}</b> para que tu caja no
          quede bajo cero en 14 días.
        </span>
      ) : (
        <span>Hay una brecha de caja declarada para los próximos 14 días.</span>
      )}
    </div>
  );
}

/* Banner de brecha de caja (answer-first): el FALTANTE es el número que dispara la acción —
   protagonista; el desglose (mínimo / saldo final / críticas) es respaldo, más chico. Clickeable
   al detalle de proyección. Rinde `null` sin brecha declarada: no hay "todo bien" acá. */
export function CashGapBanner({ summary }: { summary: CashGap14dInput }) {
  const gap = describeCashGap14d(summary);
  if (gap.kind === "sin_dato" || gap.kind === "cubierto") return null;
  return (
    <Link
      href="/caja/proyeccion"
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
    >
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-500/40 bg-danger-50 p-4 transition-colors group-hover:border-danger-500/60"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-danger-700">
              {gap.kind === "brecha" ? (
                <>
                  Te faltan <span className="tabular-nums">{formatClp(gap.faltante)}</span> para que
                  tu caja no quede bajo cero en los próximos 14 días
                </>
              ) : (
                <>Hay una brecha de caja declarada para los próximos 14 días</>
              )}
            </p>
            <p className="mt-0.5 text-xs text-neutral-mid">
              <CifrasBrecha {...gap} />
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-danger-700">
          Ver proyección
          <ArrowRight
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Link>
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

/* Etiqueta legible de la fuente del dato (Ola 3 #5: `source` = última sync de la
   fuente). Fallback al valor crudo si no está mapeado. */
const SOURCE_LABEL: Record<string, string> = {
  banco: "Banco",
  bice: "Banco",
  sii_rcv: "SII",
  sii: "SII",
  buk: "BUK",
};

/* Capa de confianza: frescura + estado + fuente del dato. Un número sin origen no
   se cree. `updated` puede venir null (dato sin timestamp) → no renderizamos nada. */
function Freshness({
  updated,
  state,
  source,
}: {
  updated?: string | null;
  state?: string | null;
  source?: string | null;
}) {
  if (!updated) return null;
  return (
    <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-neutral-mid">
      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
      Actualizado {formatDateTimeLike(updated)}
      {source && ` · ${SOURCE_LABEL[source] ?? source}`}
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
      description="Todavía no hay datos para mostrar. Cuando conectes tu banco y el SII, acá vas a ver tu Pulso, tu caja, alertas y las acciones prioritarias."
      cta={
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/conexiones">
            <QavanteButton size="sm">Conectar banco</QavanteButton>
          </Link>
          <Link href="/administracion/credenciales">
            <QavanteButton size="sm" variant="ghost">
              Conectar SII
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
