import { describe, it, expect } from "vitest";
import type { F29BridgeResponse, F29PaymentApplication, F29PaymentLink } from "@/lib/api/sii";
import {
  f29BridgeDelFolio,
  f29DiferenciaNoExplicada,
  f29EstadoDePago,
  f29LecturaEvidencia,
  f29ResidualDeclarado,
  f29TotalCompuesto,
} from "./f29-bridge-lectura";

/* Cada afirmación de abajo tiene su gemelo negativo: el caso que DEBE dar otra cosa. Sin el gemelo,
   una implementación que devolviera siempre lo mismo pasaría igual. */

function cuota(over: Partial<F29PaymentApplication> = {}): F29PaymentApplication {
  return {
    application_kind: "bank_movement",
    applied_amount: "1000",
    applied_at: "2026-08-20T00:00:00Z",
    declared_at: "2026-08-21T00:00:00Z",
    currency: "CLP",
    provenance: "bank_movement_declared",
    ...over,
  };
}

function vinculo(over: Partial<F29PaymentLink> = {}): F29PaymentLink {
  return {
    applications: [],
    bank_evidence: { applied_amount: "0", bank_movement_id: null },
    declaration_receipt: { folio: 9238206586, declaration_total: 7_450_761, source: "sii_f29_pdf" },
    evidence_declared: 0,
    evidence_required: 1,
    missing_requirements: [],
    payment_state: "pending",
    ...over,
  };
}

describe("f29EstadoDePago — la unión escrita a mano, porque el contrato no la tipa", () => {
  it.each(["paid", "partial", "pending", "deferred", "unknown"] as const)(
    "%s es un valor DECLARADO del contrato",
    (estado) => {
      expect(f29EstadoDePago(estado)).toEqual({ clase: "declarado", estado });
    },
  );

  it("un valor que el contrato no admite cae en la rama por defecto CON el valor crudo", () => {
    expect(f29EstadoDePago("reconciliado_parcial_v2")).toEqual({
      clase: "fuera_del_contrato",
      valor: "reconciliado_parcial_v2",
    });
  });

  it("GEMELO: la rama por defecto NO es `unknown` — un valor ilegible no se clasifica como declarado", () => {
    const ilegible = f29EstadoDePago("reconciliado_parcial_v2");
    const declaradoUnknown = f29EstadoDePago("unknown");
    expect(ilegible).not.toEqual(declaradoUnknown);
    expect(ilegible.clase).toBe("fuera_del_contrato");
    expect(declaradoUnknown).toEqual({ clase: "declarado", estado: "unknown" });
  });

  it("ausencia de valor tampoco se clasifica: no hay default de contrato", () => {
    expect(f29EstadoDePago(undefined).clase).toBe("fuera_del_contrato");
    expect(f29EstadoDePago(null).clase).toBe("fuera_del_contrato");
    expect(f29EstadoDePago("").clase).toBe("fuera_del_contrato");
  });

  it("GEMELO: `paid` sí se clasifica, para que el caso anterior no pase por vacuidad", () => {
    expect(f29EstadoDePago(" paid ")).toEqual({ clase: "declarado", estado: "paid" });
  });
});

describe("f29LecturaEvidencia — las TRES lecturas de bank_movement_id", () => {
  it("con EXACTAMENTE UN movimiento declarado, lo nombra", () => {
    const lectura = f29LecturaEvidencia(
      vinculo({
        bank_evidence: { applied_amount: "7450761", bank_movement_id: "mov-7f3a" },
        applications: [cuota({ applied_amount: "7450761", bank_movement_id: "mov-7f3a" })],
      }),
    );
    expect(lectura.lectura).toBe("movimiento_declarado");
    expect(lectura).toMatchObject({ bankMovementId: "mov-7f3a" });
  });

  it("null con `applications` VACÍA es la ausencia explícita, y dice qué falta", () => {
    const lectura = f29LecturaEvidencia(
      vinculo({
        bank_evidence: { applied_amount: "0", bank_movement_id: null },
        applications: [],
        missing_requirements: ["bank_movement_declared"],
      }),
    );
    expect(lectura).toEqual({
      lectura: "ausencia_explicita",
      faltante: ["bank_movement_declared"],
    });
  });

  it("null con DOS cuotas es un pago que ningún movimiento único representa", () => {
    const lectura = f29LecturaEvidencia(
      vinculo({
        bank_evidence: { applied_amount: "7450761", bank_movement_id: null },
        applications: [cuota({ applied_amount: "4000000" }), cuota({ applied_amount: "3450761" })],
      }),
    );
    expect(lectura.lectura).toBe("pago_sin_movimiento_unico");
    expect(lectura).toMatchObject({ cuotas: expect.objectContaining({ length: 2 }) });
  });

  it("null con UNA cuota por comprobante también es un pago, no una ausencia", () => {
    const lectura = f29LecturaEvidencia(
      vinculo({
        bank_evidence: { applied_amount: "7450761", bank_movement_id: null },
        applications: [
          cuota({
            application_kind: "declaration_receipt",
            applied_amount: "7450761",
            bank_movement_id: null,
            provenance: "manual_receipt_declared",
            receipt_reference: "op-55120933",
          }),
        ],
      }),
    );
    expect(lectura.lectura).toBe("pago_sin_movimiento_unico");
  });

  it("GEMELO: las tres lecturas son TRES valores distintos — ninguna se colapsa con otra", () => {
    const unMovimiento = f29LecturaEvidencia(
      vinculo({ bank_evidence: { applied_amount: "1000", bank_movement_id: "mov-1" } }),
    );
    const ausencia = f29LecturaEvidencia(vinculo({ applications: [] }));
    const enCuotas = f29LecturaEvidencia(
      vinculo({ applications: [cuota(), cuota({ applied_amount: "2000" })] }),
    );
    const lecturas = [unMovimiento.lectura, ausencia.lectura, enCuotas.lectura];
    expect(new Set(lecturas).size).toBe(3);
    expect(enCuotas.lectura).not.toBe(ausencia.lectura);
  });

  it("un `bank_movement_id` en blanco no cuenta como movimiento declarado", () => {
    expect(
      f29LecturaEvidencia(
        vinculo({ bank_evidence: { applied_amount: "0", bank_movement_id: "  " } }),
      ).lectura,
    ).toBe("ausencia_explicita");
  });
});

describe("f29ResidualDeclarado — una resta entre hechos declarados", () => {
  it("sin ninguna cuota declarada, el residual es el total oficial COMPLETO (no cero)", () => {
    const r = f29ResidualDeclarado(vinculo({ applications: [] }));
    expect(r).toEqual({
      computable: true,
      totalOficial: 7_450_761,
      aplicado: 0,
      residual: 7_450_761,
      cuotas: 0,
    });
  });

  it("GEMELO: con las cuotas que cubren el total, el residual sí es cero", () => {
    const r = f29ResidualDeclarado(
      vinculo({
        applications: [cuota({ applied_amount: "4000000" }), cuota({ applied_amount: "3450761" })],
      }),
    );
    expect(r).toMatchObject({ computable: true, aplicado: 7_450_761, residual: 0, cuotas: 2 });
  });

  it("pago parcial: el residual es lo que falta, con la cuenta a la vista", () => {
    const r = f29ResidualDeclarado(
      vinculo({ applications: [cuota({ applied_amount: "4000000" })] }),
    );
    expect(r).toMatchObject({ totalOficial: 7_450_761, aplicado: 4_000_000, residual: 3_450_761 });
  });

  it("sin el código 91 observado el residual NO es cero: no es computable, y dice qué falta", () => {
    const r = f29ResidualDeclarado(
      vinculo({
        declaration_receipt: { folio: 9238206586, declaration_total: null, source: "sii_f29_pdf" },
        missing_requirements: ["declaration_total_observation"],
      }),
    );
    expect(r).toEqual({ computable: false, faltante: ["declaration_total_observation"] });
  });

  it("GEMELO: con el código 91 observado sí es computable, así que el caso anterior no pasa por vacuidad", () => {
    expect(f29ResidualDeclarado(vinculo()).computable).toBe(true);
  });

  it("una cuota con monto ilegible no se suma como 0: se declara no computable", () => {
    const r = f29ResidualDeclarado(
      vinculo({ applications: [cuota({ applied_amount: "no-es-plata" })] }),
    );
    expect(r).toEqual({ computable: false, faltante: ["cuota_sin_monto_legible"] });
  });
});

describe("f29DiferenciaNoExplicada — rotula sólo cuando no es cero ni null", () => {
  /* El caso real medido en prod, folio 9238206586, período 2026-07: IVA débito 7.213.010, crédito
     NULL, PPM 52.519, total oficial (código 91) 7.450.761. Los componentes observados suman
     7.265.529, o sea $185.232 MENOS que el total oficial. El contrato publica
     `composed_total − declaration_total`, así que el valor es NEGATIVO: −185.232.

     El −239.604 que pide el enunciado del issue no se sostiene contra esos componentes: la resta de
     los montos observados da 185.232. Se conserva abajo como caso de forma —un delta negativo
     cualquiera se rotula igual— pero el número del período es 185.232. */
  it("el caso real del período: los componentes quedan $185.232 bajo el total oficial", () => {
    expect(f29DiferenciaNoExplicada(-185_232)).toEqual({
      rotular: true,
      delta: -185_232,
      magnitud: 185_232,
      direccion: "componentes_bajo_total",
    });
    expect(f29TotalCompuesto(7_450_761, -185_232)).toBe(7_265_529);
  });

  it("el delta del enunciado del issue se rotula igual, con su propia magnitud", () => {
    expect(f29DiferenciaNoExplicada(-239_604)).toMatchObject({
      rotular: true,
      magnitud: 239_604,
      direccion: "componentes_bajo_total",
    });
  });

  it("un delta positivo apunta al otro lado: los componentes suman MÁS que el total oficial", () => {
    expect(f29DiferenciaNoExplicada(185_232)).toMatchObject({
      rotular: true,
      magnitud: 185_232,
      direccion: "componentes_sobre_total",
    });
  });

  it("GEMELO: cero NO se rotula como diferencia — es reconciliado", () => {
    expect(f29DiferenciaNoExplicada(0)).toEqual({ rotular: false, motivo: "reconciliado" });
  });

  it("GEMELO: null NO se rotula ni se confunde con cero — no es computable", () => {
    expect(f29DiferenciaNoExplicada(null)).toEqual({ rotular: false, motivo: "no_computable" });
    expect(f29DiferenciaNoExplicada(undefined)).toEqual({
      rotular: false,
      motivo: "no_computable",
    });
    expect(f29DiferenciaNoExplicada(null)).not.toEqual(f29DiferenciaNoExplicada(0));
  });

  it("el total compuesto no se inventa cuando falta cualquiera de los dos términos", () => {
    expect(f29TotalCompuesto(null, -185_232)).toBeNull();
    expect(f29TotalCompuesto(7_450_761, null)).toBeNull();
    expect(f29TotalCompuesto(7_450_761, 0)).toBe(7_450_761);
  });
});

describe("f29BridgeDelFolio — una rectificatoria no se esconde detrás de la original", () => {
  function bridge(folio: number, observedAt: string): F29BridgeResponse {
    return {
      data_state: "complete",
      declaration_id: `decl-${folio}`,
      declaration_total: 7_450_761,
      folio,
      observed_at: observedAt,
      official_components: {},
      payment: vinculo(),
      payment_state: "pending",
      period_month: 7,
      period_year: 2026,
      reconciled: false,
      unexplained_delta: -185_232,
    };
  }

  const original = bridge(9238206586, "2026-08-01T10:00:00Z");
  const rectificatoria = bridge(9299999999, "2026-09-15T10:00:00Z");

  it("manda el folio que la pantalla ya está mostrando", () => {
    expect(f29BridgeDelFolio([original, rectificatoria], 9238206586)?.folio).toBe(9238206586);
  });

  it("GEMELO: con el otro folio devuelve el otro bridge, no siempre el primero", () => {
    expect(f29BridgeDelFolio([original, rectificatoria], 9299999999)?.folio).toBe(9299999999);
  });

  it("sin folio elige el observado más recientemente, no el primero de la lista", () => {
    expect(f29BridgeDelFolio([original, rectificatoria], null)?.folio).toBe(9299999999);
    expect(f29BridgeDelFolio([rectificatoria, original], null)?.folio).toBe(9299999999);
  });

  it("un folio que no está en la lista no inventa: cae al más reciente", () => {
    expect(f29BridgeDelFolio([original, rectificatoria], 1)?.folio).toBe(9299999999);
  });

  it("GEMELO: sin bridges devuelve null — nada que reconciliar no es una diferencia de cero", () => {
    expect(f29BridgeDelFolio([], 9238206586)).toBeNull();
    expect(f29BridgeDelFolio(undefined, 9238206586)).toBeNull();
  });
});
