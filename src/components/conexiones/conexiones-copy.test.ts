import { describe, expect, it } from "vitest";
import type { SourceStatus } from "@/lib/api/sources-status";
import { formatImpactDate, sourceToConnectionCopy, sourceToImpactLine } from "./conexiones-copy";

/* Los `reason` de estos tests son los strings que el backend REALMENTE escribe (grep en
   `qavante-api`: `credential_validators.py`, `_canonical.py`, `sources_service.py`,
   `api/sii.py::_report_or_fail`). El test anterior inventaba `reason: "invalid_credentials"`,
   que es un valor de `connection_status.status` en la DB y NUNCA viaja en el campo `reason`:
   validaba una entrada que la API no produce, así que el mapeo podía estar roto y seguir verde. */

const src = (over: Partial<SourceStatus>): SourceStatus => ({
  source: "sii_rcv",
  display_name: "SII",
  state: "ok",
  last_sync: null,
  reason: null,
  ...over,
});

describe("sourceToConnectionCopy · los seis SourceState del contrato", () => {
  it("ok: al día y sin acción", () => {
    const copy = sourceToConnectionCopy(src({ state: "ok", last_sync: "2026-06-27T12:30:00Z" }));
    expect(copy.tone).toBe("ok");
    expect(copy.statusLabel).toBe("Al día");
    expect(copy.requiresOwnerAction).toBe(false);
  });

  it("syncing: se rotula Sincronizando, no 'Al día'", () => {
    const copy = sourceToConnectionCopy(src({ state: "syncing", reason: "Sincronizando…" }));
    expect(copy.statusLabel).toBe("Sincronizando");
    expect(copy.tone).toBe("syncing");
    expect(copy.requiresOwnerAction).toBe(false);
  });

  it("stale (degraded = upstream transitorio) NO le pide acción al dueño", () => {
    // `_report_or_fail` escribe `degraded` con este formato ante un 429/503/timeout del SII;
    // `_DB_STATE_MAP` lo mapea a `stale`. El dueño no puede hacer nada con eso.
    const copy = sourceToConnectionCopy(
      src({
        state: "stale",
        reason: "upstream: sii_rate_limited: 429 Too Many Requests",
        last_sync: "2026-06-20T09:00:00Z",
      }),
    );
    expect(copy.requiresOwnerAction).toBe(false);
    expect(copy.tone).toBe("info");
    expect(copy.statusLabel).not.toBe("Requiere tu acción");
    expect(copy.cta).toBeNull();
  });

  it("stale con el reason por defecto del service tampoco pide acción", () => {
    // `sources_service._row_to_response`: state stale sin `last_check_message` → "Conexión expirada".
    const copy = sourceToConnectionCopy(src({ state: "stale", reason: "Conexión expirada" }));
    expect(copy.requiresOwnerAction).toBe(false);
    expect(copy.cta).toBeNull();
    // Se afirma el bucket, no sólo la ausencia de CTA: "sin acción" también lo cumple el bucket
    // "no se sabe", y `stale` SÍ lo sabemos — hay que decir que los datos están atrasados.
    expect(copy.tone).toBe("info");
    expect(copy.statusLabel).toBe("Datos atrasados");
  });

  it("missing sin last_sync: nunca se conectó", () => {
    const copy = sourceToConnectionCopy(
      src({ source: "bice", display_name: "Banco", state: "missing", reason: "No conectada." }),
    );
    expect(copy.statusLabel).toBe("Sin conectar");
    expect(copy.tone).toBe("missing");
    expect(copy.cta).toBe("Conectar");
    expect(copy.requiresOwnerAction).toBe(true);
  });

  it("missing CON last_sync (credencial revocada) no dice que nunca se conectó", () => {
    // `_DB_STATE_MAP` mapea `revoked → missing` y la revocación conserva `last_success_at`.
    const revocada = src({
      source: "sii_cesiones",
      display_name: "SII Cesiones",
      state: "missing",
      last_sync: "2026-08-01T10:00:00Z",
      reason: "Credencial revocada por admin.",
    });
    const copy = sourceToConnectionCopy(revocada);
    expect(copy.statusLabel).toBe("Desconectada");
    expect(copy.cta).toBe("Volver a conectar");
    expect(copy.message).not.toMatch(/aún no conectas/i);
    expect(sourceToImpactLine(revocada)).not.toMatch(/nunca se ha conectado/i);
    expect(sourceToImpactLine(revocada)).toMatch(/estuvo conectada/i);
  });

  it("error: pide acción", () => {
    const copy = sourceToConnectionCopy(
      src({ state: "error", reason: "Último check falló (failure_count=3)" }),
    );
    expect(copy.tone).toBe("action");
    expect(copy.requiresOwnerAction).toBe(true);
    expect(copy.href).toBe("/administracion/credenciales");
  });

  it("unavailable stub de Fase 1 (sin last_sync): informativo, sin acción posible", () => {
    // `_PHASE1_STUBS`: sii_f22 / direccion_trabajo salen con last_sync=None por diseño.
    const copy = sourceToConnectionCopy(
      src({
        source: "sii_f22",
        display_name: "SII F22",
        state: "unavailable",
        reason: "F22 no implementado en Fase 1",
        last_sync: null,
      }),
    );
    expect(copy.requiresOwnerAction).toBe(false);
    expect(copy.cta).toBeNull();
    expect(copy.statusLabel).toBe("Aún no disponible");
  });

  it("unavailable con last_sync (caída real) se distingue del stub y sigue sin culpar al dueño", () => {
    const copy = sourceToConnectionCopy(
      src({
        source: "bice",
        display_name: "Banco BICE",
        state: "unavailable",
        reason: "bice_session_unavailable",
        last_sync: "2026-06-27T13:05:00Z",
      }),
    );
    expect(copy.statusLabel).toBe("No responde");
    expect(copy.requiresOwnerAction).toBe(false);
  });

  it("un estado fuera del contrato cae en estado no disponible, no en una acción inventada", () => {
    // Simula que la API agrega un SourceState nuevo: la UI no debe inventar qué hacer.
    const copy = sourceToConnectionCopy(
      src({ state: "quarantined" as unknown as SourceStatus["state"], reason: "lo que sea" }),
    );
    expect(copy.tone).toBe("unknown");
    expect(copy.statusLabel).toBe("Estado no disponible");
    expect(copy.requiresOwnerAction).toBe(false);
    expect(copy.cta).toBeNull();
    expect(copy.message).toMatch(/no podemos confirmar si esta fuente está actualizada/i);
  });
});

/* Un caso por ALTERNATIVA reconocida. La versión anterior agrupaba varias alternativas en un
   solo `it` y dejaba mutantes vivos: se podían borrar `credencial|credential`, `unauthorized`,
   `session_expired` y `auth_?error` de la regex con los 21 tests en verde, porque los strings
   de prueba matcheaban por OTRO token de la misma alternancia (p. ej. "BiceAuthError: sesión
   expirada" entraba por "sesión expirada", nunca por `auth_error`). Table-driven con un string
   real del backend por fila: si una alternativa deja de existir, se cae SU fila. */
describe("sourceToConnectionCopy · clasificación de `error` por señal estructurada", () => {
  const CASOS: ReadonlyArray<{ que: string; reason: string; cta: string | null }> = [
    // ── 1. Prefijo `upstream: <code>:` — el código es contrato (api/sii.py, bice, buk, tgr).
    {
      que: "upstream cert_missing (certificado del SII; _SII_AUTH_CODES)",
      reason: "upstream: cert_missing: Tenant sin certificado activo",
      cta: "Renovar credencial",
    },
    {
      que: "upstream auth_error",
      reason: "upstream: auth_error: credenciales rechazadas por el portal",
      cta: "Renovar credencial",
    },
    {
      que: "upstream unauthorized",
      reason: "upstream: unauthorized: 401",
      cta: "Renovar credencial",
    },
    {
      que: "upstream session_expired (BICE)",
      reason: "upstream: session_expired: la sesión del banco caducó",
      cta: "Renovar credencial",
    },
    {
      que: "upstream no_session (TGR)",
      reason: "upstream: no_session: no hay sesión TGR cacheada",
      cta: "Renovar credencial",
    },
    {
      que: "upstream buk_permanent_error",
      reason: "upstream: buk_permanent_error: 403",
      cta: "Renovar credencial",
    },
    {
      que: "upstream mfa_required: la acción es del dueño pero fuera de Qavante",
      reason: "upstream: mfa_required: aprueba en la app",
      cta: null,
    },
    {
      que: "upstream con código desconocido: no se adivina por el mensaje",
      reason: "upstream: sii_rate_limited: 429 Too Many Requests",
      cta: "Revisar conexión",
    },

    // ── 2. Nombre de excepción (`_canonical.py` guarda `f"{type(e).__name__}: {e}"`).
    {
      que: "BiceAuthError",
      reason: "BiceAuthError: no se pudo iniciar sesión",
      cta: "Renovar credencial",
    },
    {
      que: "BiceAuthError por estrategia local no acusa a la credencial",
      reason:
        "BiceAuthError: Sesión BICE no disponible y BICE_LOGIN_STRATEGY=local_only; login deshabilitado",
      cta: "Revisar conexión",
    },
    {
      que: "session_expired originado en configuración local no acusa a la credencial",
      reason:
        "upstream: session_expired: Sesión BICE sin storage_state; BICE_LOGIN_STRATEGY=local_only",
      cta: "Revisar conexión",
    },
    {
      que: "F29SessionExpiredError",
      reason: "F29SessionExpiredError: la sesión del SII caducó",
      cta: "Renovar credencial",
    },
    {
      que: "BukPermanentError",
      reason: "BukPermanentError: 403 Forbidden",
      cta: "Renovar credencial",
    },
    {
      que: "BiceMfaRequiredError",
      reason: "BiceMfaRequiredError: aprueba el acceso en la app",
      cta: null,
    },
    {
      // M3: `except Exception` genérico → builtins de Python llegan tal cual. Mandar a
      // renovar una credencial SANA por un bug nuestro es peor que el mensaje genérico.
      que: "KeyError con 'rut' adentro NO es un problema de credencial",
      reason: "KeyError: 'rut'",
      cta: "Revisar conexión",
    },
    {
      que: "ValueError con 'usuario' adentro NO es un problema de credencial",
      reason: "ValueError: no se encontró el usuario en la respuesta",
      cta: "Revisar conexión",
    },

    // ── 3. Prosa, sólo para lo que el backend emite SIN prefijo (validators + consent).
    {
      que: "RUT rechazado por el validator (el caso más común)",
      reason: "RUT inválido o con DV incorrecto.",
      cta: "Renovar credencial",
    },
    {
      que: "clave demasiado corta",
      reason: "Clave debe tener al menos 4 caracteres.",
      cta: "Renovar credencial",
    },
    {
      que: "password demasiado corta",
      reason: "Password debe tener al menos 4 caracteres.",
      cta: "Renovar credencial",
    },
    { que: "username vacío", reason: "username vacío.", cta: "Renovar credencial" },
    {
      que: "api_token de BUK malo",
      reason: "api_token debe tener al menos 20 caracteres (BUK tokens son ~64).",
      cta: "Renovar credencial",
    },
    {
      que: "bearer de Santander ausente",
      reason: "bearer token ausente o demasiado corto (se espera el token eob).",
      cta: "Renovar credencial",
    },
    {
      que: "cookies de Santander ausentes",
      reason: "cookies ausentes (se requieren las cookies de sesión eob/Incapsula).",
      cta: "Renovar credencial",
    },
    {
      que: "consent faltante",
      reason: "Consent missing para sii_rcv.",
      cta: "Autorizar",
    },
    {
      que: "consent expirado",
      reason: "Consent expired para sii_rcv.",
      cta: "Autorizar",
    },

    // ── 4. Lo que no encaja en ninguna señal.
    {
      que: "fallo genérico del cron",
      reason: "Último check falló (failure_count=3)",
      cta: "Revisar conexión",
    },
    { que: "reason vacío", reason: "", cta: "Revisar conexión" },
    {
      /* Soft-fail con texto libre (`ctx.fail()` lo lleva) que menciona "rut"/"usuario"
         hablando del DOCUMENTO, no de la credencial guardada. Es lo que la regex vieja
         clasificaba mal por buscar tokens sueltos; los patrones de hoy piden la frase
         entera del validator, así que esto queda genérico. */
      que: "prosa libre que menciona el rut de un documento no es problema de credencial",
      reason: "No se pudo determinar el rut del receptor en el documento 12345",
      cta: "Revisar conexión",
    },
    {
      que: "prosa libre que menciona al usuario de un tercero tampoco",
      reason: "El período quedó sin usuario responsable asignado",
      cta: "Revisar conexión",
    },

    /* ── 5. La señal vale sólo en su POSICIÓN documentada (los `^` de los tres pasos).
       Un prefijo del backend embebido a mitad de otro mensaje no es un veredicto: es texto
       que habla de otra cosa. Sin estas filas, quitarle el `^` a cualquiera de los patrones
       dejaba la suite en verde. */
    {
      que: "un 'upstream: auth_error:' embebido en una excepción no es el prefijo del backend",
      reason: "RuntimeError: falló al hablar con upstream: auth_error: 401",
      cta: "Revisar conexión",
    },
    {
      que: "un nombre de excepción a mitad de frase no es la señal de _canonical",
      reason: "Reintentos agotados tras BiceAuthError: 401",
      cta: "Revisar conexión",
    },
    {
      que: "la frase del validator embebida en prosa ajena habla del proveedor, no de tu credencial",
      reason: "No se pudo guardar: cookies ausentes en la respuesta del proveedor",
      cta: "Revisar conexión",
    },
    {
      que: "'consent missing' dentro de una línea de log no es el mensaje canónico de consent",
      reason: "Se registró consent missing en el log de auditoría",
      cta: "Revisar conexión",
    },

    /* ── 6. `.trim()`. Ojo: un reason de PUROS espacios no sirve para cubrirlo (con y sin
       trim termina en el genérico igual). Lo que sí lo distingue es un prefijo válido con
       espacio delante —artefacto plausible de una columna de texto—: sin `.trim()` el `^`
       no matchea y una credencial rechazada se degrada a "no sabemos por qué". */
    {
      que: "prefijo válido con espacios alrededor sigue clasificando",
      reason: "  upstream: auth_error: 401  ",
      cta: "Renovar credencial",
    },
  ];

  for (const caso of CASOS) {
    it(`${caso.que} → ${caso.cta ?? "sin CTA (fuera de Qavante)"}`, () => {
      const copy = sourceToConnectionCopy(src({ state: "error", reason: caso.reason }));
      expect(copy.cta).toBe(caso.cta);
      // El estado nunca deja de pedir atención, tenga o no un enlace adonde ir.
      expect(copy.requiresOwnerAction).toBe(true);
    });
  }

  it("el MFA no ofrece enlace a credenciales: no hay que cambiar ninguna clave", () => {
    const copy = sourceToConnectionCopy(
      src({ state: "error", reason: "upstream: mfa_required: aprueba en la app" }),
    );
    expect(copy.href).toBeNull();
    expect(copy.message).toMatch(/no tienes que cambiar ninguna clave/i);
  });

  it("el fallo genérico deriva la revisión a soporte sin inventar la causa", () => {
    const copy = sourceToConnectionCopy(
      src({ state: "error", reason: "Último check falló (failure_count=3)" }),
    );
    expect(copy.message).toMatch(/requiere revisión de soporte/i);
  });
});

describe("sourceToImpactLine", () => {
  it("no afirma 'no llegan documentos' con la fecha del último sync EXITOSO", () => {
    const linea = sourceToImpactLine(src({ state: "ok", last_sync: "2026-06-27T12:30:00Z" }));
    expect(linea).not.toMatch(/no llegan/i);
    expect(linea).toMatch(/última carga/i);
    expect(linea).toMatch(/27 .*jun/i);
  });

  it("con problema, la fecha se presenta como lo último que SÍ llegó", () => {
    const linea = sourceToImpactLine(
      src({ state: "error", last_sync: "2026-06-27T12:30:00Z", reason: "x" }),
    );
    expect(linea).toMatch(/lo último que llegó es del 27 .*jun/i);
  });

  it("missing no muestra fechas: nunca se conectó", () => {
    expect(sourceToImpactLine(src({ state: "missing" }))).toBe("Nunca se ha conectado.");
  });

  it("stub de Fase 1 dice que nunca trajo datos", () => {
    expect(sourceToImpactLine(src({ state: "unavailable", last_sync: null }))).toMatch(
      /nunca ha traído datos/i,
    );
  });
});

describe("formatImpactDate", () => {
  it("formatea en estilo corto chileno", () => {
    expect(formatImpactDate("2026-08-22T15:00:00Z")).toMatch(/22 .*ago/i);
  });

  it("sin fecha no inventa una", () => {
    expect(formatImpactDate(null)).toBe("fecha no disponible");
  });
});
