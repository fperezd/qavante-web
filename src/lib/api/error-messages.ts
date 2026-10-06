import { ApiError } from "./errors";
import { fallbackUserMessage, renderUserMessage } from "./user-message";

/* Mapping de errores técnicos -> mensajes visibles al usuario.
   Implementa Anexo C.3 del Documento Maestro v2.6.4.
   El contexto permite ajustar el copy: e.g. en login 401 no es
   "sesión expiró" sino "credenciales incorrectas". */

export type ErrorContext = "general" | "login" | "login-correo";

/* Misma situación de usuario para dos códigos distintos (`missing_scope:*` que sí emite la API y
   la guarda interna `classification_scope_required`): un solo texto, para que no se separen. */
const ELIGE_EMPRESA_PARA_CLASIFICAR =
  "Elige una Empresa en el encabezado para clasificar: las cuentas de gestión y las reglas de clasificación son de cada sociedad.";

export function apiErrorToUserMessage(err: ApiError, context: ErrorContext = "general"): string {
  if (err.code === "oauth_user_not_found") {
    return err.message || "No hay una cuenta Qavante con ese correo. Registrate primero.";
  }
  if (err.code === "oauth_pending_verification") {
    return (
      err.message ||
      "Esa cuenta existe pero todavía no confirmó el correo. Revisa la bandeja o reenvía la verificación."
    );
  }
  if (err.code === "oauth_state_mismatch" || err.code === "oauth_exchange_failed") {
    return err.message || "No pudimos completar el login con Google o Microsoft. Vuelve a intentarlo.";
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

  /* LOS 403 QUE NO SON FALTA DE PERMISOS.
     Medido el 2026-10-05 en el paso "Tu RUT" del onboarding: el usuario vio "No tienes permisos
     para realizar esta acción" —el genérico de CUALQUIER 403, `fallbackUserMessage`— cuando el
     problema no tenía nada que ver con sus permisos. Y como el mensaje no nombra la causa, no
     quedó forma de saber cuál de los 403 posibles había sido: la pantalla fue el único testigo y
     dijo algo falso.

     Los tres `csrf_origin_*` los emite el middleware global de la API, que exige un `Origin`
     confiable en toda mutación que viaje con cookie de sesión. La acción que sirve es recargar,
     porque suele ser una pestaña vieja o abierta desde otra dirección; reintentar el mismo envío
     no cambia nada.

     `no_active_membership` es distinto: la sesión es válida pero ya no autoriza esa empresa, y
     la API además revoca la sesión. Mandar a reintentar sería mandar a chocar con lo mismo. */
  if (
    err.code === "csrf_origin_required" ||
    err.code === "csrf_origin_invalid" ||
    err.code === "csrf_origin_rejected"
  ) {
    return "No se guardó: la verificación de seguridad rechazó la dirección desde la que llegó la operación. Recarga la página desde app.qavante.com y repítela; si la tenías abierta hace rato, vuelve a entrar.";
  }
  if (err.code === "no_active_membership") {
    return "Tu acceso a esta empresa ya no está activo, así que la operación no se guardó. Vuelve a iniciar sesión y, si sigue igual, pide que reactiven tu acceso.";
  }
  if (err.code === "api_key_required") {
    return "Esta operación necesita una credencial de integración, no tu sesión del navegador.";
  }
  if (err.code === "signup_conflict") {
    return "Esa cuenta ya existe. Inicia sesión o usa otro correo.";
  }
  if (err.code === "self_delete_forbidden") {
    return "Esta cuenta no se puede borrar en este ambiente.";
  }
  if (err.code === "fintoc_attribution_unverified") {
    return "La cuenta se conectó, pero no podemos asociarla a la empresa activa. Verifica que su RUT esté declarado en Administración → Empresas y que sea el titular de la cuenta.";
  }
  if (err.code === "fintoc_holder_mismatch") {
    return "Las cuentas tienen un RUT titular distinto. Elige o registra al titular correcto antes de importarlas.";
  }
  if (err.code === "fintoc_link_missing" || err.code === "fintoc_exchange_failed") {
    return "Fintoc no entregó la conexión necesaria para importar las cuentas. Intenta conectar el banco nuevamente.";
  }
  if (err.code === "fintoc_permissions_missing") {
    return "Fintoc creó el enlace, pero su API rechazó la lectura de cuentas. Revisa el enlace en Fintoc o consulta a soporte con su identificador.";
  }
  if (err.code === "fintoc_not_configured") {
    return "La conexión bancaria no está disponible en este momento. Intenta nuevamente más tarde.";
  }
  if (err.code === "bank_movement_currency_unverified") {
    // #370 v1 (qavante-api#905): 422 sin escritura. El backend no completa la moneda con la de
    // la cuenta ni con CLP; el mensaje no invita a reintentar lo mismo.
    return "No se guardó la clasificación: la moneda de este movimiento bancario no está verificada. Revisa el movimiento en Banco o sincroniza la cuenta antes de clasificarlo.";
  }
  /* CL1 / web#360 — familia de 409 de alcance al clasificar.
     `fallbackUserMessage` no tiene rama para 409, así que TODOS estos códigos caían al
     genérico "Ocurrió un error inesperado": el usuario veía que no se guardó, sin saber
     qué hacer. Cada mensaje nombra la causa y la acción concreta. El selector de Empresa
     vive en el encabezado (mismo lugar que nombra `bandeja-scope`). */
  if (err.code === "missing_scope:legal_entity" || err.code === "missing_scope:tenant") {
    return ELIGE_EMPRESA_PARA_CLASIFICAR;
  }
  if (err.code === "ambiguous_scope:legal_entity") {
    return "Tienes más de una Empresa marcada como predeterminada, así que Qavante no puede decidir sobre cuál escribir. Deja una sola marcada en Administración → Empresas.";
  }
  if (err.code === "scope_mismatch:legal_entity") {
    return "La Empresa que tenías elegida ya no corresponde a esta cuenta. Vuelve a elegirla en el encabezado y repite la clasificación.";
  }
  if (err.code === "missing_scope:functional_currency") {
    return "Esta Empresa todavía no tiene moneda funcional declarada, y la clasificación la necesita para registrar el impacto en la caja. Declárala en Administración → Empresas.";
  }
  /* Lote completo rechazado (qavante-api `treasury_repo`): la respuesta trae `movement_ids`
     con los culpables. Nada quedó clasificado, así que el mensaje no insinúa un éxito parcial. */
  if (err.code === "classification_blocked") {
    return "No se clasificó ningún movimiento del lote porque uno de ellos no pudo registrar su impacto en la caja, casi siempre por tener la moneda sin verificar. Revisa en Banco los movimientos que quedaron señalados y vuelve a enviar el lote.";
  }
  if (err.code === "idempotency_key_reused") {
    return "Este lote llegó con la marca de una operación anterior, así que no se aplicó ningún cambio. Vuelve a enviar la clasificación.";
  }
  /* Guarda interna del backend (`treasury_repo._require_classification_scope`): hoy ninguna
     ruta la convierte en respuesta HTTP —escaparía como 500 `internal_error`—, pero se deja
     mapeada para que no caiga al genérico si alguna la expone. */
  if (err.code === "classification_scope_required") {
    return ELIGE_EMPRESA_PARA_CLASIFICAR;
  }
  /* qavante-api NO emite este código: desde ADR-0120 (migración 0217) las reglas pertenecen a
     una sola sociedad y `TenantWideClassificationEvidenceUnavailable` ya no se lanza. Se deja
     mapeado como respaldo, con copy que dice la verdad de la situación en vez de "no disponible". */
  if (err.code === "tenant_wide_classification_rules_unavailable") {
    return "Las reglas de clasificación son de cada sociedad. Elige una Empresa en el encabezado para ver y aplicar las suyas.";
  }

  if (context === "login" && err.status === 401) {
    return "RUT o clave incorrectos. Verifica tus datos.";
  }
  if (context === "login-correo" && err.status === 401) {
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
