import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { motivoSinEstimacion, resolverFuenteTgrV06 } from "./impuestos-v06-live";

describe("ImpuestosV06Live · degradación de la estimación", () => {
  it("un error de red no reutiliza un monto anterior como reemplazo", () => {
    expect(motivoSinEstimacion(new ApiError("offline", 0))).toContain(
      "No mostramos un monto desactualizado como reemplazo",
    );
  });

  it("un error del servicio conserva el calendario oficial", () => {
    expect(motivoSinEstimacion(new ApiError("falló", 502))).toContain(
      "El calendario conserva los estados oficiales disponibles",
    );
  });
});

describe("resolverFuenteTgrV06 · dato faltante/error nunca es deuda cero", () => {
  it("payload de health ausente: conserva sin dato", () => {
    const fuente = resolverFuenteTgrV06({
      authenticated: false,
      healthError: false,
      healthStatus: undefined,
      debtError: false,
      deudas: undefined,
    });
    expect(fuente.estado).toBe("sin_dato");
  });

  it("health status=error: conserva error", () => {
    const fuente = resolverFuenteTgrV06({
      authenticated: false,
      healthError: false,
      healthStatus: "error",
      debtError: false,
      deudas: undefined,
    });
    expect(fuente.estado).toBe("error");
  });

  it("error de query: conserva error y un motivo explícito", () => {
    const fuente = resolverFuenteTgrV06({
      authenticated: true,
      healthError: false,
      healthStatus: "ok",
      debtError: true,
      deudas: undefined,
    });
    expect(fuente.estado).toBe("error");
    expect("motivo" in fuente ? fuente.motivo : "").toMatch(/no mostramos un cero/i);
  });

  it("status=error: conserva error aunque venga una lista vacía", () => {
    const fuente = resolverFuenteTgrV06({
      authenticated: true,
      healthError: false,
      healthStatus: "ok",
      debtError: false,
      deudas: { status: "error", count: 0, movimientos: [] },
    });
    expect(fuente.estado).toBe("error");
  });

  it("payload ausente: conserva sin dato", () => {
    const fuente = resolverFuenteTgrV06({
      authenticated: true,
      healthError: false,
      healthStatus: "ok",
      debtError: false,
      deudas: undefined,
    });
    expect(fuente.estado).toBe("sin_dato");
  });

  it("status=ok sin movimientos: conserva sin dato", () => {
    const fuente = resolverFuenteTgrV06({
      authenticated: true,
      healthError: false,
      healthStatus: "ok",
      debtError: false,
      deudas: { status: "ok", count: 0 },
    });
    expect(fuente.estado).toBe("sin_dato");
  });

  it("[gemelo positivo] status=ok con lista explícita vacía permite afirmar cero", () => {
    const fuente = resolverFuenteTgrV06({
      authenticated: true,
      healthError: false,
      healthStatus: "ok",
      debtError: false,
      deudas: { status: "ok", count: 0, movimientos: [] },
    });
    expect(fuente).toEqual({ estado: "ok", movimientos: [] });
  });
});
