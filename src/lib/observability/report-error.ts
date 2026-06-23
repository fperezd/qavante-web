/* Seam único de reporte de errores de cliente (Tooxs Frontend Standard §17).
   El proveedor concreto (Sentry u otro) es intercambiable; lo normativo es que
   exista UN solo `reportError` y que TODAS las error boundaries lo llamen.

   Regla: NUNCA PII en el reporte. El `context` es para tags acotados (área,
   digest de Next, código de error), no para datos del usuario. */

export type ErrorReportContext = Record<string, string | number | boolean | undefined>;

export function reportError(error: unknown, context?: ErrorReportContext): void {
  /* TODO: integrar el proveedor configurado (Sentry/etc.) detrás de este seam.
     Por ahora, log sin PII en no-producción; en prod queda listo para enviar. */
  if (process.env.NODE_ENV !== "production") {
    console.error("[reportError]", error, context);
  }
}
