"use client";

import { Sparkles } from "lucide-react";

export function AssistantTrigger() {
  return (
    /* FAB circular por defecto (cubre solo una esquina chica), se expande al label en hover/focus.
       Antes era un pill ancho `fixed` que tapaba datos en el bottom-right del viewport en toda pantalla
       (auditoría UX F-04). Ícono siempre visible + label accesible por aria-label/title. */
    <button
      type="button"
      className="bg-gradient-brand group fixed bottom-6 right-6 z-30 flex h-14 items-center rounded-full px-[18px] text-sm font-semibold text-surface shadow-brand transition-[box-shadow] hover:shadow-lg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
      aria-label="Preguntar a Qavante (CMD+J)"
      title="Preguntar a Qavante (⌘J)"
    >
      <Sparkles className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="ml-0 max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover:ml-2 group-hover:max-w-[200px] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[200px] group-focus-visible:opacity-100">
        Preguntar a Qavante
        <kbd className="ml-1.5 rounded border border-surface/30 bg-brand-primary-700/50 px-1.5 py-0.5 font-mono text-[10px]">
          ⌘J
        </kbd>
      </span>
    </button>
  );
}
