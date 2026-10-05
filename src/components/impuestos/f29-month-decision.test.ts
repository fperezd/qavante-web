import { describe, it, expect } from "vitest";
import { f29MesPresentacion, type F29MesDecisionInput } from "./f29-month-decision";

/* El defecto que fija este test (D13, issue #202): el detalle F29 ya calculaba que un período estaba
   pagado y usaba ese hecho SÓLO para un badge verde, mientras debajo seguía ofreciendo "Pagar todo" y
   "Postergar el IVA". Cada caso de abajo tiene su gemelo que SÍ debe ofrecer las opciones, para que
   ninguna de estas afirmaciones pase por vacuidad. */

function entrada(over: Partial<F29MesDecisionInput> = {}): F29MesDecisionInput {
  return {
    ivaPostergado: 0,
    girosEstado: "giro_no_determinado",
    girosPostergadoIva: false,
    declarado: false,
    ...over,
  };
}

describe("f29MesPresentacion", () => {
  it("un período declarado sin giros pendientes está pagado y NO ofrece pagar", () => {
    expect(f29MesPresentacion(entrada({ girosEstado: "sin_giro", declarado: true }))).toBe(
      "pagado",
    );
  });

  it("GEMELO: el mismo período con un giro pendiente sí ofrece las opciones", () => {
    expect(
      f29MesPresentacion(entrada({ girosEstado: "giro_no_determinado", declarado: true })),
    ).toBe("opciones");
  });

  it("sin giros pendientes pero SIN declarar no es pagado: la decisión sigue abierta", () => {
    expect(f29MesPresentacion(entrada({ girosEstado: "sin_giro", declarado: false }))).toBe(
      "opciones",
    );
  });

  it("varios giros pendientes ofrece las opciones", () => {
    expect(
      f29MesPresentacion(entrada({ girosEstado: "multiples_no_determinado", declarado: true })),
    ).toBe("opciones");
  });

  describe("el IVA postergado manda sobre todo lo demás", () => {
    it("el dato persistido del F29 declarado gana", () => {
      expect(
        f29MesPresentacion(
          entrada({ ivaPostergado: 1_200_000, girosEstado: "sin_giro", declarado: true }),
        ),
      ).toBe("postergado");
    });

    it("la Consulta de Giros en vivo gana como respaldo", () => {
      expect(
        f29MesPresentacion(
          entrada({ ivaPostergado: null, girosPostergadoIva: true, declarado: true }),
        ),
      ).toBe("postergado");
    });

    it("GEMELO: `iva_postergado` en 0 no activa el panel de postergado", () => {
      expect(
        f29MesPresentacion(entrada({ ivaPostergado: 0, girosEstado: "sin_giro", declarado: true })),
      ).toBe("pagado");
    });

    it("`postergado_iva` en `null` (no se sabe) no afirma que postergó", () => {
      expect(
        f29MesPresentacion(
          entrada({ girosPostergadoIva: null, girosEstado: "sin_giro", declarado: true }),
        ),
      ).toBe("pagado");
    });
  });

  describe("cuando la Consulta de Giros no responde, el silencio del SII no se vuelve una deuda", () => {
    it("un período declarado muestra su historia, no una orden de pago", () => {
      expect(f29MesPresentacion(entrada({ girosEstado: undefined, declarado: true }))).toBe(
        "historia",
      );
    });

    it("un período SIN declarar sigue siendo una decisión abierta", () => {
      expect(f29MesPresentacion(entrada({ girosEstado: undefined, declarado: false }))).toBe(
        "opciones",
      );
    });

    it("y si el F29 declarado dice que postergó, eso se sigue viendo sin el SII", () => {
      expect(
        f29MesPresentacion(
          entrada({ ivaPostergado: 900_000, girosEstado: undefined, declarado: true }),
        ),
      ).toBe("postergado");
    });
  });

  it("ninguna entrada cae fuera de las cuatro presentaciones", () => {
    const estados = [
      undefined,
      "sin_giro",
      "postergado",
      "giro_no_determinado",
      "multiples_no_determinado",
      "algo_que_el_sii_invente_mañana",
    ];
    for (const girosEstado of estados) {
      for (const declarado of [true, false]) {
        for (const ivaPostergado of [null, 0, 500_000]) {
          const r = f29MesPresentacion(entrada({ girosEstado, declarado, ivaPostergado }));
          expect(["postergado", "pagado", "historia", "opciones"]).toContain(r);
        }
      }
    }
  });

  it("un estado desconocido del SII no se lee como pagado", () => {
    expect(
      f29MesPresentacion(
        entrada({ girosEstado: "algo_que_el_sii_invente_mañana", declarado: true }),
      ),
    ).toBe("opciones");
  });
});
