/* Clasifica POR QUÉ falló traer el PDF/preview de un DTE, para dar un surface
   HONESTO (memoria: no parchar backend en FE, pero surface honesto sí). PURO.

   El patrón conocido "la sesión/certificado del SII está caída" —el SII devuelve su
   página de login (HTML) en vez del documento, o el listado de emitidos trae 0
   documentos— se traduce a lenguaje de dueño + la acción concreta (reconectar en
   Credenciales), replicando `f29-sync-message.ts`. NO se oculta el hecho: para otros
   errores se muestra el motivo crudo del backend si vino; nunca se inventa. */

export type DtePreviewError =
  | { kind: "sii_session"; title: string; description: string }
  | { kind: "backend"; title: string; description: string }
  | { kind: "generic" };

interface ParsedBody {
  code?: string;
  message?: string;
}

/** Extrae `{ code, message }` del cuerpo de error del backend. Soporta los shapes
 *  `{ detail: { code, message } }` (endpoints nuevos), `{ detail: "texto" }` y
 *  `{ code, message }`. Body no-JSON (ej. HTML del SII) → objeto vacío. */
export function parseSiiErrorBody(body: string): ParsedBody {
  if (!body) return {};
  try {
    const obj = JSON.parse(body) as { detail?: unknown; code?: string; message?: string };
    const d = obj.detail;
    if (d && typeof d === "object") {
      const dd = d as { code?: string; message?: string; detail?: string };
      return { code: dd.code ?? obj.code, message: dd.message ?? dd.detail ?? obj.message };
    }
    if (typeof d === "string") return { code: obj.code, message: d };
    return { code: obj.code, message: obj.message };
  } catch {
    return {};
  }
}

/** Códigos del backend que significan "hay que reconectar la sesión/certificado". */
const SESSION_CODES = new Set(["sii_session_expired", "sii_not_connected", "sii_auth_failed"]);

/** Códigos de "el SII rechazó tu CLAVE TRIBUTARIA del representante" (los DTE
 *  EMITIDOS/ventas se bajan logueando con la clave, no con el certificado). La
 *  acción es reingresar la clave en Credenciales → CTA distinta a la de sesión. */
const CLAVE_CODES = new Set(["sii_clave_auth_failed", "sii_clave_invalid", "sii_clave_not_found"]);

/** Clasifica el fallo del preview a partir del status, el content-type y el cuerpo. */
export function classifyDtePreviewError(
  status: number,
  contentType: string,
  body: string,
): DtePreviewError {
  const ct = (contentType ?? "").toLowerCase();
  const { code, message } = parseSiiErrorBody(body);
  const text = `${message ?? ""} ${body ?? ""}`.toLowerCase();

  // La Clave Tributaria del representante no fue aceptada por el SII (ventas/emitidos).
  // NO es una caída temporal: la clave está mal/vencida → reingresarla en Credenciales.
  if ((code != null && CLAVE_CODES.has(code)) || text.includes("clave del representante")) {
    return {
      kind: "sii_session",
      title: "El SII rechazó tu Clave Tributaria",
      description:
        "Los documentos EMITIDOS (ventas) se bajan iniciando sesión en el SII con la Clave " +
        "Tributaria del representante legal, y el SII no la aceptó. Revisa o reingresa la clave en " +
        "Administración → Credenciales y vuelve a intentar.",
    };
  }

  const looksSession =
    (code != null && SESSION_CODES.has(code)) ||
    // dte_not_found con "0 documentos" o mención de sesión/certificado = sesión caída
    // (el propio backend avisa: si el listado trajo 0, revisa la sesión, no el folio).
    (code === "dte_not_found" &&
      (text.includes("sesión") ||
        text.includes("sesion") ||
        text.includes("certificado") ||
        text.includes("0 documento"))) ||
    // El endpoint de PDF devolviendo HTML = la página de login del SII.
    ct.includes("html");

  if (looksSession) {
    return {
      kind: "sii_session",
      title: "El SII no entregó este documento",
      description:
        "El SII respondió con su página de inicio de sesión en vez del PDF (lo baja en vivo cada " +
        "vez). Si ya reconectaste tus credenciales del SII en Administración → Credenciales, suele " +
        "ser una caída temporal del SII: espera unos minutos y vuelve a intentar.",
    };
  }

  // Otro error CON motivo del backend → mostrarlo tal cual (no ocultarlo).
  if (message) {
    return { kind: "backend", title: "No pudimos mostrar la vista previa", description: message };
  }

  return { kind: "generic" };
}
