"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Tooltip } from "@base-ui/react/tooltip";

/* InfoHint — un ícono ⓘ que explica una métrica al pasar el mouse Y al enfocar
 * con teclado (Base UI Tooltip: aria + foco + Escape de fábrica). A diferencia
 * del tooltip solo-hover de la banca, este es operable por teclado y lo anuncia
 * un lector de pantalla. Reusable en cualquier cifra de la app. */

export interface InfoHintProps {
  /** Texto explicativo (en lenguaje de dueño). */
  children: React.ReactNode;
  /** Etiqueta accesible del disparador. */
  label?: string;
}

export function InfoHint({ children, label = "Qué significa esta cifra" }: InfoHintProps) {
  return (
    <Tooltip.Provider delay={120}>
      <Tooltip.Root>
        <Tooltip.Trigger
          aria-label={label}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full align-middle text-neutral-mid/70 transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner side="top" sideOffset={7}>
            <Tooltip.Popup className="max-w-[248px] rounded-lg bg-neutral-dark px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-surface shadow-xl">
              <Tooltip.Arrow className="text-neutral-dark data-[side=bottom]:top-[-6px] data-[side=top]:bottom-[-6px]">
                <svg width="12" height="6" viewBox="0 0 12 6" aria-hidden="true">
                  <path d="M6 6 0 0h12z" fill="currentColor" />
                </svg>
              </Tooltip.Arrow>
              {children}
            </Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
