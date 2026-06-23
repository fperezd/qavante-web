"use client";

import * as React from "react";
import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";
import { InlineError } from "./inline-error";

/* QavanteInlineError — wrapper de APP sobre el primitivo agnóstico InlineError.
   Mapea el `ApiError` del backend a copy de usuario (Anexo C.3) y delega la
   presentación. Esta es la pieza acoplada a la API de Qavante: se queda en el
   repo, NO se extrae (el primitivo agnóstico InlineError sí — ver
   capa1-extraction-map §B). Mantiene la ergonomía `{ error, what }` que ya
   usan ~13 vistas, así que el desacople es transparente para ellas. */

export interface QavanteInlineErrorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Error sin tipar (TanStack Query, fetch, etc.). Si es `ApiError`, se mapea
   *  a copy del Anexo C.3; cualquier otra cosa cae al fallback con `what`. */
  error: unknown;
  /** Qué se intentaba cargar — completa "No pudimos cargar {what}". */
  what: string;
}

export function QavanteInlineError({ error, what, ...rest }: QavanteInlineErrorProps) {
  const message =
    error instanceof ApiError ? apiErrorToUserMessage(error) : `No pudimos cargar ${what}.`;
  return <InlineError message={message} {...rest} />;
}
