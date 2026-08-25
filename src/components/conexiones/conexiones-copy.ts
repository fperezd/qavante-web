import { isSourceCaida, type SourceStatus } from "@/lib/api/sources-status";

/* Traducción del contrato técnico de `GET /api/sources/status` a lenguaje humano (V11).

   Dos reglas que este módulo NO puede romper:

   1. **Se ramifica por `state`**, con los SEIS valores de `SourceState` explícitos
      (`ok | syncing | stale | missing | error | unavailable`). El `reason` es PROSA libre que
      escribe el backend (`connection_status.last_check_message`, en español) y cambia sin aviso:
      sirve para afinar el mensaje DENTRO de `error`, nunca para decidir el estado. Antes el
      mapeo era por regex en inglés (`invalid credentials`, `session expired`) contra mensajes
      que la API emite en español ("RUT inválido o con DV incorrecto.") → no matcheaba ninguno
      y todo caía al texto genérico.
   2. **Un estado que no sabemos leer no se disfraza de estado plausible**: cae en el bucket
      "no se sabe" y no inventa una acción. El `default` recibe `never` para que agregar un
      séptimo `SourceState` al contrato rompa el build en vez de aterrizar callado en un bucket.

   Qué puede resolver el dueño y qué no (`requiresOwnerAction`, lo que cuenta el banner
   "N requieren tu acción"):
   - `stale` sale de `expired`/`degraded` en DB, y `degraded` es un fallo UPSTREAM transitorio
     (429/503/timeout del SII) documentado en `sources_service._DB_STATE_MAP`: la fuente no está
     rota, solo no pudo refrescar. Pedirle una acción al dueño por eso es mentirle.
   - `unavailable` SIN `last_sync` son los stubs de Fase 1 (`sii_f22`, `direccion_trabajo`): no
     hay literalmente nada que hacer. CON `last_sync` es una caída real (`isSourceCaida`, fix de
     la auditoría UX F-03) — tampoco la arregla el dueño apretando un botón.
   Solo `missing` (nunca la conectó) y `error` (la conexión falló de verdad) piden acción. */

export type ConnectionTone = "ok" | "syncing" | "info" | "action" | "missing" | "unknown";

export interface ConnectionCopy {
  tone: ConnectionTone;
  /** Etiqueta del badge de estado. La vista DEBE pintar esta, no una derivada del tono:
   *  si no, `syncing` y `stale` terminan mostrando "Al día ✓" y la pantalla miente. */
  statusLabel: string;
  message: string;
  /** Texto del enlace de acción, o `null` cuando no hay ninguna acción posible. */
  cta: string | null;
  /** Destino del enlace de acción, o `null`. Sin `cta` no se renderiza enlace. */
  href: string | null;
  /** ¿Cuenta para "N requieren tu acción"? Solo si el dueño puede resolverlo él. */
  requiresOwnerAction: boolean;
}

const CREDENCIALES_HREF = "/administracion/credenciales";

/* ── Clasificación DENTRO de `state: "error"` ────────────────────────────────────────────
   Orden deliberado: **primero lo estructurado, la prosa al final**. El backend ya clasificó
   casi todos estos fallos y expone su veredicto en un prefijo estable; adivinar por texto
   libre cuando existe un código es tirar información a la basura (y fue lo que dejó
   `cert_missing`, `mfa_required`, `no_session` y `buk_permanent_error` cayendo en "no
   sabemos por qué" pese a que la API los marca `credential_invalid`).

   1. `upstream: <code>: <msg>` — lo escriben `api/sii.py`, `api/bice.py`, `api/buk.py`,
      `api/tgr.py` y `core/buk_payroll.py`. `<code>` es contrato; el `<msg>` que sigue no.
   2. `<NombreDeExcepcion>: <str(e)>` — lo escribe `_canonical.py` con
      `f"{type(e).__name__}: {e}"`. La CLASE es la señal; el mensaje es prosa de Python.
   3. Prosa, sólo para `credential_validators.py` y el consent, que no llevan prefijo, y con
      patrones que exigen la FRASE del validator ("RUT inválido…", "api_token debe tener…"),
      no una palabra suelta. La versión anterior buscaba tokens sueltos (`\brut\b`, `usuario`,
      `clave`) en cualquier parte del mensaje, y por eso `KeyError: 'rut'` y `ValueError: no
      se encontró el usuario…` —bugs nuestros, no la credencial del dueño— salían como
      "Renovar credencial", mandándolo a re-tipear una clave sana. Hoy eso lo ataja el paso 2
      (son excepciones) y el paso 3 no vuelve a abrir la puerta porque pide la frase entera.

   Regla transversal de los tres pasos: **la señal vale sólo en su posición documentada**. Por
   eso los tres patrones van anclados con `^`. Un "upstream: auth_error:" o un "BiceAuthError:"
   embebidos a mitad de un mensaje más largo no son el prefijo estructurado del backend: son
   texto que habla de otra cosa, y tratarlos como veredicto es volver a adivinar.
   Lo que no encaja en ninguna señal cae a `FALLA_DESCONOCIDA`, que dice que no sabemos. */

interface FallaConocida {
  message: string;
  cta: string | null;
}

const RENOVAR_CREDENCIAL: FallaConocida = {
  message:
    "La credencial guardada no está sirviendo: quedó incompleta o el servicio la rechazó. Vuelve a ingresarla para retomar la lectura.",
  cta: "Renovar credencial",
};

const AUTORIZAR: FallaConocida = {
  message: "Falta que autorices esta conexión para que Qavante pueda leer sus datos.",
  cta: "Autorizar",
};

/** MFA: la acción existe y es del dueño, pero ocurre FUERA de Qavante (la app del banco).
 *  Mandarlo a "Renovar credencial" sería mandarlo a cambiar una clave que está bien. */
const APROBAR_MFA: FallaConocida = {
  message:
    "El banco está pidiendo que apruebes el acceso desde su aplicación. No tienes que cambiar ninguna clave: apruébalo y la próxima sincronización entra sola.",
  cta: null,
};

const FALLA_DESCONOCIDA: FallaConocida = {
  message:
    "El último intento de leer esta fuente falló y no sabemos por qué. Revisa la conexión; el detalle técnico está en esta misma fila.",
  cta: "Revisar conexión",
};

const UPSTREAM_CODE_RE = /^upstream:\s*([a-z0-9_]+)\s*:/i;
const EXCEPCION_RE = /^([A-Za-z0-9_]*Error)\s*:/;

/** Códigos que el backend mismo mapea a `connection_status = 'credential_invalid'`:
 *  `_SII_AUTH_CODES` (api/sii.py) y el `is_auth` de `api/bice.py`, `api/buk.py` y `api/tgr.py`. */
const CODIGOS_CREDENCIAL = new Set([
  "auth_error",
  "unauthorized",
  "cert_missing",
  "session_expired",
  "no_session",
  "buk_permanent_error",
]);
const CODIGOS_MFA = new Set(["mfa_required"]);

/* No hay `CODIGOS_CONSENT`: el consent NUNCA viaja como código upstream. `_canonical.py` lo
   escribe como prosa ("Consent missing para sii_rcv.") y lo agarra `PROSA_CONSENT`. El set
   `{consent_missing, consent_expired}` que había acá era una entrada especulativa: reconocía
   algo que nadie emite, no tenía forma de fallar, y borrarlo entero dejaba la suite en verde.
   Un patrón que no puede ejecutarse es deuda disfrazada de robustez. */

/** Excepciones de credencial/sesión de los conectores, reconocidas por la ESTRUCTURA del
 *  nombre de clase (`BiceAuthError`, `ClaveTributariaAuthError`, `F29SessionExpiredError`,
 *  `BukPermanentError`), no por su mensaje. Un `KeyError`/`ValueError` no entra acá.
 *
 *  Sin `Unauthorized`: no existe ninguna clase `*UnauthorizedError` en `qavante-api` (el 401
 *  llega como el CÓDIGO `unauthorized`, que ya cubre `CODIGOS_CREDENCIAL`). Era la otra
 *  entrada especulativa. */
function esExcepcionDeCredencial(clase: string): boolean {
  // Sin `$` final: `EXCEPCION_RE` ya captura hasta el "Error" del nombre, así que anclar el
  // fin era redundante — no había forma de que cambiara un resultado, y borrarlo dejaba la
  // suite en verde. Un ancla que no puede fallar no es una protección, es ruido.
  return /(?:Auth|SessionExpired|Permanent)\w*Error/.test(clase);
}

/* Mensajes de `credential_validators.py`. Dos cosas hacen el trabajo, y las dos tienen su
   mutante muerto: exigir la FRASE del validator (no una palabra suelta como `\brut\b`, que
   clasificaba `KeyError: 'rut'` como credencial) y el `^`, que hace que la frase valga sólo
   cuando el mensaje EMPIEZA con ella — embebida en prosa ajena habla de otra cosa. */
const PROSA_CREDENCIAL: ReadonlyArray<RegExp> = [
  /^RUT inv[áa]lido/i,
  /^(clave|password) debe tener/i,
  /^username vac[íi]o/i,
  /^api_token /i,
  /^bearer token /i,
  /^cookies ausentes/i,
];
const PROSA_CONSENT = /^consent (missing|expired)\b/i;

function clasificarError(reason: string | null | undefined): FallaConocida {
  const raw = (reason ?? "").trim();
  if (!raw) return FALLA_DESCONOCIDA;

  const upstream = UPSTREAM_CODE_RE.exec(raw);
  if (upstream) {
    const code = upstream[1]!.toLowerCase();
    if (CODIGOS_MFA.has(code)) return APROBAR_MFA;
    if (CODIGOS_CREDENCIAL.has(code)) return RENOVAR_CREDENCIAL;
    // Código que no conocemos: se dice que no se sabe. No se adivina por el mensaje.
    return FALLA_DESCONOCIDA;
  }

  const excepcion = EXCEPCION_RE.exec(raw);
  if (excepcion) {
    const clase = excepcion[1]!;
    if (/Mfa\w*Required\w*Error/i.test(clase)) return APROBAR_MFA;
    if (esExcepcionDeCredencial(clase)) return RENOVAR_CREDENCIAL;
    // `KeyError`, `ValueError`, `TypeError`…: es un bug nuestro, no su credencial.
    return FALLA_DESCONOCIDA;
  }

  if (PROSA_CONSENT.test(raw)) return AUTORIZAR;
  if (PROSA_CREDENCIAL.some((re) => re.test(raw))) return RENOVAR_CREDENCIAL;
  return FALLA_DESCONOCIDA;
}

/** Bucket explícito de "no se sabe": sólo se alcanza si la API agrega un `SourceState` nuevo.
 *  El parámetro `never` hace que ese día el build falle acá en vez de mentir en pantalla. */
function estadoDesconocido(state: never): ConnectionCopy {
  return {
    tone: "unknown",
    statusLabel: "No se sabe",
    message: `Recibimos un estado que no reconocemos ("${String(state)}"). No podemos decirte si esta fuente está al día ni qué hacer.`,
    cta: null,
    href: null,
    requiresOwnerAction: false,
  };
}

export function sourceToConnectionCopy(source: SourceStatus): ConnectionCopy {
  switch (source.state) {
    case "ok":
      return {
        tone: "ok",
        statusLabel: "Al día",
        message: "Sin problemas: los datos de esta fuente están llegando.",
        cta: null,
        href: null,
        requiresOwnerAction: false,
      };

    case "syncing":
      return {
        tone: "syncing",
        statusLabel: "Sincronizando",
        message: "Estamos actualizando esta fuente ahora.",
        cta: null,
        href: null,
        requiresOwnerAction: false,
      };

    case "stale":
      return {
        tone: "info",
        statusLabel: "Datos atrasados",
        message:
          "La última actualización no se completó, así que puedes estar viendo datos anteriores. Se reintenta solo: no es algo que tengas que resolver tú.",
        cta: null,
        href: null,
        requiresOwnerAction: false,
      };

    /* `missing` NO es sólo "nunca la conectó". `_DB_STATE_MAP` mapea `revoked → missing`, y
       `admin_repo.upsert_connection_status` no toca `last_success_at` al revocar (así revoca
       `api/admin/credentials.py`, incluida la cascada sobre las fuentes que reusan esa
       credencial). O sea: un `missing` CON `last_sync` estuvo conectado y trajo datos.
       Decirle "aún no conectas esta fuente" al lado de un detalle técnico que dice
       "Credencial revocada por admin." es la misma contradicción en pantalla que este PR
       vino a eliminar, sólo que del otro lado del dato. */
    case "missing":
      return source.last_sync
        ? {
            tone: "missing",
            statusLabel: "Desconectada",
            message:
              "Esta fuente estuvo conectada, pero hoy no tiene una credencial activa: se revocó o se quitó. Vuelve a conectarla para retomar la lectura.",
            cta: "Volver a conectar",
            href: CREDENCIALES_HREF,
            requiresOwnerAction: true,
          }
        : {
            tone: "missing",
            statusLabel: "Sin conectar",
            message: "Aún no conectas esta fuente, así que no estamos leyendo nada de ella.",
            cta: "Conectar",
            href: CREDENCIALES_HREF,
            requiresOwnerAction: true,
          };

    case "error": {
      const falla = clasificarError(source.reason);
      return {
        tone: "action",
        statusLabel: "Requiere tu acción",
        message: falla.message,
        cta: falla.cta,
        // Sin CTA no hay adónde mandarlo: la acción del MFA ocurre en la app del banco.
        href: falla.cta ? CREDENCIALES_HREF : null,
        requiresOwnerAction: true,
      };
    }

    case "unavailable":
      return isSourceCaida(source)
        ? {
            tone: "info",
            statusLabel: "No responde",
            message:
              "El servicio dejó de responder. Todavía no sabemos si se recupera solo o si habrá que reconectarlo; seguimos reintentando.",
            cta: null,
            href: null,
            requiresOwnerAction: false,
          }
        : {
            tone: "info",
            statusLabel: "Aún no disponible",
            message:
              "Qavante todavía no integra esta fuente. No hay nada que puedas hacer por ahora.",
            cta: null,
            href: null,
            requiresOwnerAction: false,
          };

    default:
      return estadoDesconocido(source.state);
  }
}

/* Línea de contexto temporal de la fila. `last_sync` es el timestamp del ÚLTIMO SYNC EXITOSO
   (`sources_service._to_iso(row["last_success_at"])`). Por eso nunca se puede decir "desde el X
   no llegan documentos" con esa fecha: X es justo el día en que SÍ llegaron. Se dice lo que el
   dato significa ("lo último que llegó es del X") y se condiciona al `state`.

   CAVEAT PENDIENTE (es del backend, no se arregla acá — anotado en el PR #35): la validación de
   FORMATO de una credencial también escribe `last_success_at` (`api/admin/credentials.py` hace
   `upsert_connection_status(status="ready", success=True)` tras un check que no hace red). O sea
   que ese timestamp puede estar fechando una validación que no trajo ni un documento, y "lo
   último que llegó es del X" afirma un poco más de lo que el dato garantiza. Para separarlos
   hace falta que la API distinga "último sync CON DATOS" de "última vez que la credencial se
   dio por buena"; mientras tanto queda declarado en vez de disimulado. */
export function sourceToImpactLine(source: SourceStatus): string {
  const cuando = source.last_sync ? formatImpactDate(source.last_sync) : null;

  switch (source.state) {
    case "ok":
      return cuando ? `Última carga: ${cuando}.` : "Sin registro de la última carga.";

    case "syncing":
      return cuando
        ? `Actualizando ahora. Última carga completa: ${cuando}.`
        : "Actualizando ahora; todavía no hay una carga completa.";

    case "stale":
    case "error":
      return cuando
        ? `Lo último que llegó es del ${cuando}.`
        : "Todavía no ha llegado ningún dato de esta fuente.";

    // `missing` con `last_sync` = revocada / desconectada, no "nunca". Ver el case "missing"
    // de `sourceToConnectionCopy`.
    case "missing":
      return cuando
        ? `Estuvo conectada: lo último que llegó es del ${cuando}.`
        : "Nunca se ha conectado.";

    case "unavailable":
      return cuando
        ? `Lo último que llegó es del ${cuando}.`
        : "Nunca ha traído datos: no está integrada todavía.";

    default:
      return "No sabemos cuándo llegaron datos por última vez.";
  }
}

export function formatImpactDate(iso: string | null | undefined): string {
  if (!iso) return "fecha no disponible";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "fecha no disponible";
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "short",
    timeZone: "America/Santiago",
  }).format(d);
}
