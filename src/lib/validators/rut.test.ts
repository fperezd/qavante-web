/* Anti-regresión del validador de RUT chileno (módulo 11 con DV).
   Crítico: lo usan los forms de login, invitar usuario, aceptar
   invitación y credenciales SII. Cualquier bug acá afecta 5+
   forms simultaneamente. */

import { describe, expect, it } from "vitest";
import { isValidRut, normalizeRut } from "./rut";

describe("isValidRut — validador módulo 11", () => {
  describe("RUTs válidos canónicos", () => {
    /* DVs verificados a mano con el algoritmo módulo 11 SII. Mezcla
       personas naturales (RUT < 50M) + empresas (RUT > 50M) + dígito
       chico + caso DV = 0. */
    const validos = [
      "11.111.111-1",
      "12.345.678-5",
      "22.222.222-2",
      "76.123.456-0",
      "99.999.999-9",
      "12.029.354-0",
      "12.345.670-K",
      "1-9",
    ];
    for (const rut of validos) {
      it(`acepta ${rut}`, () => {
        expect(isValidRut(rut)).toBe(true);
      });
    }
  });

  describe("DV con letra K", () => {
    it("acepta RUT cuyo DV es K (caso del 11-mod-10)", () => {
      /* 12.345.670-K → sum=122, 122%11=1, 11-1=10 → DV=K. */
      expect(isValidRut("12.345.670-K")).toBe(true);
    });

    it("acepta DV en minúscula 'k' (normaliza a mayúscula)", () => {
      expect(isValidRut("12.345.670-k")).toBe(true);
    });
  });

  describe("Variantes de formato del input", () => {
    it("acepta RUT sin puntos pero con guión", () => {
      expect(isValidRut("11111111-1")).toBe(true);
    });

    it("acepta RUT con espacios", () => {
      expect(isValidRut(" 11.111.111-1 ")).toBe(true);
    });

    it("acepta RUT sin guión", () => {
      expect(isValidRut("111111111")).toBe(true);
    });
  });

  describe("RUTs inválidos", () => {
    it("rechaza DV equivocado", () => {
      expect(isValidRut("11.111.111-2")).toBe(false);
    });

    it("rechaza string vacío", () => {
      expect(isValidRut("")).toBe(false);
    });

    it("rechaza un solo carácter", () => {
      expect(isValidRut("1")).toBe(false);
    });

    it("rechaza body no numérico", () => {
      expect(isValidRut("ABC.DEF.GHI-1")).toBe(false);
    });

    it("rechaza solo letras", () => {
      expect(isValidRut("abc")).toBe(false);
    });

    it("rechaza RUT cero (cuerpo todo-ceros: pasa módulo 11 pero no existe en Chile)", () => {
      expect(isValidRut("0-0")).toBe(false);
      expect(isValidRut("00000000-0")).toBe(false);
    });

    it("rechaza DV dígito tipeado como K", () => {
      /* 11.111.111 tiene DV correcto "1"; un "K" no debe colar. */
      expect(isValidRut("11.111.111-K")).toBe(false);
    });
  });
});

describe("normalizeRut — formato cuerpo-DV para el SII", () => {
  it("saca puntos y deja el guión antes del DV", () => {
    expect(normalizeRut("76.123.456-0")).toBe("76123456-0");
    expect(normalizeRut("76123456-0")).toBe("76123456-0");
    expect(normalizeRut("76123456K")).toBe("76123456-K");
  });
  it("pasa el DV a mayúscula", () => {
    expect(normalizeRut("12.345.678-k")).toBe("12345678-K");
  });
  it("input muy corto → devuelve trim del original", () => {
    expect(normalizeRut("7")).toBe("7");
    expect(normalizeRut("  ")).toBe("");
  });
});
