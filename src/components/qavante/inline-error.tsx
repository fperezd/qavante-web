"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/* InlineError — primitivo AGNÓSTICO de alerta inline (Capa 1, extraíble a
   @tooxs/ui). Recibe el mensaje ya resuelto: NO conoce ninguna API ni mapea
   errores de un backend específico (ver capa1-extraction-map §B). El mapeo
   ApiError → texto vive en el wrapper de app `QavanteInlineError`.

   Patrón a11y: borde + fondo danger suave + AlertCircle + role="alert" (los
   lectores anuncian el cambio automáticamente). */

export interface InlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Texto ya apto para el usuario. */
  message: string;
}

export function InlineError({ message, className, ...rest }: InlineErrorProps) {
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
