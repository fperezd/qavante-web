"use client";

import * as React from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SignupField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-neutral-dark">
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs text-danger-500" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** Spinner (o check) al borde del input de razón social; el texto guía va en tooltip al hover/foco. */
export function SiiRazonSocialInputAssist({
  fetching,
  filled,
  notFound,
  error,
  tooltipText,
  children,
}: {
  fetching: boolean;
  filled: boolean;
  notFound: boolean;
  error: boolean;
  tooltipText: string;
  children: React.ReactNode;
}) {
  const showTrailing = fetching || filled;

  return (
    <div className="space-y-1">
      <div className="relative">
        {children}
        {showTrailing && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            {fetching ? (
              <Tooltip.Provider delay={120}>
                <Tooltip.Root>
                  <Tooltip.Trigger
                    type="button"
                    aria-label="Consultando el SII"
                    className="pointer-events-auto inline-flex items-center justify-center rounded-full text-neutral-mid transition-colors hover:text-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner side="top" sideOffset={7}>
                      <Tooltip.Popup className="max-w-[248px] rounded-lg bg-neutral-dark px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-surface shadow-xl">
                        <Tooltip.Arrow className="text-neutral-dark data-[side=bottom]:top-[-6px] data-[side=top]:bottom-[-6px]">
                          <svg width="12" height="6" viewBox="0 0 12 6" aria-hidden="true">
                            <path d="M6 6 0 0h12z" fill="currentColor" />
                          </svg>
                        </Tooltip.Arrow>
                        {tooltipText}
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </Tooltip.Provider>
            ) : (
              <CheckCircle2
                className="h-4 w-4 text-success-700"
                aria-label="Datos traídos del SII"
              />
            )}
          </div>
        )}
      </div>
      {error ? (
        <p className="text-xs text-warning-700">
          No pudimos consultar el SII. Ingresa el dato a mano.
        </p>
      ) : notFound ? (
        <p className="text-xs text-neutral-mid">
          No encontramos datos en el SII. Ingrésalo a mano.
        </p>
      ) : null}
    </div>
  );
}

export function siiRazonSocialInputPadding(showTrailing: boolean) {
  return cn(showTrailing && "pr-10");
}

export function SiiHint({
  fetching,
  filled,
  notFound,
  error,
  emptyLabel,
}: {
  fetching: boolean;
  filled: boolean;
  notFound: boolean;
  error: boolean;
  emptyLabel: string;
}) {
  return (
    <p className="min-h-4 text-xs">
      {fetching ? (
        <span className="inline-flex items-center gap-1 text-neutral-mid">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          Buscando en el SII…
        </span>
      ) : filled ? (
        <span className="inline-flex items-center gap-1 text-success-700">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          Datos traídos del SII
        </span>
      ) : error ? (
        <span className="text-warning-700">
          No pudimos consultar el SII. Ingresa el dato a mano.
        </span>
      ) : notFound ? (
        <span className="text-neutral-mid">No encontramos datos en el SII. Ingrésalo a mano.</span>
      ) : (
        <span className="text-neutral-mid">{emptyLabel}</span>
      )}
    </p>
  );
}

export function SignupErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-3 text-sm text-danger-500"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p>{message}</p>
    </div>
  );
}
