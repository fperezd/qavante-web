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
import { isOverdue } from "../pagos-v2-format";
import { payrollPeriodFromExternalId } from "../pagos-group";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { calcularBrecha } from "./brecha-caja-model";
import { PagarV2View, type PagarMovible } from "./pagar-v2-view";
import { PagarHero } from "./pagar-hero";
import { BrechaCaja } from "./brecha-caja";
import { FechasClaveMes } from "./fechas-clave-mes";
import { VencimientosTimeline, type Vencimiento } from "./vencimientos-timeline";
import { ConcentracionClientes } from "@/components/sii/libro-v2/concentracion-clientes";
import { useTableSort, type SortColumn } from "@/lib/hooks/use-table-sort";
import { SortBar } from "@/components/filters/sort-bar";
import {
  mapVencimientos,
  mapFechasClave,
  mapConcentracion,
  mapBrecha,
  overdueCLP,
  montoCLP,
  cpToPayableItem,
  sumItemsHasta,
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

/* Vista LIVE de Pagar v2 (rediseño aprobado 2026-07-14), gated por `pagarV2` (OFF).
   Orquesta `accounts-payable` (contrato ya vivo) y compone `PagarV2View`. Todo lo que
   la pantalla muestra se deriva en el mapper puro (`pagar-v2-map`): vencimientos, las 3
   del mes, mayores compromisos y la brecha de caja. Degradado honesto: en estado
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

export function PagarV2ViewLive() {
  const ap = useAccountsPayable();
  const comprasDocs = useMaestroDocs("compras");
  const honorariosDocs = useMaestroDocs("honorarios");
  const prefs = usePreferences();
  const router = useRouter();
  const now = React.useMemo(() => ahora(), []);
  const vencSort = useTableSort(VENC_COLS, null);

  // UNIFICACIÓN: los PROVEEDORES salen del maestro RCV compras (net NC, conciliado, vencido
  // derivado) y los HONORARIOS del BHE — el detalle que accounts-payable OMITE (partial) y que
  // sobreestima al no netear NC. Sueldos/impuestos/manuales se toman de accounts-payable (no-DTE).
  // El total se recalcula desde los ítems combinados; accounts-payable NO trae items 'supplier'
  // → sin doble-conteo.
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

  const rcvItems = supplierItems.length + honorariosItems.length;
  // Esperar a las PREFS (conciliaciones): sin ellas, buildMaestro trata las compras/honorarios como
  // impagas → obligaciones ya pagadas se contarían de nuevo (race).
  if (prefs.isLoading) return <LiveSkeleton />;
  if (ap.isLoading && rcvItems === 0) return <LiveSkeleton />;
  if (ap.isError && rcvItems === 0) {
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
  const montoTotal = items.reduce((s, it) => s + montoCLP(it), 0);
  if (montoTotal === 0 && items.length === 0) return <EmptyState missing={resp?.missing_sources} />;

  const onClickDe: OnClickDe = (item) => {
    const href = hrefDePago(item);
    return href ? () => router.push(href) : undefined;
  };
  const brecha = mapBrecha(resp, items, now);
  // Sin caja proyectada (null) no calculamos cobertura: no afirmamos "la caja no alcanza"
  // sobre un $0 inventado. La línea del hero degrada a neutral.
  const cobertura =
    brecha.cajaProyectada == null
      ? null
      : calcularBrecha(brecha.cajaProyectada, brecha.pagosCriticos);
  const vencidos = items.filter((it) => isOverdue(it, now)).length;
  const due7 = sumItemsHasta(items, now, 7);
  const due30 = sumItemsHasta(items, now, 30);

  const fechas = mapFechasClave(items, now, onClickDe);
  const totalFechas = fechas.reduce((s, f) => s + f.monto, 0);

  // "Por vencer y vencidos": curado por urgencia por defecto, reordenable por el usuario.
  const vencimientos = mapVencimientos(items, now, onClickDe);
  const vencimientosSorted = vencSort.sorted(vencimientos);
  const vencSortControl =
    vencimientos.length > 1 ? (
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
        <PagarHero
          titulo="La empresa debe pagar"
          montoTotal={montoTotal}
          cobertura={
            cobertura
              ? coberturaLinea(cobertura.cubre, cobertura.faltante, cobertura.holgura)
              : "Aún no podemos decir si la caja alcanza: falta la caja proyectada a 14 días."
          }
          coberturaTono={cobertura ? (cobertura.cubre ? "ok" : "bad") : "neutral"}
          subtitulo={subtitulo(items.length, vencidos)}
          infoHint="Total de pagos y obligaciones pendientes: proveedores (net de notas de crédito) y honorarios del SII, más impuestos, cotizaciones, sueldos, arriendos y deuda. La cobertura compara la caja proyectada a 14 días contra lo que no se puede postergar."
        />
      }
      brecha={
        <BrechaCaja
          cajaProyectada={brecha.cajaProyectada}
          pagosCriticos={brecha.pagosCriticos}
          dias={14}
          postergable={brecha.postergable}
          // Hoy la postergabilidad la infiere el FE por tipo de pago (heurística); el backend aún
          // no manda un flag por documento (A3, escalado). Cuando llegue, pasar `false`.
          postergabilidadEstimada
        />
      }
      secundarios={
        <Secundarios
          items={items}
          due7={due7}
          due30={due30}
          usd={resp?.total_by_currency}
          now={now}
        />
      }
      fechasClave={
        fechas.length > 0 ? <FechasClaveMes items={fechas} total={totalFechas} /> : <div />
      }
      movibles={buildMovibles(items, vencidos, vencimientosSorted, vencSortControl)}
    />
  );
}

function coberturaLinea(cubre: boolean, faltante: number, holgura: number): React.ReactNode {
  if (cubre) {
    return (
      <>
        La caja alcanza para los pagos críticos de 14 días · holgura <b>{formatClp(holgura)}</b>.
      </>
    );
  }
  return (
    <>
      La caja no alcanza: faltan <b>{formatClp(faltante)}</b> para los pagos críticos de 14 días.
    </>
  );
}

function subtitulo(total: number, vencidos: number): string {
  const partes = [`${total} ${total === 1 ? "pago pendiente" : "pagos pendientes"}`];
  if (vencidos > 0) partes.push(`${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}`);
  return partes.join(" · ");
}

/** Desglose secundario: vencido / próximos 7d / este mes / en dólares (si hay). Los montos por
 *  ventana se recalculan desde los ítems combinados (no de accounts-payable, que sobreestima). */
function Secundarios({
  items,
  due7,
  due30,
  usd,
  now,
}: {
  items: PayableItem[];
  due7: number;
  due30: number;
  usd?: PayableCurrencyTotal[];
  now: Date;
}) {
  const vencido = overdueCLP(items, now);
  const prox7 = due7;
  const mes = due30;
  // Desglose por moneda extranjera (CC-API #560): la primera != CLP.
  const usdItem = usd?.find((c) => c.currency.toUpperCase() !== "CLP");

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
          "Vencido",
          formatClp(vencido),
          vencido > 0 ? "text-danger-500" : "text-neutral-dark",
          false,
        )}
        {row("Próximos 7 días", formatClp(prox7), "text-warning-700")}
        {row("Este mes", formatClp(mes), "text-neutral-dark")}
        {usdItem &&
          row(
            "En dólares",
            formatMoney(parseAmount(usdItem.amount), usdItem.currency),
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
              {items.length} {items.length === 1 ? "pago" : "pagos"}
            </span>
            {vencidos > 0 && (
              <span className="rounded-full bg-danger-500/10 px-2.5 py-0.5 text-[11.5px] font-bold text-danger-500">
                {vencidos} {vencidos === 1 ? "vencido" : "vencidos"}
              </span>
            )}
            {sortControl && <div className="ml-auto">{sortControl}</div>}
          </div>
          <VencimientosTimeline items={vencimientos} />
        </div>
      ),
    });
  }

  const compromisos = mapConcentracion(items);
  if (compromisos.length > 0) {
    out.push({
      id: "compromisos",
      label: "Mayores compromisos",
      node: (
        <ConcentracionClientes
          titulo="Mayores compromisos"
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

function EmptyState({ missing }: { missing?: string[] }) {
  const falta = missing && missing.length > 0 ? missing.join(" · ") : null;
  return (
    <QavanteEmpty
      icon={Wallet}
      title="Aún no hay pagos por mostrar"
      description={
        falta
          ? `Falta sincronizar: ${falta}. Cuando llegue el detalle vas a ver acá tus vencimientos, las 3 del mes y la brecha de caja.`
          : "Conecta tu SII y tu banco para ver tus vencimientos, las 3 del mes y cuánto de eso cubre tu caja."
      }
    />
  );
}
