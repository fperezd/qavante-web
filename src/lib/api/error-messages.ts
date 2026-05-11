import { ApiError } from "./errors";

/* Mapping de errores técnicos -> mensajes visibles al usuario.
   Implementa Anexo C.3 del Documento Maestro v2.6.3.
   El contexto permite ajustar el copy: e.g. en login 401 no es
   "sesión expiró" sino "credenciales incorrectas". */

export type ErrorContext = "general" | "login";

export function apiErrorToUserMessage(
  err: ApiError,
  context: ErrorContext = "general",
): string {
  if (err.isNetworkError()) {
    return "Parece que perdiste conexión. Verificá tu internet.";
  }

  if (context === "login" && err.status === 401) {
    return "RUT o clave incorrectos. Verificá tus datos.";
  }

  switch (err.code) {
    case "invalid_credentials":
      return "La credencial requiere revisión.";
    case "source_unavailable":
      return "La fuente no está disponible en este momento.";
    case "config_missing":
      return err.message;
  }

  switch (err.status) {
    case 401:
      return "Tu sesión expiró. Volvé a iniciar sesión.";
    case 403:
      return "No tenés permisos para realizar esta acción.";
    case 404:
      return "No encontramos la información que buscás.";
    case 408:
    case 504:
      return "La operación está demorando más de lo esperado.";
    case 422:
      return "Algunos datos no son válidos. Revisá el formulario.";
    case 429:
      return "Hiciste muchas operaciones seguidas. Esperá unos segundos.";
    case 503:
      return "Qavante está en mantenimiento. Volvemos pronto.";
  }

  if (err.status >= 500) {
    return "No pudimos cargar la información. Intentá nuevamente.";
  }

  return err.message || "Ocurrió un error inesperado.";
}
