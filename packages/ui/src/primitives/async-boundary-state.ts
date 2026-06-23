/* Lógica pura de AsyncBoundary — resuelve el resultado de una query a un estado
   discriminado, en orden de precedencia. Testeable sin render. */

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
