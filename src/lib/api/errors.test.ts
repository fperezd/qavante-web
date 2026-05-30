/* Tests de ApiError — predicados de status usados en todo el data layer
   para mapear errores del backend a copys/comportamiento (Anexo C.3).
   Anti-regresión: si alguien cambia un umbral (ej. isServerError) se
   rompen silenciosamente los flujos de error de muchas views. */
import { describe, expect, it } from "vitest";
import { ApiError } from "./errors";

describe("ApiError — construcción", () => {
  it("guarda message, status, code y detail", () => {
    const err = new ApiError("Falló", 422, "validation_error", { field: "email" });
    expect(err.message).toBe("Falló");
    expect(err.status).toBe(422);
    expect(err.code).toBe("validation_error");
    expect(err.detail).toEqual({ field: "email" });
  });

  it("es una instancia de Error con name 'ApiError'", () => {
    const err = new ApiError("x", 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe("ApiError");
  });

  it("code y detail son opcionales", () => {
    const err = new ApiError("x", 404);
    expect(err.code).toBeUndefined();
    expect(err.detail).toBeUndefined();
  });
});

describe("ApiError — predicados de status", () => {
  it("isNetworkError sólo para status 0", () => {
    expect(new ApiError("x", 0).isNetworkError()).toBe(true);
    expect(new ApiError("x", 500).isNetworkError()).toBe(false);
  });

  it("isUnauthorized sólo para 401", () => {
    expect(new ApiError("x", 401).isUnauthorized()).toBe(true);
    expect(new ApiError("x", 403).isUnauthorized()).toBe(false);
  });

  it("isForbidden sólo para 403", () => {
    expect(new ApiError("x", 403).isForbidden()).toBe(true);
    expect(new ApiError("x", 401).isForbidden()).toBe(false);
  });

  it("isNotFound sólo para 404", () => {
    expect(new ApiError("x", 404).isNotFound()).toBe(true);
    expect(new ApiError("x", 400).isNotFound()).toBe(false);
  });

  it("isValidation sólo para 422", () => {
    expect(new ApiError("x", 422).isValidation()).toBe(true);
    expect(new ApiError("x", 400).isValidation()).toBe(false);
  });

  it("isServerError para 5xx (>= 500), no para 4xx", () => {
    expect(new ApiError("x", 500).isServerError()).toBe(true);
    expect(new ApiError("x", 503).isServerError()).toBe(true);
    expect(new ApiError("x", 499).isServerError()).toBe(false);
    expect(new ApiError("x", 404).isServerError()).toBe(false);
  });

  it("los predicados son mutuamente excluyentes para un mismo status", () => {
    const err = new ApiError("x", 401);
    expect(err.isUnauthorized()).toBe(true);
    expect(err.isForbidden()).toBe(false);
    expect(err.isNotFound()).toBe(false);
    expect(err.isValidation()).toBe(false);
    expect(err.isServerError()).toBe(false);
    expect(err.isNetworkError()).toBe(false);
  });
});
