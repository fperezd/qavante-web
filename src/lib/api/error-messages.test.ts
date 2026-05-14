/* Anti-regresión del mapping ApiError → mensaje usuario (Anexo C.3).
   Estos copys los ven todos los usuarios PYME chilenos cuando algo
   falla; cambios accidentales en el mapeo se notan inmediatamente. */

import { describe, expect, it } from "vitest";
import { apiErrorToUserMessage } from "./error-messages";
import { ApiError } from "./errors";

describe("apiErrorToUserMessage — mapping de Anexo C.3", () => {
  it("network error (status 0) → 'perdiste conexión'", () => {
    const err = new ApiError("network", 0, "network_error");
    expect(apiErrorToUserMessage(err)).toBe("Parece que perdiste conexión. Verificá tu internet.");
  });

  it("401 en context login → copy específico 'RUT o clave incorrectos'", () => {
    const err = new ApiError("unauthorized", 401);
    expect(apiErrorToUserMessage(err, "login")).toBe(
      "RUT o clave incorrectos. Verificá tus datos.",
    );
  });

  it("401 en context general → 'sesión expiró'", () => {
    const err = new ApiError("unauthorized", 401);
    expect(apiErrorToUserMessage(err)).toBe("Tu sesión expiró. Volvé a iniciar sesión.");
  });

  it("403 → 'no tenés permisos'", () => {
    expect(apiErrorToUserMessage(new ApiError("forbidden", 403))).toBe(
      "No tenés permisos para realizar esta acción.",
    );
  });

  it("404 → 'no encontramos'", () => {
    expect(apiErrorToUserMessage(new ApiError("not found", 404))).toBe(
      "No encontramos la información que buscás.",
    );
  });

  it("408 timeout → 'operación demorando'", () => {
    expect(apiErrorToUserMessage(new ApiError("timeout", 408))).toBe(
      "La operación está demorando más de lo esperado.",
    );
  });

  it("422 → 'datos no válidos'", () => {
    expect(apiErrorToUserMessage(new ApiError("validation", 422))).toBe(
      "Algunos datos no son válidos. Revisá el formulario.",
    );
  });

  it("429 rate limit → 'muchas operaciones seguidas'", () => {
    expect(apiErrorToUserMessage(new ApiError("rate-limit", 429))).toBe(
      "Hiciste muchas operaciones seguidas. Esperá unos segundos.",
    );
  });

  it("503 mantenimiento → 'Qavante está en mantenimiento'", () => {
    expect(apiErrorToUserMessage(new ApiError("maintenance", 503))).toBe(
      "Qavante está en mantenimiento. Volvemos pronto.",
    );
  });

  it("5xx genérico → 'no pudimos cargar'", () => {
    expect(apiErrorToUserMessage(new ApiError("server-error", 500))).toBe(
      "No pudimos cargar la información. Intentá nuevamente.",
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

  it("code=config_missing con status 0 → mensaje técnico (gana sobre network)", () => {
    /* config_missing se lanza desde client.ts cuando NEXT_PUBLIC_API_URL
       no está seteado; comparte status=0 con un network error real pero
       el copy técnico ayuda al troubleshooting dev (Anexo C.3 fallback). */
    const err = new ApiError("NEXT_PUBLIC_API_URL no configurada", 0, "config_missing");
    expect(apiErrorToUserMessage(err)).toBe("NEXT_PUBLIC_API_URL no configurada");
  });

  it("status 400 desconocido cae al mensaje original como fallback", () => {
    const err = new ApiError("custom 400 message", 400);
    expect(apiErrorToUserMessage(err)).toBe("custom 400 message");
  });

  it("status desconocido + sin message → fallback 'inesperado'", () => {
    const err = new ApiError("", 418);
    expect(apiErrorToUserMessage(err)).toBe("Ocurrió un error inesperado.");
  });
});
