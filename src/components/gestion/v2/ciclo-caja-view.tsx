"use client";

import * as React from "react";
import { ArrowRight, Clock, Wallet } from "lucide-react";
import { QavanteBadge, QavanteInlineError, QavanteStatTile } from "@/components/qavante";
import { useCashCycle, type CashCycleResponse } from "@/lib/api/treasury";
import { parseAmount } from "../gestion-format";
import { formatClp } from "@/lib/formatters/clp";

/* Gestión → Ciclo de caja (pedido de Fernando 2026-07-29, "las 3" de control de
   gestión). Responde "¿por qué gano pero no tengo plata?": DSO (días en cobrar),
   DPO (días en pagar) y CCC (días que tu plata queda atrapada). Reusa el hook
   `useCashCycle` (ya vive en el Inicio Ejecutivo, no se duplica). Degrada honesto
   cuando el backend no puede calcular el ratio (ventana dominada por NC → *_days
   null). Sin `export const runtime` (regla 4). */

/** Días → "N días" (redondeado) / "—" si null. */
function dias(n: number | null): string {
  if (n == null) return "—";
  const r = Math.round(n);
  return `${r} ${Math.abs(r) === 1 ? "día" : "días"}`;
}

/** Venta neta diaria de la ventana (para traducir días de ciclo a $ de caja). */
function ventaDiaria(c: CashCycleResponse): number {
  const rev = parseAmount(c.revenue_window);
  const diasVentana = Math.max(1, c.window_months) * 30;
  return rev > 0 ? rev / diasVentana : 0;
}

export function CicloCajaView() {
  const cash = useCashCycle();

  if (cash.isError) {
    return <QavanteInlineError error={cash.error} what="el ciclo de caja" />;
  }
  if (cash.isFetching && !cash.data) {
    return <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />;
  }
  if (!cash.data) return null;

  const c = cash.data;
  const dso = c.dso_days;
  const dpo = c.dpo_days;
  const ccc = c.ccc_days;
  const ar = parseAmount(c.ar_total);
  const ap = parseAmount(c.ap_total);

  return (
    <div className="space-y-5">
      {/* Hero: el veredicto en lenguaje de dueño */}
      <VeredictoCiclo ccc={ccc} dso={dso} venta={ventaDiaria(c)} />

      {/* Los tres números */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QavanteStatTile
          label="Cobras en"
          value={dias(dso)}
          tone="default"
          hint="Días que tarda tu plata en volver desde que vendes (DSO)."
        />
        <QavanteStatTile
          label="Pagas en"
          value={dias(dpo)}
          tone="default"
          hint="Días que te tardas en pagar a proveedores (DPO)."
        />
        <QavanteStatTile
          label="Plata atrapada"
          value={dias(ccc)}
          tone={ccc == null ? "default" : ccc > 0 ? "danger" : "success"}
          hint="Días que financias con tu propia caja (cobras − pagas)."
        />
      </div>

      {/* Saldos vivos */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QavanteStatTile
          label="Por cobrar (vivo)"
          value={formatClp(ar)}
          tone="default"
          hint="Facturas emitidas que aún no te pagan."
        />
        <QavanteStatTile
          label="Por pagar (vivo)"
          value={formatClp(ap)}
          tone="default"
          hint="Facturas recibidas que aún no pagas."
        />
      </div>

      <PalancaCiclo dso={dso} venta={ventaDiaria(c)} ar={ar} />

      <VentanaPie c={c} />
    </div>
  );
}

/** El veredicto: qué significan los días de ciclo para el dueño. */
function VeredictoCiclo({
  ccc,
  dso,
  venta,
}: {
  ccc: number | null;
  dso: number | null;
  venta: number;
}) {
  // Caso parcial (típico en empresas de servicios como Tooxs): sabemos cuánto tarda el cobro (DSO),
  // pero sin costo de ventas (COGS) el backend no puede estimar los días de pago → no hay ciclo
  // completo. Es honesto y esperable, no un error → mensaje informativo, no de alarma.
  if (ccc == null && dso != null) {
    return (
      <section className="rounded-xl border border-brand-primary/25 bg-brand-primary/[.05] p-5 text-[13px]">
        <p className="font-bold text-neutral-dark">
          Cobras en {Math.round(dso)} días — pero tu ciclo completo aún no se puede calcular
        </p>
        <p className="mt-1 text-neutral-mid">
          Para el ciclo completo necesitamos tu <b>costo de ventas</b> (lo que cuesta lo que
          vendes), y este período no tiene. Es lo normal en empresas de servicios: el cobro sí se
          mide, el ciclo de pago no.
        </p>
      </section>
    );
  }
  if (ccc == null) {
    return (
      <section className="rounded-xl border border-warning-500/40 bg-warning-500/[.06] p-5 text-[13px]">
        <p className="font-bold text-warning-700">Aún no podemos calcular tu ciclo</p>
        <p className="mt-1 text-neutral-dark">
          Necesitamos una ventana con ventas netas suficientes. Si tus ventas del período están
          dominadas por notas de crédito, el ratio no tiene sentido y preferimos no inventarlo.
        </p>
      </section>
    );
  }
  const atrapado = ccc > 0;
  const monto = venta > 0 ? formatClp(Math.round(venta * Math.abs(ccc))) : null;
  return (
    <section
      className={`rounded-xl border p-5 ${
        atrapado
          ? "border-warning-500/40 bg-warning-500/[.06]"
          : "border-success-700/30 bg-success-700/[.06]"
      }`}
    >
      <div className="flex items-start gap-3">
        <Clock
          className={`mt-0.5 h-5 w-5 shrink-0 ${atrapado ? "text-warning-700" : "text-success-700"}`}
          aria-hidden="true"
        />
        <div>
          <p className="text-base font-bold text-neutral-dark">
            {atrapado
              ? `Tu plata queda atrapada ${ccc} días entre que vendes y cobras`
              : `Tus proveedores financian tu operación (${Math.abs(ccc)} días a favor)`}
          </p>
          <p className="mt-1 text-sm text-neutral-mid">
            {atrapado
              ? "Cobras más lento de lo que pagas: ese desfase lo financias con tu propia caja."
              : "Pagas más lento de lo que cobras: la operación se financia sola."}
            {monto && atrapado ? ` Hoy son del orden de ${monto} inmovilizados.` : ""}
          </p>
        </div>
      </div>
    </section>
  );
}

/** La palanca accionable: acelerar el cobro libera caja sin vender más. */
function PalancaCiclo({ dso, venta, ar }: { dso: number | null; venta: number; ar: number }) {
  if (dso == null || dso <= 0 || venta <= 0 || ar <= 0) return null;
  const porDia = Math.round(venta);
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-neutral-dark">
        <Wallet className="h-4 w-4 text-brand-primary" aria-hidden="true" />
        La palanca
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-neutral-mid">
        Cada día que aceleras el cobro liberas del orden de
        <span className="font-semibold tabular-nums text-neutral-dark">{formatClp(porDia)}</span>
        <ArrowRight className="h-3.5 w-3.5 text-neutral-light" aria-hidden="true" />
        bajar el cobro de {dso} a {Math.max(1, dso - 10)} días liberaría
        <span className="font-semibold tabular-nums text-success-700">
          {formatClp(porDia * Math.min(10, dso - 1))}
        </span>
        de caja.
      </p>
      <p className="mt-1 text-[11px] text-neutral-light">
        Estimado sobre tu venta diaria promedio; acelerar el cobro no cambia el resultado, cambia
        cuándo tienes la plata.
      </p>
    </section>
  );
}

function VentanaPie({ c }: { c: CashCycleResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3 text-xs text-neutral-mid">
      <span className="font-medium text-neutral-dark">Ventana del cálculo:</span>
      <QavanteBadge variant="default">
        {c.window_months} {c.window_months === 1 ? "mes" : "meses"} cerrados
      </QavanteBadge>
      <span>
        {c.window_from} → {c.window_to} · calculado {c.as_of}
      </span>
    </div>
  );
}
