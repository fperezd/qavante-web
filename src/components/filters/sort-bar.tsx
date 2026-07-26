import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/hooks/use-table-sort";

/* Barra "Ordenar por" para listas de tarjetas (Cobrar/Pagar), donde no hay una
   grilla con cabeceras de columna. Chips: el primero suele ser el orden CURADO
   (ej. "Prioridad") y arranca activo; el resto ordena por ese criterio (un
   segundo clic invierte). Complementa a `SortHeader` (que es para tablas). */

export interface SortBarOption {
  key: string;
  label: string;
}

export interface SortBarProps {
  options: SortBarOption[];
  /** Clave activa (la del orden curado cuando no se ordenó por otra cosa). */
  activeKey: string;
  dir: SortDir;
  onSelect: (key: string) => void;
  /** Texto guía. Default "Ordenar por". */
  label?: string;
  className?: string;
}

export function SortBar({
  options,
  activeKey,
  dir,
  onSelect,
  label = "Ordenar por",
  className,
}: SortBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs", className)}>
      <span className="text-neutral-mid">{label}:</span>
      {options.map((o, i) => {
        const active = o.key === activeKey;
        // El primer chip es el orden curado → sin flecha (no es asc/desc, es "recomendado").
        const showArrow = active && i > 0;
        const Arrow = dir === "asc" ? ArrowUp : ArrowDown;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            aria-pressed={active}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1",
              active
                ? "border-brand-primary/40 bg-brand-primary-50 text-brand-primary"
                : "border-border bg-surface text-neutral-mid hover:border-brand-primary/40 hover:text-neutral-dark",
            )}
          >
            {o.label}
            {showArrow && <Arrow className="size-3" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
