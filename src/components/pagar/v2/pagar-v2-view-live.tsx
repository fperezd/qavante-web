"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, Info } from "lucide-react";
import { QavanteEmpty, QavanteInlineError } from "@/components/qavante";
import { useAccountsPayable, type PayableItem, type AccountsPayableResponse } from "@/lib/api/pagos";
import { parseAmount } from "../pagos-format";
import { isOverdue } from "../pagos-v2-format";
import { payrollPeriodFromExternalId } from "../pagos-group";
import { formatClp, formatMoney } from "@/lib/formatters/clp";
import { calcularBrecha } from "./brecha-caja-model";
import { PagarV2View, type PagarMovible } from "./pagar-v2-view";
import { PagarHero } from "./pagar-hero";
import { BrechaCaja } from "./brecha-caja";
import { FechasClaveMes } from "./fechas-clave-mes";
import { VencimientosTimeline } from "./vencimientos-timeline";
import { ConcentracionClientes } from "@/components/sii/libro-v2/concentracion-clientes";
import { mapVencimientos, mapFechasClave, mapConcentracion, mapBrecha, overdueCLP, type OnClickDe } from "./pagar-v2-map";

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

export function PagarV2ViewLive() {
  const ap = useAccountsPayable();
  const router = useRouter();

  if (ap.isLoading) return <LiveSkeleton />;
  if (ap.isError) {
    return <QavanteInlineError error={ap.error} what="tus cuentas por pagar" onRetry={() => ap.refetch()} />;
  }

  const resp = ap.data;
  const items = resp?.items ?? [];
  const montoTotal = parseAmount(resp?.total);
  if (montoTotal === 0 && items.length === 0) return <EmptyState missing={resp?.missing_sources} />;

  // Total > 0 pero SIN detalle (backend omite `items` en `partial`): no fingimos "0 pagos" ni
  // una cobertura tranquilizadora calculada sobre lista vacía. Mostramos el total + qué falta.
  if (items.length === 0) return <PartialState montoTotal={montoTotal} missing={resp?.missing_sources} />;

  const now = ahora();
  const onClickDe: OnClickDe = (item) => {
    const href = hrefDePago(item);
    return href ? () => router.push(href) : undefined;
  };
  const brecha = mapBrecha(resp as AccountsPayableResponse, items, now);
  const cobertura = calcularBrecha(brecha.cajaProyectada, brecha.pagosCriticos);
  const vencidos = items.filter((it) => isOverdue(it, now)).length;

  const fechas = mapFechasClave(items, now, onClickDe);
  const totalFechas = fechas.reduce((s, f) => s + f.monto, 0);

  return (
    <PagarV2View
      hero={
        <PagarHero
          titulo="La empresa debe pagar"
          montoTotal={montoTotal}
          cobertura={coberturaLinea(cobertura.cubre, cobertura.faltante, cobertura.holgura)}
          coberturaTono={cobertura.cubre ? "ok" : "bad"}
          subtitulo={subtitulo(items.length, vencidos)}
          infoHint="Total de pagos y obligaciones pendientes (proveedores, impuestos, cotizaciones, sueldos, arriendos y deuda). La cobertura compara la caja proyectada a 14 días contra lo que no se puede postergar."
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
      secundarios={<Secundarios items={items} resp={resp} now={now} />}
      fechasClave={fechas.length > 0 ? <FechasClaveMes items={fechas} total={totalFechas} /> : <div />}
      movibles={buildMovibles(items, vencidos, now, onClickDe)}
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

/** Desglose secundario: vencido / próximos 7d / este mes / en dólares (si hay). */
function Secundarios({
  items,
  resp,
  now,
}: {
  items: PayableItem[];
  resp: AccountsPayableResponse | undefined;
  now: Date;
}) {
  const vencido = overdueCLP(items, now);
  const prox7 = parseAmount(resp?.due_7d);
  const mes = parseAmount(resp?.due_30d);
  // Desglose por moneda extranjera (CC-API #560): la primera != CLP.
  const usd = resp?.total_by_currency?.find((c) => c.currency.toUpperCase() !== "CLP");

  const row = (k: string, v: string, tono: string, dashed = true) => (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${dashed ? "border-t border-dashed border-border" : ""}`}>
      <dt className="text-neutral-mid">{k}</dt>
      <dd className={`font-bold tabular-nums ${tono}`}>{v}</dd>
    </div>
  );

  return (
    <div className="p-5">
      <dl className="flex flex-col text-[13px]">
        {row("Vencido", formatClp(vencido), vencido > 0 ? "text-danger-500" : "text-neutral-dark", false)}
        {row("Próximos 7 días", formatClp(prox7), "text-warning-700")}
        {row("Este mes", formatClp(mes), "text-neutral-dark")}
        {usd && row("En dólares", formatMoney(parseAmount(usd.amount), usd.currency), "text-brand-primary")}
      </dl>
    </div>
  );
}

/** Cajas movibles: "Por vencer y vencidos" + "Mayores compromisos". Solo las que tienen dato. */
function buildMovibles(items: PayableItem[], vencidos: number, now: Date, onClickDe: OnClickDe): PagarMovible[] {
  const out: PagarMovible[] = [];

  const vencimientos = mapVencimientos(items, now, onClickDe);
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
      node: <ConcentracionClientes titulo="Mayores compromisos" items={compromisos} emptyLabel="Sin pagos en el período." />,
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

/** Parcial: hay un total por pagar pero el backend no mandó el detalle (`items`). Mostramos el
 *  total honestamente + qué falta sincronizar, SIN una cobertura/brecha calculada en el vacío. */
function PartialState({ montoTotal, missing }: { montoTotal: number; missing?: string[] }) {
  const falta = missing && missing.length > 0 ? missing.join(" · ") : null;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <p className="text-[11.5px] font-bold uppercase tracking-wide text-neutral-mid">La empresa debe pagar</p>
        <p className="mt-1.5 text-[33px] font-extrabold leading-none tracking-tight text-neutral-dark tabular-nums">
          {formatClp(montoTotal)}
        </p>
        <p className="mt-3 inline-flex items-start gap-1.5 text-[12.5px] text-neutral-mid">
          <Info className="mt-px size-4 shrink-0 text-warning-700" aria-hidden="true" />
          Todavía no llegó el detalle de tus pagos{falta ? ` (falta: ${falta})` : ""}. Cuando se sincronice
          vas a ver acá tus vencimientos, las 3 del mes y cuánto de eso cubre tu caja.
        </p>
      </div>
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
