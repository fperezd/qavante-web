/* Validación de RUT chileno mediante algoritmo módulo 11 (DV). */

export function isValidRut(rut: string): boolean {
  const clean = rut.replace(/[.\-\s]/g, "").toUpperCase();
  if (clean.length < 2) return false;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  /* Cuerpo todo-ceros ("0", "00000000"): pasa el módulo 11 (DV "0") pero el
     RUT 0 no existe en Chile (parten en 1). Rechazar datos basura. */
  if (!/[1-9]/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return expected === dv;
}

/** Normaliza un RUT a `cuerpo-DV` sin puntos, DV en mayúscula (ej.
 *  `76.123.456-0` → `76123456-0`). Formato que espera el SII (`getstc`).
 *  Si no hay al menos 2 caracteres válidos, devuelve el input tal cual. */
export function normalizeRut(rut: string): string {
  const clean = rut.replace(/[.\-\s]/g, "").toUpperCase();
  if (clean.length < 2) return rut.trim();
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

/* IDENTIDADES QUE NO IDENTIFICAN A NADIE.
   `55.555.555-5` es el centinela que el SII usa para TODA contraparte extranjera, y los
   libros traen además `SIN-RUT` y `S/D`. No son RUTs: son la ausencia de uno, escrita.
   Usarlos como clave de agrupación funde contrapartes distintas en una sola fila, y la fila
   se queda con el primer nombre que apareció — así es como un importe termina rotulado con
   el nombre de otra empresa.

   Esta es la MISMA lista que contuvo el caso en Contraparte 360; vive acá, al lado de
   `normalizeRut`, para que no haya dos definiciones de "identidad débil" en el repo. */
const IDENTIDADES_DEBILES = new Set(["55555555-5", "SIN-RUT", "S/D"]);
const TOKENS_DEBILES = new Set(["555555555", "SINRUT", "SD"]);

/** El centinela del SII para contrapartes extranjeras. */
export const RUT_CONTRAPARTE_EXTRANJERA = "55555555-5";

/**
 * `true` cuando el valor NO identifica una contraparte: vacío, el centinela de extranjero,
 * o un `SIN-RUT` / `S/D` en cualquiera de sus escrituras. Quien agrupe por contraparte tiene
 * que preguntar esto ANTES de usar el RUT como clave.
 */
export function esIdentidadDebil(rut: string | null | undefined): boolean {
  if (rut == null) return true;
  const token = rut
    .trim()
    .replace(/[.\-\s/]/g, "")
    .toUpperCase();
  const normalizado = normalizeRut(rut);
  return (
    normalizado.trim() === "" || IDENTIDADES_DEBILES.has(normalizado) || TOKENS_DEBILES.has(token)
  );
}
