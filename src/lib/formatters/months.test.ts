/* Tests de los nombres de mes centralizados. Antes vivían copiados en 11
   archivos: lo que protegen es que las variantes de casing DERIVEN del canónico
   y no vuelvan a escribirse a mano. */
import { describe, expect, it } from "vitest";
import {
  MESES_CORTOS,
  MESES_LARGOS,
  MESES_CORTOS_CAP,
  MESES_LARGOS_CAP,
  mesCortoDePeriodo,
  periodoLargo,
} from "./months";

describe("periodoLargo", () => {
  it("usa los doce nombres centrales y conserva el año", () => {
    MESES_LARGOS.forEach((month, index) => {
      expect(periodoLargo(`2026-${String(index + 1).padStart(2, "0")}`)).toBe(`${month} de 2026`);
    });
    expect(periodoLargo("2025-12")).toBe("diciembre de 2025");
  });
  it.each(["", "2026-00", "2026-13", "2026-8", "2026-08-01", "no-es-periodo"])(
    "no inventa un mes para %s",
    (period) => expect(periodoLargo(period)).toBeNull(),
  );
});

describe("arrays de meses", () => {
  it("los cuatro tienen 12 entradas, índice 0 = enero", () => {
    for (const a of [MESES_CORTOS, MESES_LARGOS, MESES_CORTOS_CAP, MESES_LARGOS_CAP]) {
      expect(a).toHaveLength(12);
    }
    expect(MESES_CORTOS[0]).toBe("ene");
    expect(MESES_LARGOS[0]).toBe("enero");
    expect(MESES_CORTOS[11]).toBe("dic");
    expect(MESES_LARGOS[11]).toBe("diciembre");
  });

  it("septiembre corto son TRES letras ('sep'), no el 'sept' del ICU", () => {
    // Escrito a mano justamente para que el ancho de columna no dependa del
    // runtime del usuario.
    expect(MESES_CORTOS[8]).toBe("sep");
  });

  it("las variantes capitalizadas son el canónico con la inicial en mayúscula", () => {
    expect(MESES_CORTOS_CAP).toEqual(MESES_CORTOS.map((m) => m[0]!.toUpperCase() + m.slice(1)));
    expect(MESES_LARGOS_CAP).toEqual(MESES_LARGOS.map((m) => m[0]!.toUpperCase() + m.slice(1)));
    expect(MESES_CORTOS_CAP[0]).toBe("Ene");
    expect(MESES_LARGOS_CAP[8]).toBe("Septiembre");
  });
});

describe("mesCortoDePeriodo", () => {
  it("'YYYY-MM' y 'YYYY-MM-DD' → mes corto", () => {
    expect(mesCortoDePeriodo("2026-07")).toBe("jul");
    expect(mesCortoDePeriodo("2026-07-14")).toBe("jul");
  });

  it("lo que no parsea vuelve TAL CUAL (mejor el crudo que un mes inventado)", () => {
    expect(mesCortoDePeriodo("no-es-periodo")).toBe("no-es-periodo");
    expect(mesCortoDePeriodo("2026-13")).toBe("2026-13");
  });
});
