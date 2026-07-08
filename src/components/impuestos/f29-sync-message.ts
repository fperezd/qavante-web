/* Mensaje del toast cuando el sync de F29 falla al bajar folios. PURO (sin React).
   Regla clave (memoria: no parchar backend en FE, pero surface honesto sí): NO
   ocultamos el motivo real del backend; para el patrón conocido "el SII devolvió
   una página HTML en vez del PDF" (sesión SII caída / no conectada) lo traducimos
   a lenguaje de dueño + acción concreta, sin borrar el hecho. Para errores
   desconocidos, dejamos el detalle crudo del backend visible tal cual. */

export interface F29FailureDetail {
  /** Tipo del backend: F29NotFoundError | F29FetchError | F29ParseError | identity_mismatch. */
  error: string;
  /** Mensaje del SII / motivo (crudo del backend). */
  detail: string;
}

/** ¿El fallo es del tipo "el SII entregó HTML (página) en vez del PDF"? Es la
 *  firma de una sesión SII caída/no conectada (no de folios sueltos malos). */
export function isSiiHtmlInsteadOfPdf(detail: F29FailureDetail | null): boolean {
  if (!detail) return false;
  const d = (detail.detail ?? "").toLowerCase();
  return detail.error === "F29NotFoundError" && (d.includes("no es pdf") || d.includes("text/html"));
}

export interface ToastCopy {
  title: string;
  description: string;
}

export function f29SyncFailureToast(
  siiErrors: number,
  detail: F29FailureDetail | null,
  reqNote = "",
): ToastCopy {
  const folios = siiErrors === 1 ? "folio" : "folios";

  if (isSiiHtmlInsteadOfPdf(detail)) {
    // Motivo real (el SII devolvió una página en vez del PDF) en lenguaje de
    // dueño + acción concreta. No se oculta el hecho, se explica.
    return {
      title: "El SII no entregó tus F29",
      description:
        `El SII devolvió una página web en vez de los PDF (${siiErrors} ${folios}). ` +
        "Suele pasar cuando la sesión del SII expiró: reconecta tu clave del SII en " +
        `Administración → Credenciales e intenta de nuevo${reqNote}.`,
    };
  }

  // Error desconocido → dejar el detalle crudo del backend visible tal cual.
  const failed = siiErrors === 1 ? "F29 falló" : "F29 fallaron";
  return {
    title: `${siiErrors} ${failed} al bajar`,
    description: detail
      ? `${detail.error}: ${detail.detail}${reqNote}`
      : `El SII rechazó algunos folios. Revisa tu conexión al SII e intenta de nuevo${reqNote}.`,
  };
}
