/* Vencimiento de Previred: las cotizaciones de un mes se enteran hasta el día 13
   del mes SIGUIENTE (Previred electrónico). Puro, testeado. Devuelve ISO
   (YYYY-MM-13) o null si el período no es "YYYY-MM". No ajusta por feriados/fin
   de semana (mostramos la fecha canónica; el ajuste hábil lo hace Previred). */
export function vencimientoPrevired(period: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (mo < 1 || mo > 12) return null;
  const ny = mo === 12 ? y + 1 : y;
  const nm = mo === 12 ? 1 : mo + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-13`;
}
