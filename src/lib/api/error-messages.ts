import { ApiError } from "./errors";
import { fallbackUserMessage, renderUserMessage } from "./user-message";

/* Mapping de errores técnicos -> mensajes visibles al usuario.
   Implementa Anexo C.3 del Documento Maestro v2.6.4.
   El contexto permite ajustar el copy: e.g. en login 401 no es
   "sesión expiró" sino "credenciales incorrectas". */

export type ErrorContext = "general" | "login";

export function apiErrorToUserMessage(err: ApiError, context: ErrorContext = "general"): string {
  if (err.code === "oauth_user_not_found") {
    return err.message || "No hay una cuenta Qavante con ese correo. Registrate primero.";
  }
  if (err.code === "oauth_pending_verification") {
    return (
      err.message ||
      "Esa cuenta existe pero todavía no confirmó el correo. Revisá la bandeja o reenviá la verificación."
    );
  }
  if (err.code === "oauth_state_mismatch" || err.code === "oauth_exchange_failed") {
    return err.message || "No pudimos completar el login con Google o Microsoft. Volvé a intentar.";
  }
  if (err.code === "oauth_not_configured") {
    return "Login con Google o Microsoft no está disponible en este ambiente.";
  }
  if (err.code === "rut_taken") {
    return err.message || "Ese RUT ya está en otra cuenta.";
  }
  if (err.code === "rut_already_set") {
    return err.message || "Esta cuenta ya tiene un RUT.";
  }
  if (err.code === "signup_conflict") {
    return "Esa cuenta ya existe. Inicia sesión o usa otro correo.";
  }
  if (err.code === "self_delete_forbidden") {
    return "Esta cuenta no se puede borrar en este ambiente.";
  }

  if (context === "login" && err.status === 401) {
    return "Correo o clave incorrectos. Verifica tus datos.";
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
