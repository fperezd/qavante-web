import * as React from "react";
import { QavanteInlineError } from "./qavante-inline-error";
import { resolveAsyncState, type AsyncQueryLike } from "./async-boundary-state";

/* AsyncBoundary (Tooxs Frontend Standard §3.3) — el primitivo que elimina el
   boilerplate de loading/error/empty copiado en cada vista. Compone Skeleton +
   QavanteInlineError + Empty alrededor del resultado de una query de TanStack.
   Acepta cualquier objeto con la forma `{ isLoading, isError, data, error }`. */

export interface AsyncBoundaryProps<T> {
  query: AsyncQueryLike<T> & { error?: unknown };
  /** Completa "No pudimos cargar {what}" del estado de error. */
  what: string;
  /** Esqueleto que anticipa el contenido (no un spinner). */
  skeleton: React.ReactNode;
  /** Estado vacío de marca (con CTA). Si se omite y `isEmpty` da true, no
   *  renderea nada — pasá siempre `empty` cuando uses `isEmpty`. */
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
  children: (data: T) => React.ReactNode;
}

export function AsyncBoundary<T>({
  query,
  what,
  skeleton,
  empty,
  isEmpty,
  children,
}: AsyncBoundaryProps<T>) {
  switch (resolveAsyncState(query, isEmpty)) {
    case "loading":
      return <div aria-busy="true">{skeleton}</div>;
    case "error":
      return <QavanteInlineError error={query.error} what={what} />;
    case "nodata":
      return null;
    case "empty":
      return <>{empty ?? null}</>;
    case "ready":
      return <>{children(query.data as T)}</>;
  }
}
