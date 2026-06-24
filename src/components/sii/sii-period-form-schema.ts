/* Schema + helpers del form de consulta SII por período (Sprint C1 PR-Sii3).
   Reusable por las 3 vistas: RCV Compras, RCV Ventas, BHE recibidas.
   Vive aparte del form para mantenerse testeable sin renderizar UI.
 *
 * Decisiones:
 * - El usuario ingresa/ve `MM-AAAA` (convención Qavante: mes antes que año,
 *   siempre). Internamente lo normalizamos a `YYYY-MM` (lo que espera el
 *   backend). Rechazamos formatos no-numéricos como "marzo 2026" — son
 *   ambiguos y propensos a typo.
 * - Mes obligatoriamente 01-12. Año obligatoriamente 4 dígitos.
 * - Default: período anterior al mes actual (los datos del mes vigente
 *   típicamente no están completos en el SII hasta el día 12-15 del
 *   mes siguiente). Calculado con la fecha de runtime — el caller puede
 *   override pasando opts.now para tests determinísticos. */
import { z } from "zod";

export const siiPeriodFormSchema = z.object({
  // Lo que escribe el usuario: MM-AAAA (mes antes que año).
  periodo: z
    .string()
    .trim()
    .min(1, "Elige el período que quieres consultar.")
    .refine((v) => /^(0[1-9]|1[0-2])-\d{4}$/.test(v), {
      message: "Usa el formato MM-AAAA (ej: 04-2026).",
    }),
});

export type SiiPeriodFormValues = z.infer<typeof siiPeriodFormSchema>;

/** Devuelve el período anterior al mes pasado en `now` (default: mes
 *  pasado de hoy). Útil como default del form porque los datos del mes
 *  actual típicamente no están completos en el SII hasta mediados del
 *  mes siguiente. Formato `MM-AAAA` (el que ve el usuario).
 *
 *  @param now - opcional, para tests determinísticos. */
export function defaultPeriod(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-11; restamos 1 mes ⇒ ya queda 0-based del mes anterior
  /* Si estamos en enero, el "mes anterior" es diciembre del año previo. */
  const targetMonth = month === 0 ? 12 : month;
  const targetYear = month === 0 ? year - 1 : year;
  return `${String(targetMonth).padStart(2, "0")}-${targetYear}`;
}

/** Normaliza a `YYYY-MM` (lo que espera el backend). Acepta el `MM-AAAA` del
 *  usuario y, defensivamente, un `YYYY-MM` ya normalizado. */
export function normalizePeriod(input: string): string {
  const trimmed = input.trim();
  const mmaaaa = /^(\d{2})-(\d{4})$/.exec(trimmed); // MM-AAAA → YYYY-MM
  if (mmaaaa) return `${mmaaaa[2]}-${mmaaaa[1]}`;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed; // ya YYYY-MM (defensivo)
  if (/^\d{6}$/.test(trimmed)) return `${trimmed.slice(0, 4)}-${trimmed.slice(4)}`;
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
