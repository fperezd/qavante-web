"use client";

import * as React from "react";
import { CalendarRange, ChevronDown } from "lucide-react";
import { QavanteButton } from "@/components/qavante";
import { cn } from "@/lib/utils";
import { formatPeriodMMYYYY, isValidPeriodRange } from "@/components/caja/cash-flow-format";

/* Selector de período de las maquetas.
 *
 * Es propio a propósito. La versión original de estas maquetas reutilizaba el panel de
 * filtros del reporte de caja y, para hacerlo, le agregaba al tipo de parámetros del
 * contrato un campo que el backend no recibe (`quick_range_days`, una ventana en días que
 * sólo existía para recortar en el navegador). Una propuesta de diseño no puede
 * deformar el tipo de una llamada real: si mañana la propuesta se descarta, el campo
 * inventado queda. Acá la ventana vive en un tipo de la maqueta y en ningún otro lado. */

export type MaquetaVentanaDias = 7 | 14 | 30 | 90;

export interface MaquetaPeriodo {
  /** Mes inicial, YYYY-MM. */
  period_from: string;
  /** Mes final, YYYY-MM. */
  period_to: string;
  /** Ventana exacta en días cuando el período viene de un atajo. */
  dias?: MaquetaVentanaDias;
}

const ATAJOS: Array<{ dias: MaquetaVentanaDias; label: string }> = [
  { dias: 7, label: "Últimos 7 días" },
  { dias: 14, label: "Últimas 2 semanas" },
  { dias: 30, label: "Último mes" },
  { dias: 90, label: "Últimos 3 meses" },
];

export const ETIQUETA_VENTANA: Record<MaquetaVentanaDias, string> = {
  7: "Últimos 7 días",
  14: "Últimas 2 semanas",
  30: "Último mes",
  90: "Últimos 3 meses",
};

function mesDe(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Período que corresponde a una ventana de `dias` terminada hoy. */
export function periodoDeVentana(dias: MaquetaVentanaDias, hoy: Date = new Date()): MaquetaPeriodo {
  const inicio = new Date(hoy);
  inicio.setDate(inicio.getDate() - (dias - 1));
  return { period_from: mesDe(inicio), period_to: mesDe(hoy), dias };
}

export function etiquetaPeriodo(periodo: MaquetaPeriodo): string {
  return periodo.dias
    ? ETIQUETA_VENTANA[periodo.dias]
    : `${formatPeriodMMYYYY(periodo.period_from)} a ${formatPeriodMMYYYY(periodo.period_to)}`;
}

export function MaquetaPeriodoSelector({
  value,
  onChange,
}: {
  value: MaquetaPeriodo;
  onChange: (next: MaquetaPeriodo) => void;
}) {
  const [abierto, setAbierto] = React.useState(false);
  const [borrador, setBorrador] = React.useState<MaquetaPeriodo>(value);
  const mesActual = mesDe(new Date());

  React.useEffect(() => {
    setBorrador(value);
  }, [value]);

  const rangoValido = isValidPeriodRange(borrador.period_from, borrador.period_to);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAbierto((open) => !open)}
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-neutral-dark hover:border-brand-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <CalendarRange className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
        {etiquetaPeriodo(value)}
        <ChevronDown className="h-4 w-4 text-neutral-mid" aria-hidden="true" />
      </button>
      {abierto && (
        <div
          role="dialog"
          aria-label="Elegir período"
          className="absolute left-0 z-30 mt-2 w-[320px] rounded-xl border border-border bg-surface p-3 shadow-xl"
        >
          <div className="grid grid-cols-2 gap-2">
            {ATAJOS.map((atajo) => (
              <button
                key={atajo.dias}
                type="button"
                onClick={() => {
                  onChange(periodoDeVentana(atajo.dias));
                  setAbierto(false);
                }}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  value.dias === atajo.dias
                    ? "border-brand-primary bg-brand-primary text-surface"
                    : "border-border text-neutral-dark hover:bg-surface-muted",
                )}
              >
                {atajo.label}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Mes inicial
              <input
                type="month"
                value={borrador.period_from}
                max={mesActual}
                onChange={(event) =>
                  setBorrador((actual) => ({
                    period_from: event.target.value,
                    period_to: actual.period_to,
                  }))
                }
                className="block h-9 w-full rounded-md border border-border bg-surface px-2 text-sm font-normal normal-case text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
            </label>
            <label className="space-y-1 text-xs font-semibold uppercase tracking-wider text-neutral-mid">
              Mes final
              <input
                type="month"
                value={borrador.period_to}
                max={mesActual}
                onChange={(event) =>
                  setBorrador((actual) => ({
                    period_from: actual.period_from,
                    period_to: event.target.value,
                  }))
                }
                className="block h-9 w-full rounded-md border border-border bg-surface px-2 text-sm font-normal normal-case text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
              />
            </label>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <QavanteButton size="sm" variant="ghost" onClick={() => setAbierto(false)}>
              Cancelar
            </QavanteButton>
            <QavanteButton
              size="sm"
              onClick={() => {
                if (rangoValido) onChange(borrador);
                setAbierto(false);
              }}
              disabled={!rangoValido}
            >
              Aplicar
            </QavanteButton>
          </div>
          {!rangoValido && (
            <p className="mt-2 text-xs text-warning-700">
              El mes inicial tiene que ser anterior o igual al mes final.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
