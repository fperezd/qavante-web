"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useAccountsPayable, type PayableItem, type PayableCurrencyTotal } from "@/lib/api/pagos";
import { usePreferences } from "@/lib/api/preferences";
import { useMaestroDocs } from "@/components/terminos/use-maestro-docs";
import { buildMaestro, readTerminos, readPagados } from "@/components/terminos/terminos-pago";
import { parseAmount } from "../pagos-format";
import { payrollPeriodFromExternalId } from "../pagos-group";
import { formatMoney } from "@/lib/formatters/clp";
import { MONTO_EN_REVISION } from "@/lib/formatters/amount";
import { PagarV2View, type PagarMovible } from "./pagar-v2-view";
import { PagarHero } from "./pagar-hero";
import { CashProjectionRunPanel } from "@/components/cash-projection-runs/cash-projection-run-panel";
import { FechasClaveMes } from "./fechas-clave-mes";
import { VencimientosTimeline, type Vencimiento } from "./vencimientos-timeline";
import { ConcentracionClientes } from "@/components/sii/libro-v2/concentracion-clientes";
import { useTableSort, type SortColumn } from "@/lib/hooks/use-table-sort";
import { SortBar } from "@/components/filters/sort-bar";
import {
  HERO_TOTAL_HINT,
  mapVencimientos,
  mapFechasClave,
  mapConcentracion,
  cpToPayableItem,
  type VencimientosOrder,
  type OnClickDe,
} from "./pagar-v2-map";

/** Destino del drill-down de un pago (regla "todo dato lleva a su detalle"). Sueldos →
 *  detalle por empleado del período; impuestos → panel F29. Otros aún sin destino → sin link
 *  (no se renderean clickeables). */
function hrefDePago(item: PayableItem): string | undefined {
  if (item.category === "payroll") {
    const period = payrollPeriodFromExternalId(item.source_external_id);
    return period ? `/remuneraciones?period=${period}` : "/remuneraciones";
  }
  if (item.category === "tax") return "/pagar/impuestos";
  return undefined;
}

/* Vista LIVE de Pagar v2 (rediseño aprobado 2026-07-14), gated por `pagarV2`, HOY ON en
   producción (`wrangler.toml`).
   Orquesta `accounts-payable` (contrato ya vivo) y compone `PagarV2View`. Todo lo que
   la pantalla muestra se deriva en el mapper puro (`pagar-v2-map`): vencimientos, las 3
   del mes, mayores compromisos y las señales de caja. Degradado honesto: en estado
   `partial` (devengado vacío) el backend omite `items` → defaulteamos a [] y mostramos el
   vacío honesto; la postergabilidad es HEURÍSTICA hasta que CC-API mande el flag por ítem.
   Container: NO se testea por Storybook play (ADR-0018); la lógica vive en `pagar-v2-map`. */

// `new Date()` en runtime del cliente: la vista es "use client", corre en el browser (no en
// build ni en el Worker) — no hay riesgo de fecha congelada del SSR para los cálculos de días.
function ahora(): Date {
  return new Date();
}

/* Columnas ordenables de "Por vencer y vencidos" (regla de producto). Por defecto
   (sortKey null) respeta el orden CURADO por urgencia; el usuario puede reordenar. */
const VENC_COLS: SortColumn<Vencimiento>[] = [
  { key: "vencimiento", kind: "date", get: (v) => v.dueDate ?? null },
  { key: "monto", kind: "number", get: (v) => v.monto },
  { key: "acreedor", kind: "text", get: (v) => v.acreedor },
];

export function PagarV2ViewLive({
  suppressRecommendations = false,
}: {
  /** El brief server-owned reemplaza sólo el diagnóstico/plan local, no las tablas de pagos. */
  suppressRecommendations?: boolean;
}) {
  const ap = useAccountsPayable();
  const comprasDocs = useMaestroDocs("compras");
  const honorariosDocs = useMaestroDocs("honorarios");
  const prefs = usePreferences();
  const router = useRouter();
  const now = React.useMemo(() => ahora(), []);
  const vencSort = useTableSort(VENC_COLS, null);

  // DOS UNIVERSOS, declarados: el TITULAR es `resp.total`, el agregado del servidor sobre todo
  // el registro de accounts-payable. La TABLA compone otro universo: proveedores desde el maestro
  // RCV compras (net NC, conciliado, vencido derivado), honorarios desde el BHE y el resto
  // (sueldos/impuestos/manuales, no-DTE) desde accounts-payable. Unificarlos es semántica
  // financiera visible (R2) y queda fuera de #302; acá sólo se cuida que el hint del titular
  // describa el NÚMERO (`HERO_TOTAL_HINT`) y no la composición de la tabla. Totales, conteos y
  // ventanas ejecutivas salen exclusivamente de los agregados del servidor, nunca de esta lista.
  const { supplierItems, honorariosItems } = React.useMemo(() => {
    const terminos = readTerminos(prefs.data?.preferences);
    const pagados = readPagados(prefs.data?.preferences);
    const cCps = comprasDocs.docs.length
      ? buildMaestro(comprasDocs.docs, terminos, "compras", now, pagados)
      : [];
    const hCps = honorariosDocs.docs.length
      ? buildMaestro(honorariosDocs.docs, terminos, "honorarios", now, pagados)
      : [];
    const notNull = (x: PayableItem | null): x is PayableItem => x != null;
    return {
      supplierItems: cCps.map((cp) => cpToPayableItem(cp, "SII · compras")).filter(notNull),
      honorariosItems: hCps.map((cp) => cpToPayableItem(cp, "SII · honorarios")).filter(notNull),
    };
  }, [comprasDocs.docs, honorariosDocs.docs, prefs.data, now]);

  // Esperar a las PREFS (conciliaciones): sin ellas, buildMaestro trata las compras/honorarios como
  // impagas → obligaciones ya pagadas se contarían de nuevo (race).
  if (prefs.isLoading) return <LiveSkeleton />;
  if (ap.isLoading) return <LiveSkeleton />;
  if (ap.isError) {
    return (
      <QavanteInlineError
        error={ap.error}
        what="tus cuentas por pagar"
        onRetry={() => ap.refetch()}
      />
    );
  }

  const resp = ap.data;
  // accounts-payable aporta lo NO-proveedor (sueldos, impuestos, arriendos, deuda, manuales).
  const apItems = (resp?.items ?? []).filter((it) => it.category !== "supplier");
  const items = [...apItems, ...supplierItems, ...honorariosItems];
  /* D02 — el total es el agregado del servidor sobre TODO el registro, no la suma de la lista
     traída, que viene topeada por `limit`. */
  // #907: `total: null` es DESCONOCIDO (cuarentena), nunca "sin pagos".
  const montoTotal = resp?.total == null ? null : parseAmount(resp.total);
  if (montoTotal === 0 && items.length === 0) {
    return (
      <EmptyState
        missing={resp?.missing_sources}
        suppressRecommendations={suppressRecommendations}
      />
    );
  }

  const onClickDe: OnClickDe = (item) => {
    const href = hrefDePago(item);
    return href ? () => router.push(href) : undefined;
  };
  /* D02 — los tramos son los que publica el contrato, no una suma de la lista visible. */
  const due7 = resp?.due_7d == null ? null : parseAmount(resp.due_7d);
  const due30 = resp?.due_30d == null ? null : parseAmount(resp.due_30d);

  /* D01 — la brecha NO se resta acá: la publica el run canónico del backend, que ocupa el slot
     `estadoCaja`. Por eso esta pantalla ya no arma su mapa de brecha local ni el helper que
     restaba obligaciones contra la caja; el guard de `no-local-cash-gap` lo fija. */

  // "Las 3 del mes" elige localmente un subconjunto de pagos. Con el Brief activo,
  // la evidencia queda completa y cronológica; la selección de qué mirar pertenece al servidor.
  const fechas = suppressRecommendations ? [] : mapFechasClave(items, now, onClickDe);

  // Con brief canónico la tabla es evidencia cronológica: no reusa el ranking ni la
  // postergabilidad heurística del flujo heredado.
  const vencimientosOrder: VencimientosOrder = suppressRecommendations
    ? "chronological"
    : "urgency";
  const vencimientos = mapVencimientos(items, now, onClickDe, {
    order: vencimientosOrder,
    includePostergabilidad: !suppressRecommendations,
  });
  const vencidosVisibles = vencimientos.filter((item) => item.vencido).length;
  const vencimientosSorted = suppressRecommendations ? vencimientos : vencSort.sorted(vencimientos);
  const vencSortControl =
    !suppressRecommendations && vencimientos.length > 1 ? (
      <SortBar
        options={[
          { key: "urgencia", label: "Urgencia" },
          { key: "vencimiento", label: "Vencimiento" },
          { key: "monto", label: "Monto" },
          { key: "acreedor", label: "Acreedor" },
        ]}
        activeKey={vencSort.sortKey ?? "urgencia"}
        dir={vencSort.sortDir}
        onSelect={(key) => (key === "urgencia" ? vencSort.reset() : vencSort.toggle(key))}
      />
    ) : null;

  return (
    <PagarV2View
      hero={
        !suppressRecommendations && (
          <PagarHero
            titulo={
              resp?.data_state === "available"
                ? "La empresa debe pagar"
                : "Monto conocido por pagar"
            }
            montoTotal={montoTotal}
            cobertura="La cobertura se lee en la proyección canónica de 14 días."
            coberturaTono="neutral"
            subtitulo={subtitulo(resp?.items_total, resp?.has_more)}
            infoHint={HERO_TOTAL_HINT}
          />
        )
      }
      /* Con el Brief activo la lectura de caja la publica él: esta pantalla no monta una segunda
         foto del mismo corte. Sin Brief, el slot lo llena el run canónico del backend. */
      estadoCaja={
        suppressRecommendations ? null : (
          <CashProjectionRunPanel horizonDays={14} title="Caja para decidir pagos" />
        )
      }
      secundarios={<Secundarios due7={due7} due30={due30} usd={resp?.total_by_currency} />}
      fechasClave={
        /* Con el Brief activo no hay selección local: el slot queda vacío de verdad (null), no
           con un relleno que ocupe la grilla. */
        suppressRecommendations ? null : fechas.length > 0 ? (
          <FechasClaveMes titulo="Obligaciones clave del detalle visible" items={fechas} />
        ) : (
          <div />
        )
      }
      movibles={buildMovibles(
        items,
        vencidosVisibles,
        vencimientosSorted,
        vencSortControl,
        vencimientosOrder,
        !suppressRecommendations,
      )}
    />
  );
}

function subtitulo(itemsTotal: number | undefined, hasMore: boolean | undefined): string {
  if (itemsTotal == null) return "Detalle disponible de obligaciones pendientes";
  const base = `${itemsTotal} ${itemsTotal === 1 ? "obligación con vencimiento" : "obligaciones con vencimiento"}`;
  return hasMore ? `${base} · se muestran las más próximas` : base;
}

/** Desglose secundario: ventanas y monedas agregadas por el servidor antes de paginar. */
function Secundarios({
  due7,
  due30,
  usd,
}: {
  /** `null` = en revisión de conciliación (qavante-api#907). */
  due7: number | null;
  due30: number | null;
  usd?: PayableCurrencyTotal[];
}) {
  // Desglose por moneda extranjera (CC-API #560): la primera != CLP.
  const usdItem = usd?.find(
    (c) => c.currency_status === "verified" && c.currency != null && c.currency !== "CLP",
  );

  const row = (k: string, v: string, tono: string, dashed = true) => (
    <div
      className={`flex items-baseline justify-between gap-3 py-1.5 ${dashed ? "border-t border-dashed border-border" : ""}`}
    >
      <dt className="text-neutral-mid">{k}</dt>
      <dd className={`font-bold tabular-nums ${tono}`}>{v}</dd>
    </div>
  );

  return (
    <div className="p-5">
      <dl className="flex flex-col text-[13px]">
        {row(
          "Próximos 7 días",
          due7 == null ? MONTO_EN_REVISION : formatMoney(due7, "CLP"),
          "text-warning-700",
          false,
        )}
        {row(
          "Próximos 30 días",
          due30 == null ? MONTO_EN_REVISION : formatMoney(due30, "CLP"),
          "text-neutral-dark",
        )}
        {usdItem &&
          row(
            "En dólares",
            usdItem.amount == null
              ? MONTO_EN_REVISION
              : formatMoney(parseAmount(usdItem.amount), usdItem.currency),
            "text-brand-primary",
          )}
      </dl>
    </div>
  );
}

/** Cajas movibles: "Por vencer y vencidos" + "Mayores compromisos". Solo las que tienen dato. */
function buildMovibles(
  items: PayableItem[],
  vencidos: number,
  vencimientos: Vencimiento[],
  sortControl: React.ReactNode,
  order: VencimientosOrder,
  includeConcentracion: boolean,
): PagarMovible[] {
  const out: PagarMovible[] = [];

  if (vencimientos.length > 0) {
    out.push({
      id: "vencimientos",
      label: "Por vencer y vencidos",
      node: (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-neutral-dark">Por vencer y vencidos</h2>
            <span className="rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-[11.5px] font-bold text-brand-primary">
              {items.length} {items.length === 1 ? "pago mostrado" : "pagos mostrados"}
            </span>
            {vencidos > 0 && (
              <span className="rounded-full bg-danger-500/10 px-2.5 py-0.5 text-[11.5px] font-bold text-danger-500">
                {vencidos} {vencidos === 1 ? "vencido visible" : "vencidos visibles"}
              </span>
            )}
            {sortControl && <div className="ml-auto">{sortControl}</div>}
          </div>
          <VencimientosTimeline items={vencimientos} order={order} />
        </div>
      ),
    });
  }

  // "Mayores compromisos" ordena y recorta por monto en el cliente. Es útil en la
  // vista heredada, pero sería una segunda prioridad cuando existe el Brief canónico.
  const compromisos = includeConcentracion ? mapConcentracion(items) : [];
  if (compromisos.length > 0) {
    out.push({
      id: "compromisos",
      label: "Mayores compromisos",
      node: (
        <ConcentracionClientes
          titulo="Mayores compromisos del detalle visible"
          items={compromisos}
          emptyLabel="Sin pagos en el período."
        />
      ),
    });
  }

  return out;
}

function LiveSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="h-28 animate-pulse rounded-xl bg-surface-muted" />
      <div className="h-24 animate-pulse rounded-xl bg-surface-muted" />
      <div className="h-64 animate-pulse rounded-xl bg-surface-muted" />
      <span className="sr-only">Cargando tus cuentas por pagar…</span>
    </div>
  );
}

function EmptyState({
  missing,
  suppressRecommendations,
}: {
  missing?: string[];
  suppressRecommendations: boolean;
}) {
  const falta = missing && missing.length > 0 ? missing.join(" · ") : null;
  return (
    <QavanteEmpty
      icon={Wallet}
      title="Aún no hay pagos por mostrar"
      description={
        suppressRecommendations
          ? falta
            ? `Falta sincronizar: ${falta}. Cuando llegue el detalle vas a ver aquí los pagos y compromisos registrados.`
            : "Conecta tus fuentes para ver los pagos y compromisos que respaldan la decisión."
          : falta
            ? `Falta sincronizar: ${falta}. Cuando llegue el detalle vas a ver acá tus vencimientos, las 3 del mes y el estado de caja.`
            : "Conecta tu SII y tu banco para ver tus vencimientos, las 3 del mes y cuánto de eso cubre tu caja."
      }
    />
  );
}
