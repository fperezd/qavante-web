import * as React from "react";
import { InlineError } from "./inline-error";
import { resolveAsyncState, type AsyncQueryLike } from "./async-boundary-state";

/* AsyncBoundary (Tooxs Frontend Standard §3.3) — el primitivo que elimina el
   boilerplate de loading/error/empty copiado en cada vista. Compone Skeleton +
   InlineError + Empty alrededor del resultado de una query de TanStack.
   AGNÓSTICO: no conoce ninguna API; el mapeo error → texto se inyecta vía
   `resolveError` (la app pasa el suyo). Por defecto, copy genérico. */

const defaultResolveError = (_error: unknown, what: string) => `No pudimos cargar ${what}.`;

export interface AsyncBoundaryProps<T> {
  query: AsyncQueryLike<T> & { error?: unknown };
  /** Completa "No pudimos cargar {what}" del estado de error. */
  what: string;
  /** Esqueleto que anticipa el contenido (no un spinner). */
  skeleton: React.ReactNode;
  /** Estado vacío de marca (con CTA). Pasá siempre `empty` cuando uses `isEmpty`. */
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  /** Mapea el error a texto de usuario. La app inyecta su mapeo (ej.
   *  apiErrorToUserMessage); el primitivo no conoce ninguna API. */
  resolveError?: (error: unknown, what: string) => string;
  children: (data: T) => React.ReactNode;
}

export function AsyncBoundary<T>({
  query,
  what,
  skeleton,
  empty,
  isEmpty,
  resolveError = defaultResolveError,
  children,
}: AsyncBoundaryProps<T>) {
  switch (resolveAsyncState(query, isEmpty)) {
    case "loading":
      return <div aria-busy="true">{skeleton}</div>;
    case "error":
      return <InlineError message={resolveError(query.error, what)} />;
    case "nodata":
      return null;
    case "empty":
      return <>{empty ?? null}</>;
    case "ready":
      return <>{children(query.data as T)}</>;
  }
}
