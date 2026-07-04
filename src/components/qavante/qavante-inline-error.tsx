"use client";

import * as React from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { cn } from "@/lib/utils";

/* Alerta inline para estados de error de queries (Anexo C.3 mapeo de copys).
   Reemplaza la función ErrorState duplicada idénticamente en 4 views
   (monedas, reglas, plantillas, por-clasificar). Mapea ApiError →
   apiErrorToUserMessage cuando aplica, y cae al copy "No pudimos cargar
   {what}" en otros errores no clasificados.

   Patrón consistente del repo: borde + fondo danger suave + icono
   AlertCircle + role="alert" para a11y (los lectores anuncian el cambio
   automáticamente). */

export interface QavanteInlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Error sin tipar (puede venir de TanStack Query, fetch, etc.). Si es
   *  `ApiError`, mapeamos a copy del Anexo C.3; cualquier otra cosa cae al
   *  fallback genérico con `what`. */
  error: unknown;
  /** Qué se intentaba cargar — completa la frase "No pudimos cargar {what}".
   *  Ej: "las reglas", "los ajustes de moneda", "las plantillas". */
  what: string;
  /** Si se pasa, muestra un botón "Reintentar" (ej. `() => query.refetch()`).
   *  Sin esto, el error es un callejón: el usuario debe recargar la página. */
  onRetry?: () => void;
}

export function QavanteInlineError({
  error,
  what,
  onRetry,
  className,
  ...rest
}: QavanteInlineErrorProps) {
  const message =
    error instanceof ApiError ? apiErrorToUserMessage(error) : `No pudimos cargar ${what}.`;
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-xl border border-danger-500/30 bg-danger-500/5 p-4 text-sm text-neutral-dark",
        className,
      )}
      {...rest}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger-500" aria-hidden="true" />
      <div className="flex flex-1 flex-wrap items-center justify-between gap-2">
        <p>{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-danger-500/30 px-2.5 py-1 text-xs font-semibold text-danger-700 transition-colors hover:bg-danger-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
