import { ApiError } from "./errors";
import { fallbackUserMessage, renderUserMessage } from "./user-message";

/* Mapping de errores técnicos -> mensajes visibles al usuario.
   Implementa Anexo C.3 del Documento Maestro v2.6.4.
   El contexto permite ajustar el copy: e.g. en login 401 no es
   "sesión expiró" sino "credenciales incorrectas". */

export type ErrorContext = "general" | "login";

export function apiErrorToUserMessage(err: ApiError, context: ErrorContext = "general"): string {
  if (context === "login" && err.status === 401) {
    return "RUT o clave incorrectos. Verifica tus datos.";
  }

  if (err.userMessage) return renderUserMessage(err.userMessage);
  return fallbackUserMessage(err.status, err.code);
}

/** Boundary seguro para callbacks cuya librería tipa el fallo como `Error` o `unknown`. */
export function unknownErrorToUserMessage(
  err: unknown,
  fallback = "Ocurrió un error inesperado. Intenta nuevamente.",
): string {
  return err instanceof ApiError ? apiErrorToUserMessage(err) : fallback;
}
