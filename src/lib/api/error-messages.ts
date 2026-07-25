import { ApiError } from "./errors";

/* Mapping de errores técnicos -> mensajes visibles al usuario.
   Implementa Anexo C.3 del Documento Maestro v2.6.4.
   El contexto permite ajustar el copy: e.g. en login 401 no es
   "sesión expiró" sino "credenciales incorrectas". */

export type ErrorContext = "general" | "login";

export function apiErrorToUserMessage(err: ApiError, context: ErrorContext = "general"): string {
  if (context === "login" && err.status === 401) {
    return "RUT o clave incorrectos. Verifica tus datos.";
  }

  /* Codes específicos antes que isNetworkError(): config_missing se lanza con
     status 0, igual que un network error real, pero el mensaje técnico es
     más útil para el dev. */
  switch (err.code) {
    case "invalid_credentials":
      return "La credencial requiere revisión.";
    case "source_unavailable":
      return "La fuente no está disponible en este momento.";
    case "config_missing":
      return err.message;
    /* Captcha (Turnstile): el token es de un solo uso y expira → un reintento
       con el token viejo da `captcha_failed` (status 403). NO es un problema de
       permisos: hay que rehacer el captcha. Mapear explícito antes del switch
       de status (que lo mostraba como "No tienes permisos"). */
    case "captcha_failed":
      return "No pudimos verificar el captcha. Recárgalo e intenta de nuevo.";
  }

  /* El backend a veces filtra el `detail` con instrucciones de DEV (endpoints internos, variables de
     entorno) — eso NUNCA va al dueño. Caso conocido: el sync del SII cuando el RUT de la empresa no
     está autorizado o falta el certificado del SII (el detalle menciona `seed-cert`/`SII_CERT_PATH`/
     `cert_b64`). Damos un mensaje limpio y accionable en su lugar (surface honesto, no ocultamos el
     problema — decimos qué pasa y dónde mirar). */
  if (/seed-cert|sii_cert_path|cert_b64/i.test(err.message ?? "")) {
    return "El SII no aceptó las credenciales para sincronizar el RUT de tu empresa: no está autorizado o falta un certificado válido del SII. Revisa tu clave y tu certificado del SII en Administración → Credenciales.";
  }

  if (err.isNetworkError()) {
    return "Parece que perdiste conexión. Verifica tu internet.";
  }

  switch (err.status) {
    case 401:
      return "Tu sesión expiró. Vuelve a iniciar sesión.";
    case 403:
      /* El backend suele mandar un detalle específico y user-facing en el 403
         (ej. por qué el SII rechaza la consulta, falta de consentimiento, etc.).
         Lo preferimos sobre el genérico — el "No tienes permisos" escondía la
         causa real. Cae al genérico solo si no hay detalle útil. */
      return err.message && err.message !== `Error ${err.status}`
        ? err.message
        : "No tienes permisos para realizar esta acción.";
    case 404:
      return "No encontramos la información que buscas.";
    case 408:
    case 504:
      return "La operación está demorando más de lo esperado.";
    case 422:
      return "Algunos datos no son válidos. Revisa el formulario.";
    case 429:
      return "Hiciste muchas operaciones seguidas. Espera unos segundos.";
    case 503:
      return "Qavante está en mantenimiento. Volvemos pronto.";
  }

  if (err.status >= 500) {
    /* Igual que el 403: si el backend mandó un detalle específico y útil (no un
       genérico tipo "Internal Server Error"), lo mostramos en vez de esconder la
       causa. Ayuda a diagnosticar 500 inesperados (ej. el RCV del SII que falla
       al traer en vivo). Cae al genérico si el detalle no aporta. */
    const generic = "No pudimos cargar la información. Intenta nuevamente.";
    const bare = ["Internal Server Error", "Service Unavailable", `Error ${err.status}`];
    return err.message && !bare.includes(err.message) ? err.message : generic;
  }

  return err.message || "Ocurrió un error inesperado.";
}
