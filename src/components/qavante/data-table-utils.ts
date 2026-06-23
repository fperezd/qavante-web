/* Lógica pura del DataTable (Capa 1) — reordenamiento de columnas, testeable
   sin render ni DnD. */

/** Mueve el elemento en `fromIndex` a `toIndex`. Inmutable. */
export function reorder<T>(list: readonly T[], fromIndex: number, toIndex: number): T[] {
  const next = list.slice();
  if (fromIndex < 0 || fromIndex >= next.length) return next;
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) return next;
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  return next;
}

/** Reordena un array de ids de columna moviendo `activeId` a la posición de
   `overId`. Si alguno no existe, devuelve el orden original. */
export function moveColumn(order: readonly string[], activeId: string, overId: string): string[] {
  const from = order.indexOf(activeId);
  const to = order.indexOf(overId);
  if (from === -1 || to === -1 || from === to) return order.slice();
  return reorder(order, from, to);
}
