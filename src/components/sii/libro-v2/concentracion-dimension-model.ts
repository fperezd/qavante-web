/* Modelo PURO de la distribución por DIMENSIÓN (tamaño/tramo o industria/sector) de la contraparte.
 * Reusable para las 4 vistas: clientes/proveedores × tamaño/industria. El backend manda los items ya
 * con su monto + pct (agregación #825, `concentracion-dimensiones?kind=ventas|compras`); el FE solo
 * ordena, recorta al top-N y agrupa el resto en "Otros". Sin React, testeable. */

export interface DistribucionItem {
  /** Etiqueta legible: "Comercio al por mayor" / "Mid-Corp — Tramo 11". */
  label: string;
  /** Monto acumulado (ventas o compras) de la categoría. */
  monto: number;
  /** Participación 0-100 sobre el total del período. */
  pct: number;
  /** Tooltip opcional (ej. qué significa el tramo). */
  hint?: string;
}

export interface DistribucionPreparada {
  /** Top `max` por monto. */
  top: DistribucionItem[];
  /** Agregado del resto (más allá de `max`), o `null` si no hay resto. */
  otros: { monto: number; pct: number } | null;
}

/** Ordena desc por monto, toma el top `max` y agrupa el resto en "Otros" (suma monto + pct). El total
 *  de "otros" nunca aporta un pct negativo (clamp a 0): si un período netea raro, no mostramos un
 *  "Otros −X%". Puro/testeable. */
export function prepararDistribucion(items: DistribucionItem[], max = 5): DistribucionPreparada {
  const ordenados = [...items].sort((a, b) => b.monto - a.monto);
  const top = ordenados.slice(0, max);
  const resto = ordenados.slice(max);
  const otros = resto.length
    ? {
        monto: resto.reduce((s, i) => s + i.monto, 0),
        pct: Math.max(
          0,
          resto.reduce((s, i) => s + i.pct, 0),
        ),
      }
    : null;
  return { top, otros };
}
