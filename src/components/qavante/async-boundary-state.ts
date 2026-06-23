/* Lógica pura de AsyncBoundary (Tooxs Frontend Standard §3.3), separada del
   componente para testearla sin render — patrón del repo: lógica en `.ts` con
   su `.test.ts` al lado. Resuelve el resultado de una query a un estado
   discriminado, en orden de precedencia. */

export type AsyncState = "loading" | "error" | "nodata" | "empty" | "ready";

export interface AsyncQueryLike<T> {
  isLoading: boolean;
  isError: boolean;
  data: T | undefined;
}

export function resolveAsyncState<T>(
  query: AsyncQueryLike<T>,
  isEmpty?: (data: T) => boolean,
): AsyncState {
  if (query.isLoading) return "loading";
  if (query.isError) return "error";
  if (query.data === undefined) return "nodata";
  if (isEmpty?.(query.data)) return "empty";
  return "ready";
}
