import * as React from "react";
import { InlineError } from "./inline-error";
import { resolveAsyncState, type AsyncQueryLike } from "./async-boundary-state";

const defaultResolveError = (_error: unknown, what: string) => `No pudimos cargar ${what}.`;

/* AsyncBoundary — compone Skeleton + InlineError + Empty alrededor del resultado
   de una query (TanStack u otra con forma { isLoading, isError, data, error }).
   AGNÓSTICO: el mapeo error→texto se inyecta vía `resolveError`. */
export interface AsyncBoundaryProps<T> {
  query: AsyncQueryLike<T> & { error?: unknown };
  what: string;
  skeleton: React.ReactNode;
  empty?: React.ReactNode;
  isEmpty?: (data: T) => boolean;
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
