"use client";

import * as React from "react";
import { QavanteInlineError } from "@/components/qavante";
import { useDashboardSummary, type DashboardSummaryV2 } from "@/lib/api/dashboard";
import {
  useCollectionForecast,
  useCashCycle,
  type CollectionForecastResponse,
  type CashCycleResponse,
} from "@/lib/api/treasury";
import { usePreferences, useUpdatePreferences } from "@/lib/api/preferences";
import { formatClp } from "@/lib/formatters/clp";
import { isEmptySummary, parseAmount } from "../dashboard-format";
import { InicioEjecutivoV2 } from "./inicio-ejecutivo-v2";
import { AccionesList, type Accion } from "./acciones-list";
import { BrechaPlan } from "./brecha-plan";
import { DraggableCard } from "./draggable-card";
import { type Termometro } from "./termometros";
import { CajaProyeccion } from "./caja-proyeccion";
import { CobranzaRealizable } from "./cobranza-realizable";
import { PagosTimeline } from "./pagos-timeline";
import { ResultadoPreliminar } from "./resultado-preliminar";
import { applyWidgetOrder, moveItem, readWidgetOrder, withWidgetOrder } from "./widget-order";
import {
  mapBrechaTotal,
  mapCaja,
  cicloCajaExtra,
  mapCobranza,
  mapCobranzaForecast,
  mapFrase,
  mapPlanBrecha,
  mapPagos,
  mapPulso,
  mapResultado,
} from "./inicio-v2-map";

/* Vista LIVE del Inicio Ejecutivo v2 (rediseño aprobado). Cablea los componentes
   presentacionales al `GET /api/dashboard/summary` vía el mapper puro, gated por
   `inicioEjecutivoV2` (OFF). Degradación honesta: cada pieza sin dato aún se omite
   o cae a una versión simple — nunca inventa. Se enciende sola cuando CC-API
   entrega Fase 2 (cobranza realizable, tendencia del Pulso, key_obligations,
   cash_sparkline, señales de crecimiento). Container: NO se testea por Storybook
   play (ADR-0018); la lógica vive testeada en `inicio-v2-map`. */

export function InicioEjecutivoV2Live() {
  const query = useDashboardSummary();
  // Fase 2: cobranza realizable. Query independiente que degrada solo (retry:false)
  // → si aún no responde, la Cobranza cae al total del summary (mapCobranza).
  const forecast = useCollectionForecast();
  const cashCycle = useCashCycle();

  if (query.isLoading) return <LiveSkeleton />;
  if (query.isError) {
    return (
      <QavanteInlineError error={query.error} what="tu resumen" onRetry={() => query.refetch()} />
    );
  }
  const data = query.data;
  if (!data || isEmptySummary(data)) return <EmptyState />;

  return <Assembled data={data} forecast={forecast.data} cashCycle={cashCycle.data} />;
}

/** Una tarjeta reordenable del grid de detalle. */
interface Widget {
  id: string;
  label: string;
  node: React.ReactNode;
}

function Assembled({
  data,
  forecast,
  cashCycle,
}: {
  data: DashboardSummaryV2;
  forecast?: CollectionForecastResponse;
  cashCycle?: CashCycleResponse;
}) {
  // Prefs del usuario en la empresa activa: orden de las tarjetas (persistido).
  const prefs = usePreferences();
  const updatePrefs = useUpdatePreferences();
  // Orden optimista local; hasta el primer arrastre, manda el guardado.
  const [localOrder, setLocalOrder] = React.useState<string[] | null>(null);

  const pulso = mapPulso(data);
  const caja = mapCaja(data);
  // Con collection-forecast (Fase 2) → cobranza realizable con segmentos; sin él (o
  // forecast sin receivables → null), degrada al total por cobrar del summary.
  const cobranza = (forecast ? mapCobranzaForecast(forecast) : null) ?? mapCobranza(data);
  const pagos = mapPagos(data, new Date());
  const resultado = mapResultado(data);
  // Enriquecer el Resultado con el ciclo de caja (DSO/DPO) si cash-cycle respondió.
  if (resultado) {
    const ciclo = cicloCajaExtra(cashCycle);
    if (ciclo) resultado.extra = [...resultado.extra, ciclo];
  }

  // Tarjetas presentes ESTE render (cada bloque sin dato se omite → omite lo ausente).
  const widgets: Widget[] = [];
  if (caja) widgets.push({ id: "caja", label: "Caja proyectada", node: <CajaProyeccion {...caja} /> });
  if (cobranza)
    widgets.push({ id: "cobranza", label: "Cobranza realizable", node: <CobranzaRealizable {...cobranza} /> });
  if (pagos) widgets.push({ id: "pagos", label: "Pagos del mes", node: <PagosTimeline {...pagos} /> });
  if (resultado)
    widgets.push({ id: "resultado", label: "Resultado", node: <ResultadoPreliminar {...resultado} /> });

  // Orden efectivo: el arrastre local (optimista) o, si no hubo, el guardado en prefs.
  const savedOrder = readWidgetOrder(prefs.data?.preferences);
  const ordered = applyWidgetOrder(widgets, localOrder ?? savedOrder);
  // Reordena y persiste. Solo persiste si el GET de prefs tuvo éxito: el PUT REEMPLAZA
  // el blob completo, así que escribir sobre un GET fallido pisaría el resto de prefs.
  const reorder = (from: number, to: number) => {
    const currentIds = ordered.map((w) => w.id);
    const nextIds = moveItem(currentIds, from, to);
    if (nextIds === currentIds) return; // moveItem devolvió el mismo ref = no-op / fuera de rango
    setLocalOrder(nextIds);
    if (prefs.isSuccess) updatePrefs.mutate(withWidgetOrder(prefs.data?.preferences, nextIds));
  };
  // Reordenable solo con ≥2 tarjetas; si hay una sola, se muestra sin asas.
  const reorderable = ordered.length >= 2;
  const grid: React.ReactNode[] = ordered.map((w, i) =>
    reorderable ? (
      <DraggableCard key={w.id} label={w.label} index={i} count={ordered.length} onMove={reorder}>
        {w.node}
      </DraggableCard>
    ) : (
      <React.Fragment key={w.id}>{w.node}</React.Fragment>
    ),
  );

  // Plan: con brecha real (cash_gap) + forecast → plan de cierre cuantificado
  // (BrechaPlan). Sin eso, cae a "Qué hacer primero" desde priority_actions.
  const brechaTotal = mapBrechaTotal(data);
  const planBrecha = brechaTotal != null && forecast ? mapPlanBrecha(brechaTotal, forecast) : null;
  const acciones = buildAcciones(data);
  const plan = planBrecha ? (
    <BrechaPlan {...planBrecha} />
  ) : acciones.length > 0 ? (
    <AccionesList titulo="Qué hacer primero" acciones={acciones} />
  ) : null;

  return (
    <InicioEjecutivoV2
      frase={mapFrase(data)}
      termometros={buildTermometros(data)}
      pulso={pulso ?? undefined}
      plan={plan}
      grid={grid}
    />
  );
}

/** Termómetros con dato real. Q1 (continuidad) y Q2 (rentabilidad) se responden
 *  desde el summary; Q3 (crecimiento) se OMITE hasta que existan las señales del
 *  SII (no se anuncia la carencia). */
function buildTermometros(s: DashboardSummaryV2): Termometro[] {
  const items: Termometro[] = [];

  // Q1 continuidad — SOLO con el bloque `cash_gap` (el que dice si la caja cubre).
  // El pill Y la respuesta salen de la MISMA fuente (la brecha), nunca del Pulso por
  // separado: así no puede haber "🔴 Crítico" con texto "cubre", ni afirmar cobertura
  // sin dato de caja.
  if (s.cash_gap) {
    const gap = mapBrechaTotal(s); // >0 si hay brecha real, null si no
    const hasGap = gap != null;
    items.push({
      n: 1,
      pregunta: "¿La caja cubre la operación?",
      pill: hasGap ? "🔴 Crítico" : "🟢 Holgado",
      pillTono: hasGap ? "crit" : "ok",
      destacado: hasGap ? "crit" : "ok",
      respuesta: hasGap
        ? `La empresa debe asegurar ${formatClp(gap)} para sus pagos de 14 días.`
        : "La caja proyectada cubre las obligaciones críticas de los próximos 14 días.",
      masLabel: "Ver caja →",
      masHref: "/caja/proyeccion",
    });
  }

  if (s.operational_result) {
    const r = parseAmount(s.operational_result.result);
    const ingresos = parseAmount(s.operational_result.revenue);
    const margen = ingresos > 0 ? Math.round((r / ingresos) * 100) : null;
    items.push({
      n: 2,
      pregunta: "¿La empresa está ganando dinero?",
      pill: r >= 0 ? "🟢 Positivo" : "🔴 Pérdida",
      pillTono: r >= 0 ? "ok" : "crit",
      respuesta: `Resultado ${formatClp(r)}${margen != null ? ` · margen ${margen}%` : ""}.`,
      masLabel: "Ver rentabilidad →",
      masHref: "/gestion",
    });
  }

  return items;
}

/** "Qué hacer primero" desde `priority_actions` (dato del summary). El plan de
 *  cierre de brecha cuantificado llega con collection-forecast (Fase 2). */
function buildAcciones(s: DashboardSummaryV2): Accion[] {
  return (s.priority_actions ?? []).slice(0, 3).map((a, i) => ({
    rank: i + 1,
    titulo: a.reason,
    detalle: a.amount ? (
      <>
        <span className="font-bold tabular-nums text-neutral-dark">
          {formatClp(parseAmount(a.amount))}
        </span>
        {a.impact_label ? ` ${a.impact_label}` : ""}
      </>
    ) : (
      ""
    ),
    plazo: a.deadline ? `Plazo: ${a.deadline}` : "",
    plazoTono: i === 0 ? "hot" : "neutral",
    cta: a.cta_label,
    href: a.cta_href,
    critica: i === 0,
  }));
}

function LiveSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-6 w-3/4 animate-pulse rounded bg-surface-muted" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-surface-muted" />
        ))}
      </div>
      <div className="grid gap-3.5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
      </div>
      <span className="sr-only">Cargando tu resumen…</span>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
      <p className="text-sm text-neutral-mid">
        Aún no hay datos para tu Inicio. Conecta tus fuentes (SII, banco) y volvé cuando se
        sincronicen.
      </p>
    </div>
  );
}
