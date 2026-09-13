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
    expect(out).toBe(
      "No pudimos actualizar la información del SII. Revisa el estado de la conexión en Administración → Credenciales.",
    );
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

  it("422 → 'datos no válidos'", () => {
    expect(apiErrorToUserMessage(new ApiError("validation", 422))).toBe(
      "Algunos datos no son válidos. Revisa el formulario.",
    );
  });

  it("429 rate limit → 'muchas operaciones seguidas'", () => {
    expect(apiErrorToUserMessage(new ApiError("rate-limit", 429))).toBe(
      "Hiciste muchas operaciones seguidas. Espera unos segundos.",
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
    const err = new ApiError("NEXT_PUBLIC_API_URL no configurada", 0, "config_missing");
    expect(apiErrorToUserMessage(err)).toBe("Esta función no está disponible en este momento.");
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

  it("el boundary de error desconocido nunca refleja un Error técnico", () => {
    const raw = new Error("TypeError at /api/private trace_id_123");
    const out = unknownErrorToUserMessage(raw, "No pudimos completar la acción.");

    expect(out).toBe("No pudimos completar la acción.");
    expect(out).not.toMatch(/TypeError|\/api\/|trace_id/);
  });
});
