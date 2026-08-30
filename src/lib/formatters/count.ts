/* Conteos — UNA fuente para los números que NO son plata.
 *
 * Por qué existe: "3 documentos", "11 cuentas con movimiento", "53 días" son cifras que el usuario
 * lee igual que los montos (misma tipografía tabular, misma columna) pero que no llevan símbolo de
 * moneda. Hasta ahora cada pantalla las escribía con `toLocaleString("es-CL")` a mano, que es
 * exactamente el patrón que el lint del rediseño (§5.8, "formato único") persigue en los montos —
 * y que en los conteos pasaba por el mismo agujero.
 *
 * La regla: separador de miles es-CL, CERO decimales (un conteo entero no tiene mitades) y el
 * mismo "s/d" que `formatClp` ante un no-finito, para que un `NaN` no se imprima como número.
 * El "no sé" NO se resuelve acá: un conteo desconocido es `null` y lo dice la pantalla, nunca 0. */

/** Conteo entero → "3", "1.234". No-finito → "s/d". PURO. */
export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return "s/d";
  return Math.round(value).toLocaleString("es-CL");
}

/** Días → "53 días", "1 día", "−7 días". Dos decisiones deliberadas:
 *
 *  - El singular importa: "1 días" se lee como un bug del sistema, no como un dato.
 *  - El negativo lleva el menos tipográfico U+2212, igual que `formatClp` y `formatPct`. Hace
 *    falta de verdad: el ciclo de conversión de caja (DSO − DPO) puede ser negativo, y un
 *    hyphen-minus al lado de un "−$300.000" en la misma tarjeta son dos signos distintos para
 *    la misma idea. PURO. */
export function formatDays(value: number): string {
  if (!Number.isFinite(value)) return "s/d";
  const n = Math.round(value);
  const magnitud = Math.abs(n).toLocaleString("es-CL");
  const signo = n < 0 ? "−" : "";
  return `${signo}${magnitud} ${Math.abs(n) === 1 ? "día" : "días"}`;
}
