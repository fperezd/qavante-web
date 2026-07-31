/* Lógica PURA del orden de los widgets del Inicio v2 (sin React → testeable).
   El gerente reordena las tarjetas de detalle (Caja · Cobranza · Pagos · Resultado)
   y el orden se persiste en las prefs de UI del usuario en la empresa activa
   (`GET/PUT /api/me/preferences`, #571). Contrato del blob: "reemplaza, NO hace
   merge" → el caller manda el blob completo (ver `withWidgetOrder`). */

import type { PreferencesBlob } from "@/lib/api/preferences";

/** Clave estable del orden dentro del blob de prefs (Inicio v2). Otras pantallas con tarjetas
 *  reordenables (ej. Márgenes) pasan su propia clave a `readWidgetOrder`/`withWidgetOrder` para no
 *  pisarse entre sí. */
export const WIDGET_ORDER_KEY = "inicio_widget_order";

/** Aplica un orden guardado a los items presentes ESTE render. Robusto ante deriva
 *  del blob: los ids guardados que ya no existen se ignoran; los items nuevos (sin
 *  rank) van al final conservando su orden original (sort estable). No inventa ni
 *  descarta tarjetas: solo reordena las que hay. */
export function applyWidgetOrder<T extends { id: string }>(
  items: T[],
  order: string[] | undefined,
): T[] {
  if (!order || order.length === 0) return items;
  const rank = new Map(order.map((id, i) => [id, i]));
  const rankOf = (id: string) =>
    rank.has(id) ? (rank.get(id) as number) : Number.POSITIVE_INFINITY;
  // copia + sort estable (V8): los desconocidos (Infinity) mantienen orden relativo.
  return [...items].sort((a, b) => rankOf(a.id) - rankOf(b.id));
}

/** Mueve un item de `from` a `to` (índices), devolviendo un array nuevo. Fuera de
 *  rango o no-op → devuelve el original sin tocar. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const copy = [...items];
  const [moved] = copy.splice(from, 1);
  if (moved === undefined) return items; // inalcanzable por el guardia de rango; satisface a TS
  copy.splice(to, 0, moved);
  return copy;
}

/** Lee el orden guardado del blob. Defensivo: solo acepta un array de strings
 *  (el blob es `unknown`); cualquier otra forma → `undefined` (usa el orden natural). */
export function readWidgetOrder(
  blob: PreferencesBlob | undefined,
  key: string = WIDGET_ORDER_KEY,
): string[] | undefined {
  const v = blob?.[key];
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined;
}

/** Devuelve el blob COMPLETO con el orden actualizado (respeta "reemplaza, no merge":
 *  preserva el resto de las prefs y solo pisa la clave del orden indicada). */
export function withWidgetOrder(
  blob: PreferencesBlob | undefined,
  order: string[],
  key: string = WIDGET_ORDER_KEY,
): PreferencesBlob {
  return { ...(blob ?? {}), [key]: order };
}
