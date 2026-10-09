import { describe, expect, it } from "vitest";
import { DEFICIT, NO_DEFICIT } from "./inicio-resumen.fixtures";
import {
  accionesDiaInicio,
  componentesProyeccionInicio,
  pulsoInicio,
  resultadoMesInicio,
} from "./inicio-maqueta-extension-model";

describe("inicio-maqueta-extension-model", () => {
  it("usa placeholders de acciones cuando priority_actions viene vacío", () => {
    const acciones = accionesDiaInicio(DEFICIT);
    expect(acciones).toHaveLength(3);
    expect(acciones.every((a) => !a.conectado)).toBe(true);
    expect(acciones[0]?.titulo).toContain("pagos");
  });

  it("marca resultado operacional como pendiente sin bloque", () => {
    expect(resultadoMesInicio(DEFICIT).conectado).toBe(false);
  });

  it("conecta saldo y faltante desde el summary", () => {
    const tiles = componentesProyeccionInicio(DEFICIT, null).tiles;
    expect(tiles[0]?.conectado).toBe(true);
    expect(tiles[3]?.conectado).toBe(true);
  });

  it("pulso conectado cuando el summary trae pulso", () => {
    const pulso = pulsoInicio({
      ...NO_DEFICIT,
      pulso: {
        score: 49,
        status: "critical",
        confidence: "medium",
        preliminary: false,
        top_driver_negative: "Caja bajo presión",
      },
    });
    expect(pulso.conectado).toBe(true);
    expect(pulso.badge).toContain("Crítica");
  });
});
