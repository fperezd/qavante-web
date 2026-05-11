/* Formatea RUT chileno a 12.345.678-9. Acepta cualquier input
   (con o sin puntos/guion); normaliza y devuelve formateado. */

export function formatRut(rut: string): string {
  const clean = rut.replace(/[.\-\s]/g, "").toUpperCase();
  if (clean.length < 2) return clean;

  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);

  const withDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${withDots}-${dv}`;
}
