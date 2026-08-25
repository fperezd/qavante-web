/* Nombres de mes en español — UNA fuente.

   Estaban repetidos en 11 archivos, en cuatro variantes de casing/largo que solo
   se distinguían al leerlas letra por letra. Los NOMBRES son uno solo; el casing
   es una decisión de presentación, así que las variantes se DERIVAN del canónico
   en vez de re-escribirse. Agregar un mes mal escrito ahora rompe los 11 lugares
   a la vez, que es exactamente lo que se quiere de una fuente única.

   Se deriva a mano y no de `Intl.DateTimeFormat("es-CL")` porque el ICU rinde
   "sept" (4 letras) para septiembre en varias versiones de Node/navegador: el
   ancho de la columna dependería del runtime del usuario. */

/** Canónico corto, minúscula: "ene" … "dic". Índice 0 = enero. */
export const MESES_CORTOS = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
] as const;

/** Canónico largo, minúscula: "enero" … "diciembre". Índice 0 = enero. */
export const MESES_LARGOS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
] as const;

const capitalizar = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Corto capitalizado: "Ene" … "Dic". Para encabezados de columna de grillas. */
export const MESES_CORTOS_CAP: readonly string[] = MESES_CORTOS.map(capitalizar);

/** Largo capitalizado: "Enero" … "Diciembre". Para etiquetas de fila. */
export const MESES_LARGOS_CAP: readonly string[] = MESES_LARGOS.map(capitalizar);

/** Período "YYYY-MM" o "YYYY-MM-DD" → mes corto ("2026-07" → "jul").
 *  Lo que no parsea vuelve TAL CUAL: mejor mostrar el período crudo que un mes
 *  inventado. */
export function mesCortoDePeriodo(period: string): string {
  const m = /^\d{4}-(\d{2})/.exec(period);
  const idx = m ? Number(m[1]) - 1 : NaN;
  return MESES_CORTOS[idx] ?? period;
}
