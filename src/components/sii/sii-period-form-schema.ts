/* Schema + helpers del form de consulta SII por período (Sprint C1 PR-Sii3).
   Reusable por las 3 vistas: RCV Compras, RCV Ventas, BHE recibidas.
   Vive aparte del form para mantenerse testeable sin renderizar UI.
 *
 * Decisiones:
 * - Aceptamos formato `YYYY-MM` (estándar ISO month) y `YYYYMM` (compacto
 *   que el backend también acepta). El backend normaliza ambos. Rechazamos
 *   formatos no-numéricos como "marzo 2026" — son ambiguos y propensos a
 *   typo. Si el usuario los necesita, lo agregamos después con confirmación.
 * - Mes obligatoriamente 01-12. Año obligatoriamente 4 dígitos.
 * - Default: período anterior al mes actual (los datos del mes vigente
 *   típicamente no están completos en el SII hasta el día 12-15 del
 *   mes siguiente). Calculado con la fecha de runtime — el caller puede
 *   override pasando opts.now para tests determinísticos. */
import { z } from "zod";

export const siiPeriodFormSchema = z.object({
  periodo: z
    .string()
    .trim()
    .min(1, "Elige el período que quieres consultar.")
    .refine((v) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v) || /^\d{4}(0[1-9]|1[0-2])$/.test(v), {
      message: "Usa el formato AAAA-MM (ej: 2026-04) o AAAAMM (ej: 202604).",
    }),
});

export type SiiPeriodFormValues = z.infer<typeof siiPeriodFormSchema>;

/** Devuelve el período anterior al mes pasado en `now` (default: mes
 *  pasado de hoy). Útil como default del form porque los datos del mes
 *  actual típicamente no están completos en el SII hasta mediados del
 *  mes siguiente. Formato `YYYY-MM`.
 *
 *  @param now - opcional, para tests determinísticos. */
export function defaultPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-11; restamos 1 mes ⇒ ya queda 0-based del mes anterior
  /* Si estamos en enero, el "mes anterior" es diciembre del año previo. */
  const targetMonth = month === 0 ? 12 : month;
  const targetYear = month === 0 ? year - 1 : year;
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
}

/** Normaliza el input a `YYYY-MM` para presentación. El backend acepta
 *  ambos pero el FE muestra siempre con guión. */
export function normalizePeriod(input: string): string {
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{6}$/.test(trimmed)) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4)}`;
  }
  return trimmed; // no debería llegar acá si el schema validó
}

/** Período `YYYY-MM` → label humano "Abril 2026". */
export function formatPeriodLabel(periodo: string): string {
  const meses = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const normalized = normalizePeriod(periodo);
  const m = /^(\d{4})-(\d{2})$/.exec(normalized);
  if (!m) return periodo;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const mesLabel = meses[month - 1] ?? `Mes ${month}`;
  return `${mesLabel} ${year}`;
}
