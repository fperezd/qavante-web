"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
import { useCollectionProjection } from "@/lib/api/treasury";
import { comportamientoPagoInsight, type ComportamientoTono } from "./comportamiento-pago-model";

/* Insight "comportamiento de pago" en Ciclo de caja (gated `comportamientoPago`, OFF). Complementa el
   DSO (ratio contable) con el desfase REAL vs vencimiento que trae `collection-projection`
   (`behavior_shift_days`, agregado de cobros). Degrada solo: sin dato / sin comparables → no renderiza
   nada (no inventa). El detalle POR CONTRAPARTE es brecha de CC-API (qavante-api #858). */

const TONO_CLASS: Record<ComportamientoTono, { box: string; icon: string }> = {
  danger: { box: "border-danger-500/40 bg-danger-500/[.06]", icon: "text-danger-500" },
  warning: { box: "border-warning-500/40 bg-warning-500/[.06]", icon: "text-warning-700" },
  success: { box: "border-success-700/30 bg-success-700/[.06]", icon: "text-success-700" },
  neutral: { box: "border-brand-primary/25 bg-brand-primary/[.05]", icon: "text-brand-primary" },
};

export function ComportamientoPagoCard({ enabled = true }: { enabled?: boolean }) {
  const proj = useCollectionProjection(enabled);
  const insight = React.useMemo(() => comportamientoPagoInsight(proj.data), [proj.data]);

  // Silencioso: si el flag está OFF, falla, o no hay comparables → no mostramos nada (no inventamos).
  if (!enabled || !insight) return null;

  const tono = TONO_CLASS[insight.tono];

  return (
    <section className={`rounded-xl border p-5 ${tono.box}`}>
      <div className="flex items-start gap-3">
        <CalendarClock className={`mt-0.5 h-5 w-5 shrink-0 ${tono.icon}`} aria-hidden="true" />
        <div>
          <p className="text-base font-bold text-neutral-dark">{insight.titulo}</p>
          <p className="mt-1 text-sm text-neutral-mid">
            Es el <b>comportamiento real</b> de cobro (cuándo pagan de verdad), no el plazo pactado.
            {insight.total > 0 && (
              <>
                {" "}
                Basado en {insight.conHistorial} de {insight.total} facturas con historial de pago.
              </>
            )}
          </p>
          <p className="mt-1 text-[11px] text-neutral-light">
            Promedio del total de tus cobros. El detalle por cliente está en camino.
          </p>
        </div>
      </div>
    </section>
  );
}
