const EM_DASH_WITH_SPACING = /[\t ]*\u2014[\t ]*/g;

/**
 * Normaliza puntuación que llega desde datos dinámicos justo antes de mostrarla.
 * No debe usarse para persistencia, identidad, búsquedas ni contratos.
 */
export function normalizeVisibleText(value: string): string;
export function normalizeVisibleText(value: null): null;
export function normalizeVisibleText(value: undefined): undefined;
export function normalizeVisibleText(value: string | null | undefined): string | null | undefined {
  if (value == null) return value;
  return value.replace(EM_DASH_WITH_SPACING, " · ");
}
