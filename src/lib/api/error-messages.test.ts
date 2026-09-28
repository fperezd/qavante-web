/* Anti-regresión del mapping ApiError → mensaje usuario (Anexo C.3).
   Estos copys los ven todos los usuarios PYME chilenos cuando algo
   falla; cambios accidentales en el mapeo se notan inmediatamente. */

import { describe, expect, it } from "vitest";
import { apiErrorToUserMessage, unknownErrorToUserMessage } from "./error-messages";
import { ApiError } from "./errors";

describe("apiErrorToUserMessage — mapping de Anexo C.3", () => {
  it("network error (status 0) no atribuye la causa a internet del usuario", () => {
    const err = new ApiError("network", 0, "network_error");
    expect(apiErrorToUserMessage(err)).toBe(
      "No pudimos comunicarnos con Qavante. Intenta nuevamente.",
    );
  });

  it("401 en context login → copy específico 'RUT o clave incorrectos'", () => {
    const err = new ApiError("unauthorized", 401);
    expect(apiErrorToUserMessage(err, "login")).toBe(
      "RUT o clave incorrectos. Verifica tus datos.",
    );
  });

  it("401 en context login-correo → copy específico 'Correo o clave incorrectos'", () => {
    const err = new ApiError("unauthorized", 401);
    expect(apiErrorToUserMessage(err, "login-correo")).toBe(
      "Correo o clave incorrectos. Verifica tus datos.",
    );
  });

  it("OAuth y RUT usan el mensaje del servidor, o un respaldo si viene vacío", () => {
    expect(apiErrorToUserMessage(new ApiError("", 404, "oauth_user_not_found"))).toBe(
      "No hay una cuenta Qavante con ese correo. Registrate primero.",
    );
    expect(apiErrorToUserMessage(new ApiError("correo propio", 404, "oauth_user_not_found"))).toBe(
      "correo propio",
    );
    expect(apiErrorToUserMessage(new ApiError("", 401, "oauth_pending_verification"))).toContain(
      "confirmó el correo",
    );
    expect(apiErrorToUserMessage(new ApiError("", 400, "oauth_state_mismatch"))).toContain(
      "Google o Microsoft",
    );
    expect(
      apiErrorToUserMessage(new ApiError("falló el canje", 400, "oauth_exchange_failed")),
    ).toBe("falló el canje");
    expect(apiErrorToUserMessage(new ApiError("x", 503, "oauth_not_configured"))).toBe(
      "Login con Google o Microsoft no está disponible en este ambiente.",
    );
    expect(apiErrorToUserMessage(new ApiError("", 409, "rut_taken"))).toBe(
      "Ese RUT ya está en otra cuenta.",
    );
    expect(apiErrorToUserMessage(new ApiError("RUT ocupado", 409, "rut_taken"))).toBe(
      "RUT ocupado",
    );
    expect(apiErrorToUserMessage(new ApiError("", 409, "rut_already_set"))).toBe(
      "Esta cuenta ya tiene un RUT.",
    );
    expect(apiErrorToUserMessage(new ApiError("ya tiene", 409, "rut_already_set"))).toBe(
      "ya tiene",
    );
  });

  it("login-correo con un status distinto de 401 no usa el copy de correo", () => {
    expect(apiErrorToUserMessage(new ApiError("forbidden", 403), "login-correo")).toBe(
      "No tienes permisos para realizar esta acción.",
    );
  });

  it("oauth_pending_verification no usa el copy de RUT/clave", () => {
    const err = new ApiError(
      "Esa cuenta existe pero todavía no confirmó el correo.",
      401,
      "oauth_pending_verification",
    );
    expect(apiErrorToUserMessage(err, "login")).toContain("confirmó el correo");
  });

  it("401 en context general → 'sesión expiró'", () => {
    const err = new ApiError("unauthorized", 401);
    expect(apiErrorToUserMessage(err)).toBe("Tu sesión expiró. Vuelve a iniciar sesión.");
  });

  it("captcha_failed (403) → mensaje de captcha, NO 'no tienes permisos'", () => {
    const err = new ApiError("Verificación de captcha fallida.", 403, "captcha_failed");
    expect(apiErrorToUserMessage(err)).toBe(
      "No pudimos verificar el captcha. Recárgalo e intenta de nuevo.",
    );
  });

  it("403 con detalle del backend no expone el texto recibido", () => {
    expect(apiErrorToUserMessage(new ApiError("El SII rechazó la consulta.", 403))).toBe(
      "No tienes permisos para realizar esta acción.",
    );
  });

  it("detalle con jerga de dev (seed-cert / SII_CERT_PATH) → mensaje limpio, NO el crudo", () => {
    const raw =
      "Credenciales SII inválidas o sin autorización para el RUT de la empresa. Cert .pfx no disponible. Subilo via POST /api/sii/seed-cert (body: {cert_b64, password}) o seteá SII_CERT_PATH en el entorno.";
    const out = apiErrorToUserMessage(new ApiError(raw, 400));
    /* La frontera sólo renderiza `message_code` enumerados: un detalle libre del backend —
       incluso uno reconocible como el del SII — cae al genérico en vez de inspeccionarse. */
    expect(out).toBe("Ocurrió un error inesperado. Intenta nuevamente.");
    expect(out).not.toContain("seed-cert");
    expect(out).not.toContain("SII_CERT_PATH");
  });

  it("403 sin detalle útil → genérico 'no tienes permisos'", () => {
    expect(apiErrorToUserMessage(new ApiError("Error 403", 403))).toBe(
      "No tienes permisos para realizar esta acción.",
    );
  });

  it("404 → 'no encontramos'", () => {
    expect(apiErrorToUserMessage(new ApiError("not found", 404))).toBe(
      "No encontramos la información que buscas.",
    );
  });

  it("408 timeout → 'operación demorando'", () => {
    expect(apiErrorToUserMessage(new ApiError("timeout", 408))).toBe(
      "La operación está demorando más de lo esperado.",
    );
  });

  it("signup_conflict (409) → cuenta ya existe", () => {
    const err = new ApiError("conflict", 409, "signup_conflict");
    expect(apiErrorToUserMessage(err)).toContain("ya existe");
  });

  it("self_delete_forbidden (403) → no se puede borrar", () => {
    const err = new ApiError("forbidden", 403, "self_delete_forbidden");
    expect(apiErrorToUserMessage(err)).toContain("no se puede borrar");
  });

  it("fintoc_attribution_unverified orienta a declarar el RUT sin exponer el detalle técnico", () => {
    const raw = "unclaimed_fintoc_holder_identifier: 76.828.485-7";
    const out = apiErrorToUserMessage(new ApiError(raw, 422, "fintoc_attribution_unverified"));

    expect(out).toContain("Administración → Empresas");
    expect(out).toContain("RUT");
    expect(out).not.toContain("unclaimed_fintoc_holder_identifier");
    expect(out).not.toContain("76.828.485-7");
  });

  it("fintoc_permissions_missing describe el rechazo de la API sin inventar pasos del widget", () => {
    expect(
      apiErrorToUserMessage(
        new ApiError("Fintoc 403 en /accounts", 422, "fintoc_permissions_missing"),
      ),
    ).toContain("su API rechazó la lectura de cuentas");
  });

  it("429 rate limit → 'muchas operaciones seguidas'", () => {
    expect(apiErrorToUserMessage(new ApiError("rate-limit", 429))).toBe(
      "Hiciste muchas operaciones seguidas. Espera un momento.",
    );
  });

  it("503 mantenimiento → 'Qavante está en mantenimiento'", () => {
    expect(apiErrorToUserMessage(new ApiError("maintenance", 503))).toBe(
      "Qavante está en mantenimiento. Volvemos pronto.",
    );
  });

  it("5xx sin detalle útil (Internal Server Error) → genérico 'no pudimos cargar'", () => {
    expect(apiErrorToUserMessage(new ApiError("Internal Server Error", 500))).toBe(
      "No pudimos cargar la información. Intenta nuevamente.",
    );
    expect(apiErrorToUserMessage(new ApiError("Error 500", 500))).toBe(
      "No pudimos cargar la información. Intenta nuevamente.",
    );
  });

  it("5xx con detalle del backend no expone el texto recibido", () => {
    expect(apiErrorToUserMessage(new ApiError("El SII no respondió a tiempo.", 500))).toBe(
      "No pudimos cargar la información. Intenta nuevamente.",
    );
  });

  it("504 timeout → 'operación demorando'", () => {
    expect(apiErrorToUserMessage(new ApiError("timeout", 504))).toBe(
      "La operación está demorando más de lo esperado.",
    );
  });

  it("code=source_unavailable → copy específico independiente del status", () => {
    const err = new ApiError("source down", 502, "source_unavailable");
    expect(apiErrorToUserMessage(err)).toBe("La fuente no está disponible en este momento.");
  });

  it("code=config_missing con status 0 no expone la variable interna", () => {
    /* `config_missing` se lanza desde client.ts cuando falta la URL de la API: comparte
       status 0 con un error de red real, y gana sobre él porque el corte no es de red. */
    const err = new ApiError("NEXT_PUBLIC_API_URL no configurada", 0, "config_missing");
    const out = apiErrorToUserMessage(err);
    expect(out).toBe("La aplicación no pudo conectarse al servicio. Intenta nuevamente.");
    expect(out).not.toContain("NEXT_PUBLIC_API_URL");
  });

  it("status 400 desconocido cae a un mensaje seguro", () => {
    const err = new ApiError("custom 400 message", 400);
    expect(apiErrorToUserMessage(err)).toBe("Ocurrió un error inesperado. Intenta nuevamente.");
  });

  it("status desconocido + sin message → fallback 'inesperado'", () => {
    const err = new ApiError("", 418);
    expect(apiErrorToUserMessage(err)).toBe("Ocurrió un error inesperado. Intenta nuevamente.");
  });

  it("nunca refleja stack, UUID, ruta ni código desconocido", () => {
    const raw =
      "TypeError: boom at /api/private/tenant/123e4567-e89b-12d3-a456-426614174000 code=UNEXPECTED";
    const out = apiErrorToUserMessage(new ApiError(raw, 500, "unknown_code"));
    expect(out).toBe("No pudimos cargar la información. Intenta nuevamente.");
    expect(out).not.toMatch(/TypeError|\/api\/|123e4567|UNEXPECTED/);
  });

  it("un message_code enumerado del servidor SÍ se renderiza; su texto libre no", () => {
    /* La única rama en que la frontera usa carga del servidor: `userMessage` ya pasó por
       `parseUserMessage`, así que sólo trae un código de la lista y parámetros enumerados. */
    const raw = "Traceback: SELECT * FROM users at /api/private";
    const err = new ApiError(
      raw,
      422,
      "invalid_input",
      { sql: raw },
      {
        message_code: "invalid_field",
        params: { field: "rut" },
        correlation_id: "req.42:abc",
      },
    );
    const out = apiErrorToUserMessage(err);

    expect(out).toBe("Revisa el campo RUT. Referencia: req.42:abc.");
    // Gemelo positivo con la MISMA regex: el crudo sí contiene lo que el mensaje no refleja.
    expect(raw).toMatch(/Traceback|SELECT|\/api\//);
    expect(out).not.toMatch(/Traceback|SELECT|\/api\//);
  });

  it("el message_code del servidor gana sobre el fallback por status", () => {
    const conCodigo = new ApiError("boom", 500, undefined, undefined, {
      message_code: "source_unavailable",
    });
    const sinCodigo = new ApiError("boom", 500);

    expect(apiErrorToUserMessage(conCodigo)).toBe("La fuente no está disponible en este momento.");
    // Gemelo: el MISMO status, sin `userMessage`, cae al fallback y da otro texto.
    expect(apiErrorToUserMessage(sinCodigo)).toBe(
      "No pudimos cargar la información. Intenta nuevamente.",
    );
  });

  it("en login, un status distinto de 401 no usa el copy de credenciales", () => {
    const err = new ApiError("forbidden", 403);
    expect(apiErrorToUserMessage(err, "login")).toBe(
      "No tienes permisos para realizar esta acción.",
    );
    // Gemelo positivo con el MISMO contexto: con 401 sí aparece el copy de credenciales.
    expect(apiErrorToUserMessage(new ApiError("unauthorized", 401), "login")).toBe(
      "RUT o clave incorrectos. Verifica tus datos.",
    );
  });

  it("el boundary desconocido delega en la frontera cuando el fallo SÍ es un ApiError", () => {
    const err = new ApiError("not found", 404);
    const fallback = "No pudimos completar la acción.";

    expect(unknownErrorToUserMessage(err, fallback)).toBe(apiErrorToUserMessage(err));
    expect(unknownErrorToUserMessage(err, fallback)).toBe(
      "No encontramos la información que buscas.",
    );
    // Gemelo: con un fallo que NO es ApiError, el mismo fallback sí se usa.
    expect(unknownErrorToUserMessage(new Error("not found"), fallback)).toBe(fallback);
  });

  it("sin fallback explícito, el boundary desconocido usa el genérico seguro", () => {
    expect(unknownErrorToUserMessage(new Error("TypeError at /api/private"))).toBe(
      "Ocurrió un error inesperado. Intenta nuevamente.",
    );
  });

  it("el boundary de error desconocido nunca refleja un Error técnico", () => {
    const raw = new Error("TypeError at /api/private trace_id_123");
    const out = unknownErrorToUserMessage(raw, "No pudimos completar la acción.");

    expect(out).toBe("No pudimos completar la acción.");
    expect(out).not.toMatch(/TypeError|\/api\/|trace_id/);
  });
});

describe("#370 — 422 bank_movement_currency_unverified (qavante-api#905)", () => {
  it("explica que no se guardó y por qué, sin reflejar el mensaje técnico del backend", () => {
    const err = new ApiError(
      "movimiento sin moneda verificada (currency_unverified)",
      422,
      "bank_movement_currency_unverified",
    );
    const out = apiErrorToUserMessage(err);
    expect(out).toBe(
      "No se guardó la clasificación: la moneda de este movimiento bancario no está verificada. Revisa el movimiento en Banco o sincroniza la cuenta antes de clasificarlo.",
    );
    expect(out).not.toMatch(/currency_unverified/);
  });
});
