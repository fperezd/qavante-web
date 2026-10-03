import { ApiError } from "@/lib/api/errors";
import { apiErrorToUserMessage } from "@/lib/api/error-messages";

/* Copy de los fallos de la pantalla de bancos conectados.
 *
 * Tres reglas que este módulo existe para sostener:
 *
 * 1. El mensaje del servidor (`error.message`) es evidencia técnica, no copy.
 *    Nunca sale a pantalla.
 * 2. Un fallo de conexión bancaria dice en qué quedó la conexión y qué hacer.
 *    Nunca "error inesperado": eso no es ni un estado ni una acción.
 * 3. `apiErrorToUserMessage` manda cuando tiene copy propio para el código —
 *    ahí viven los `fintoc_*` y el `user_message` del servidor. Lo que NO se
 *    usa es su cola genérica por status, que para un status sin mapear
 *    devuelve justamente "Ocurrió un error inesperado": esa cola se detecta
 *    comparando contra el mismo error sin código ni `user_message`, así que un
 *    `fintoc_*` nuevo en el mapper se aprovecha solo, sin tocar este archivo.
 *
 * Es un módulo puro a propósito: el copy se verifica sin montar el panel. */

/** En qué quedó la conexión cuando la acción falló. Lo primero que el dueño necesita saber. */
const ACCION_SIN_EFECTO = {
  desconectar: "El banco sigue conectado y Qavante sigue leyendo sus movimientos.",
  eliminar: "El banco y su historial siguen en Qavante.",
} as const;

export type AccionConexion = keyof typeof ACCION_SIN_EFECTO;

/** El copy del mapper canónico sólo si es específico de este error, no su cola por status. */
function copySpecificoDelMapper(error: ApiError): string | null {
  const mapped = apiErrorToUserMessage(error);
  const genericoDelStatus = apiErrorToUserMessage(new ApiError("", error.status));
  return mapped === genericoDelStatus ? null : mapped;
}

/** Fallo al listar las conexiones de la sociedad activa. */
export function connectionsLoadError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "No pudimos cargar las conexiones bancarias de esta sociedad. Usa Reintentar.";
  }
  if (error.status === 401) {
    return "Tu sesión expiró. Inicia sesión nuevamente para ver tus conexiones.";
  }
  if (error.status === 403) {
    return "No tienes autorización para ver las conexiones de esta sociedad. Pide acceso a quien administra la cuenta.";
  }
  if (error.status === 0 || error.code === "network_error") {
    return "No pudimos comunicarnos con Qavante para pedir tus conexiones. Usa Reintentar.";
  }
  const especifico = copySpecificoDelMapper(error);
  if (especifico) return especifico;
  if (error.status === 404) {
    return "Qavante no encontró conexiones registradas para esta sociedad. Usa Reintentar; si sigue igual, conecta el banco desde Banco.";
  }
  if (error.status === 429) {
    return "Hiciste muchas consultas seguidas. Espera un momento y usa Reintentar.";
  }
  if (error.status === 408 || error.status === 504) {
    return "Qavante está tardando en responder con tus conexiones. Usa Reintentar.";
  }
  return "Qavante no pudo listar tus conexiones bancarias. Usa Reintentar; tus bancos siguen conectados y sus movimientos se siguen guardando.";
}

/** Fallo al desconectar o eliminar una conexión. */
export function connectionActionError(error: unknown, accion: AccionConexion): string {
  if (!(error instanceof ApiError)) {
    return `${ACCION_SIN_EFECTO[accion]} Vuelve a intentar la operación.`;
  }
  /* 404: la conexión ya no está. Decir "sigue conectado" sería afirmar un estado que el
     servidor acaba de negar. */
  if (error.status === 404) {
    return "Esta conexión ya no está en Qavante. Usa Reintentar para refrescar la lista.";
  }
  const estado = ACCION_SIN_EFECTO[accion];
  if (error.status === 401) {
    return `${estado} Tu sesión expiró: inicia sesión nuevamente y repite la operación.`;
  }
  if (error.status === 403) {
    return `${estado} No tienes autorización para esta operación; pídesela a quien administra la cuenta.`;
  }
  if (error.status === 0 || error.code === "network_error") {
    return `${estado} No pudimos comunicarnos con Qavante. Vuelve a intentar.`;
  }
  const especifico = copySpecificoDelMapper(error);
  if (especifico) return `${estado} ${especifico}`;
  if (error.status === 409) {
    return `${estado} Hay otra operación en curso sobre este banco. Usa Reintentar para refrescar la lista y repite la operación.`;
  }
  if (error.status === 429) {
    return `${estado} Hiciste muchas operaciones seguidas. Espera un momento y repite la operación.`;
  }
  if (error.status === 408 || error.status === 504) {
    return `${estado} Qavante está tardando en responder. Usa Reintentar para refrescar la lista antes de repetir la operación.`;
  }
  return `${estado} Qavante no pudo completar la operación. Vuelve a intentar.`;
}
