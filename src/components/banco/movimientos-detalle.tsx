"use client";

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { QavanteCard, QavanteInlineError } from "@/components/qavante";
import { formatMoney } from "@/lib/formatters/clp";
import { formatDateLike } from "@/lib/formatters/date";
import { formatPeriodLabel } from "@/components/gestion/gestion-format";
import { cn } from "@/lib/utils";
import { MesFilter } from "./mes-filter";
import type { MovimientoBanco } from "./banco-movimientos-model";

/* Detalle de movimientos de un producto de Banco (cuenta o tarjeta). Presentacional PURO: recibe los
   movimientos ya filtrados + el filtro de mes. Cabecera con "volver a Banco", el filtro Mes actual /
   anterior / otro, y el estado "Actualizado a las HH:MM / Actualizando ⟳" (mismo patrón que la landing). */

export interface MovimientosDetalleProps {
  titulo: string;
  subtitulo?: string;
  mesActual: string;
  period: string;
  onPeriodChange: (p: string) => void;
  movimientos: MovimientoBanco[];
  loading?: boolean;
  actualizando?: boolean;
  error?: unknown;
  /** Hora del último dato ("15:32"), o null. */
  horaTexto?: string | null;
}

export function MovimientosDetalle({
  titulo,
  subtitulo,
  mesActual,
  period,
  onPeriodChange,
  movimientos,
  loading,
  actualizando,
  error,
  horaTexto,
}: MovimientosDetalleProps) {
  return (
    <div className="space-y-4">
      <Link
        href="/banco"
        className="inline-flex items-center gap-1 text-sm text-neutral-mid transition-colors hover:text-neutral-dark"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Volver a Banco
      </Link>
      <header>
        <h1 className="text-2xl font-bold text-neutral-dark">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-neutral-mid">{subtitulo}</p>}
      </header>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <MesFilter mesActual={mesActual} value={period} onChange={onPeriodChange} />
        {actualizando ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-info-700">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Actualizando…
          </span>
        ) : horaTexto ? (
          <span className="text-xs text-neutral-mid">Actualizado a las {horaTexto}</span>
        ) : null}
      </div>

      {error ? (
        <QavanteInlineError error={error} what="los movimientos" />
      ) : loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-neutral-light/30" aria-busy="true" />
      ) : movimientos.length === 0 ? (
        <QavanteCard variant="bordered">
          <p className="py-6 text-center text-sm text-neutral-mid">
            Sin movimientos en {formatPeriodLabel(period)}.
          </p>
        </QavanteCard>
      ) : (
        <QavanteCard variant="bordered">
          <ul className="divide-y divide-border">
            {movimientos.map((m, i) => (
              <li
                key={`${m.fecha}-${i}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-neutral-dark">{m.glosa}</p>
                  <p className="text-xs text-neutral-mid">
                    {formatDateLike(m.fecha)}
                    {m.cuotas && <> · cuota {m.cuotas}</>}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 whitespace-nowrap font-medium tabular-nums",
                    m.monto < 0 ? "text-danger-500" : "text-success-600",
                  )}
                >
                  {m.monto < 0 ? "−" : "+"}
                  {formatMoney(Math.abs(m.monto), m.moneda)}
                </span>
              </li>
            ))}
          </ul>
        </QavanteCard>
      )}
    </div>
  );
}
