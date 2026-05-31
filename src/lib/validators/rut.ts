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
