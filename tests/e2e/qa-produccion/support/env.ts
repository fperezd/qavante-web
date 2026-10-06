/* Variables de entorno del QA de producción. NO es un spec (no matchea *.spec.ts).

   La sesión SOLO entra por env en runtime. Ningún archivo de este paquete la imprime, la escribe en
   la evidencia ni la manda a otro host que no sea la app o la API configuradas. */

/** Cookie `qavante_session` del usuario que corre el QA (rol con lectura del tenant). */
export const SESSION = process.env.QAVANTE_SESSION ?? "";

/** Cookie de un usuario con rol limitado (viewer / accountant / external_advisor). Opcional. */
export const SESSION_READONLY = process.env.QAVANTE_SESSION_READONLY ?? "";

/** Id de una sociedad (legal entity) de OTRO tenant, para la prueba de aislamiento. Opcional. */
export const FOREIGN_LEGAL_ENTITY_ID = process.env.QAVANTE_FOREIGN_LEGAL_ENTITY_ID ?? "";

/** Id de OTRO tenant, para la prueba de aislamiento. Opcional. */
export const FOREIGN_TENANT_ID = process.env.QAVANTE_FOREIGN_TENANT_ID ?? "";

/** Sociedad activa a forzar (si no, la app usa la marcada por defecto). Opcional. */
export const LEGAL_ENTITY_ID = process.env.QAVANTE_LEGAL_ENTITY_ID ?? "";

export const APP_URL = (process.env.QAVANTE_APP ?? "https://app.qavante.com").replace(/\/$/, "");
export const API_URL = (process.env.QAVANTE_API ?? "https://api.qavante.com").replace(/\/$/, "");

export const APP_HOST = new URL(APP_URL).host;
export const API_HOST = new URL(API_URL).host;

/**
 * El POST de la proyección canónica (`POST /api/treasury/cash-projection-runs`) es la ÚNICA
 * escritura que alguna pantalla necesita para poder observarse, y está BLOQUEADA POR OMISIÓN.
 *
 * Por qué bloqueada por omisión, y no permitida: una suite de aceptación que corre sola contra
 * producción no decide por su cuenta escribir en producción, ni siquiera una escritura que el
 * producto ya hace al abrir la pantalla. Que sea un cálculo idempotente con `Idempotency-Key` y sin
 * efectos de negocio es un argumento razonable; no es una autorización. La autorización la da el
 * dueño, y la da acá:
 *
 *   QAVANTE_QA_AUTORIZA_PROYECCION=1
 *
 * Sin esa variable, la guardia aborta el POST y los casos que dependen de él (B01 y B19, y el panel
 * de proyección canónica de /caja, /pagar y /decisiones) se SALTAN CON MOTIVO NOMBRADO, no se dan
 * por buenos. Importa la distinción: bloquear el POST fabrica el mismo error que B01 mide, así que
 * un caso que corriera con el POST bloqueado afirmaría el hallazgo por una razón que no es la real.
 */
export const AUTORIZA_PROYECCION = process.env.QAVANTE_QA_AUTORIZA_PROYECCION === "1";

/** Motivo del salto de los casos que exigen la escritura autorizada. */
export const SIN_AUTORIZACION_DE_ESCRITURA =
  "Requiere autorización de escritura: este caso sólo se observa si la pantalla puede ejecutar POST /api/treasury/cash-projection-runs. Correr con QAVANTE_QA_AUTORIZA_PROYECCION=1 cuando el dueño lo autorice.";

export const SIN_SESION =
  "Define QAVANTE_SESSION (tu cookie qavante_session) para correr el QA contra producción.";

/** Header con el que la app declara la sociedad activa (src/lib/company/active-company.ts). */
export const COMPANY_HEADER = "X-Qavante-Company-Id";

/** Llave de localStorage donde la app guarda la sociedad activa. */
export const ACTIVE_COMPANY_STORAGE_KEY = "qavante.active-company-id";
