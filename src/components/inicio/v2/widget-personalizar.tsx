"use client";

import * as React from "react";
import { SlidersHorizontal, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { isVisible } from "./widget-visibility";

/* Panel "Personalizar" del Inicio (gated `inicioWidgets`): el dueño prende/apaga las tarjetas y así
   arma SU pantalla. El catálogo "agregar" es el mismo mecanismo — las apagadas quedan listadas para
   volver a prenderlas. Mover ya lo resuelve `DraggableCard` (drag + flechas). Presentacional: recibe
   los widgets presentes + los apagados + el callback; la persistencia la hace el contenedor. */

export interface WidgetPersonalizarProps {
  /** Todos los widgets con dato este render (visibles y apagados). Es el catálogo. */
  widgets: { id: string; label: string }[];
  /** Ids apagados por el usuario. */
  hidden: string[];
  /** Prende/apaga un widget. */
  onToggle: (id: string) => void;
}

export function WidgetPersonalizar({ widgets, hidden, onToggle }: WidgetPersonalizarProps) {
  const [open, setOpen] = React.useState(false);
  const visibles = widgets.filter((w) => isVisible(hidden, w.id)).length;

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-neutral-mid transition-colors hover:text-neutral-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Personalizar
      </button>

      {open && (
        <div
          role="group"
          aria-label="Prender o apagar tarjetas"
          className="mt-2 w-full max-w-xs rounded-xl border border-border bg-surface p-2 shadow-lg"
        >
          <p className="px-2 py-1.5 text-xs text-neutral-mid">
            Elige qué ver. {visibles} de {widgets.length} encendidas.
          </p>
          <ul className="space-y-0.5">
            {widgets.map((w) => {
              const on = isVisible(hidden, w.id);
              return (
                <li key={w.id}>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={() => onToggle(w.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-neutral-light/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <span className={cn(on ? "text-neutral-dark" : "text-neutral-mid")}>
                      {w.label}
                    </span>
                    <span
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        on ? "bg-brand-primary" : "bg-neutral-light",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all",
                          on ? "left-[18px]" : "left-0.5",
                        )}
                      >
                        {on && (
                          <Check
                            className="h-4 w-4 p-0.5 text-brand-primary"
                            strokeWidth={3}
                            aria-hidden="true"
                          />
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
