"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
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
}

export function QavanteInlineError({ error, what, className, ...rest }: QavanteInlineErrorProps) {
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
      <p>{message}</p>
    </div>
  );
}
