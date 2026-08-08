/* Lógica PURA de la VISIBILIDAD de widgets del Inicio (prender/apagar + catálogo), sin React →
   testeable. Espejo de `widget-order.ts` (que sólo hace ORDEN): acá guardamos qué widgets APAGÓ el
   usuario. Persiste en el blob de prefs (`/api/me/preferences`) — contrato "reemplaza, no merge", por
   eso `withHidden` devuelve el blob completo. El catálogo "agregar" es el mismo mecanismo: un widget
   apagado queda disponible para volver a prender. */

import type { PreferencesBlob } from "@/lib/api/preferences";

/** Clave estable de los widgets apagados dentro del blob de prefs. */
export const WIDGET_HIDDEN_KEY = "inicio_widget_hidden";

/** Lee los ids de widgets apagados. Defensivo: sólo un array de strings; cualquier otra forma → []. */
export function readHidden(
  blob: PreferencesBlob | undefined,
  key: string = WIDGET_HIDDEN_KEY,
): string[] {
  const v = blob?.[key];
  return Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : [];
}

/** Blob COMPLETO con la lista de apagados actualizada (preserva el resto de las prefs). */
export function withHidden(
  blob: PreferencesBlob | undefined,
  hidden: string[],
  key: string = WIDGET_HIDDEN_KEY,
): PreferencesBlob {
  return { ...(blob ?? {}), [key]: hidden };
}

/** Prende/apaga un widget: si estaba apagado lo saca de la lista (prende); si no, lo agrega (apaga).
 *  Devuelve una lista NUEVA. Puro. */
export function toggleHidden(hidden: string[], id: string): string[] {
  return hidden.includes(id) ? hidden.filter((h) => h !== id) : [...hidden, id];
}

/** Filtra los widgets apagados. Puro. `hidden` vacío → devuelve la misma lista. */
export function applyVisibility<T extends { id: string }>(items: T[], hidden: string[]): T[] {
  if (hidden.length === 0) return items;
  const h = new Set(hidden);
  return items.filter((i) => !h.has(i.id));
}

/** `true` si el widget está visible (no apagado). Para la UI del panel. */
export function isVisible(hidden: string[], id: string): boolean {
  return !hidden.includes(id);
}
