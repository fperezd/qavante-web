/* Rótulos de los bloques de /gestion — fuente ÚNICA.
 *
 * Por qué existe este módulo y no un string en cada componente: en /gestion había DOS bloques
 * montados uno encima del otro y los dos se titulaban "Resultado operacional". Uno mira hacia
 * ATRÁS (`GET /api/management/operational-result?period=YYYY-MM`, lo que ya ocurrió) y el otro
 * hacia ADELANTE (`GET /api/management/operational-result/v2`, que arma el período de `as_of+1`
 * a `as_of+horizon_days`: con los 90 días que pide el frontend, un bloque abierto el 4 de
 * octubre de 2026 cubre oct 2026 a ene 2027). Ninguno de los dos mentía — los dos publican su
 * rango debajo del título — pero con el MISMO título el lector entiende "lo que pasó" en los dos.
 *
 * Nada impedía que volvieran a coincidir: cada componente escribía su título a mano. Ahora el
 * nombre vive acá y `gestion-titulos.test.ts` falla si los dos vuelven a ser iguales o si alguien
 * los vuelve a escribir a mano en el componente. */

/** Lo CORRIDO: el período cerrado que ya ocurrió. Es el nombre que el dueño espera bajo esa cifra. */
export const RESULTADO_CORRIDO = "Resultado operacional";

/** El HORIZONTE: el tramo que viene. No se llama "resultado" a propósito —
 *  un resultado es algo que ya pasó, y esto todavía no pasa. */
export const RESULTADO_HORIZONTE = "Operación hacia adelante";
