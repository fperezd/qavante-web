"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { rovingIndex } from "@/lib/a11y/roving";

/* Chips de filtro — ESPECIFICACION.md §1.3 "Chips de filtro" (`.fchips`).
 * SIEMPRE con conteo ("Vencidos · 99"). Activo = fondo tinta.
 *
 * Grupo de selección única → patrón WAI-ARIA radiogroup, igual que
 * `src/components/filters/direction-segment.tsx` (mismo repo, mismo problema):
 * las flechas mueven la selección con wrap y roving tabindex, no botones
 * independientes con `aria-pressed` cada uno (eso no comunica "es un grupo,
 * elegís uno" a un lector de pantalla ni da navegación por teclado). */

export interface FilterChipOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export interface FilterChipsProps<T extends string> {
  options: ReadonlyArray<FilterChipOption<T>>;
  value: T;
  onChange: (value: T) => void;
  "aria-label"?: string;
  className?: string;
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  "aria-label": ariaLabel = "Filtrar",
  className,
}: FilterChipsProps<T>) {
  const btnRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(e: React.KeyboardEvent, idx: number) {
    const next = rovingIndex(idx, e.key, options.length);
    if (next === null) return;
    e.preventDefault();
    const opt = options[next];
    if (!opt) return;
    onChange(opt.id);
    btnRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("mt-3.5 mb-3 flex flex-wrap items-center gap-1.5", className)}
    >
      {options.map((opt, idx) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              btnRefs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              "rounded-full border border-rediseno-hairline bg-rediseno-superficie px-[13px] py-[7px] text-xs font-semibold text-rediseno-tinta-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rediseno-azul",
              active && "border-rediseno-tinta bg-rediseno-tinta text-white",
            )}
          >
            {opt.label}
            {opt.count !== undefined && <> · {opt.count}</>}
          </button>
        );
      })}
    </div>
  );
}
