"use client";

import { cn } from "@/lib/utils";
import { shiftPeriod } from "@/components/gestion/gestion-format";

/* Filtro de mes SIMPLE para el detalle de movimientos de Banco (pedido de Fernando: Mes actual / Mes
   anterior / Otro mes — SIN los presets anuales/multi-mes del PeriodRangeFilter). `mesActual` lo calcula
   el server (Santiago) y baja como prop para no computar `new Date()` en el render (evita mismatch de
   hidratación). Devuelve un período "YYYY-MM". Presentacional. */

export interface MesFilterProps {
  /** Mes actual "YYYY-MM" (calculado server-side, Santiago). */
  mesActual: string;
  /** Mes seleccionado "YYYY-MM". */
  value: string;
  onChange: (period: string) => void;
}

export function MesFilter({ mesActual, value, onChange }: MesFilterProps) {
  const mesAnterior = shiftPeriod(mesActual, -1);
  const esOtro = value !== mesActual && value !== mesAnterior;
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por mes">
      <Chip active={value === mesActual} onClick={() => onChange(mesActual)}>
        Mes actual
      </Chip>
      <Chip active={value === mesAnterior} onClick={() => onChange(mesAnterior)}>
        Mes anterior
      </Chip>
      <label
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors",
          esOtro
            ? "border-brand-primary bg-brand-primary-50 text-brand-primary-700"
            : "border-border text-neutral-mid",
        )}
      >
        <span className="text-neutral-mid">Otro mes:</span>
        <input
          type="month"
          value={value}
          max={mesActual}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Elegir otro mes"
          className="cursor-pointer bg-transparent text-neutral-dark outline-none"
        />
      </label>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        active
          ? "border-brand-primary bg-brand-primary-50 font-medium text-brand-primary-700"
          : "border-border text-neutral-mid hover:bg-neutral-light/30",
      )}
    >
      {children}
    </button>
  );
}
