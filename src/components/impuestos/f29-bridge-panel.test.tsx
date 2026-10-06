import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { F29BridgeResponse, F29PaymentApplication, F29PaymentLink } from "@/lib/api/sii";
import { F29BridgePanel } from "./f29-bridge-panel";

/* Lo que fija este test (D13, issue #202): el detalle F29 pintaba seis filas de desglose al lado del
   total y NUNCA las reconciliaba. Acá se verifica que la diferencia aparece ROTULADA, que cero y
   null NO se rotulan (y no se confunden entre sí), y que las TRES lecturas de `bank_movement_id` se
   renderizan distinto — si las dos últimas se colapsaran en "sin movimiento", un F29 pagado en
   cuotas se leería igual que uno que nadie pagó. Cada afirmación va con su gemelo negativo. */

function cuota(over: Partial<F29PaymentApplication> = {}): F29PaymentApplication {
  return {
    /* `application_id` se volvió requerido en el contrato (arrastre del sync de api#1126). */
    application_id: "app-f29-1",
    application_kind: "bank_movement",
    applied_amount: "4000000",
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
    missing_requirements: ["bank_movement_declared"],
    payment_state: "pending",
    ...over,
  };
}

/* El caso REAL medido en prod: folio 9238206586, período 2026-07. IVA débito 7.213.010, crédito
   NULL, PPM 52.519 → los códigos observados suman 7.265.529. El total oficial (código 91) es
   7.450.761. `unexplained_delta` es `composed_total − declaration_total` = −185.232.

   El −239.604 del enunciado del issue NO se sostiene contra esos componentes; el residual real del
   folio es 185.232. Hay un caso de forma más abajo con el −239.604 para mostrar que el rótulo no
   depende del número. */
function bridge(over: Partial<F29BridgeResponse> = {}): F29BridgeResponse {
  return {
    data_state: "partial",
    declaration_id: "decl-9238206586",
    declaration_total: 7_450_761,
    folio: 9238206586,
    observed_at: "2026-08-01T10:00:00Z",
    official_components: { code_538: 7_213_010, code_537: null, code_62: 52_519 },
    payment: vinculo(),
    payment_state: "pending",
    period_month: 7,
    period_year: 2026,
    reconciled: false,
    unexplained_delta: -185_232,
    ...over,
  };
}

function html(b: F29BridgeResponse): string {
  return renderToStaticMarkup(<F29BridgePanel bridge={b} />);
}

describe("F29BridgePanel — la diferencia no explicada se rotula", () => {
  it("el caso real del folio: rotula la diferencia y muestra las dos cifras que la producen", () => {
    const markup = html(bridge());
    expect(markup).toContain("Diferencia no explicada");
    expect(markup).toContain("185.232");
    // Las dos cifras que la producen, a la vista: lo que suman los códigos y lo que cobra el SII.
    expect(markup).toContain("7.265.529");
    expect(markup).toContain("7.450.761");
    expect(markup).toContain("MENOS");
  });

  it("el delta del enunciado del issue se rotula igual: el rótulo no depende del número", () => {
    const markup = html(bridge({ unexplained_delta: -239_604 }));
    expect(markup).toContain("Diferencia no explicada");
    expect(markup).toContain("239.604");
  });

  it("un delta positivo dice que los códigos suman MÁS, no al revés", () => {
    const markup = html(bridge({ unexplained_delta: 185_232 }));
    expect(markup).toContain("Diferencia no explicada");
    expect(markup).toContain("MÁS");
    expect(markup).not.toContain("MENOS");
  });

  it("GEMELO: con delta cero NO hay rótulo de diferencia — dice que los códigos explican el total", () => {
    const markup = html(bridge({ unexplained_delta: 0, reconciled: true, data_state: "complete" }));
    expect(markup).not.toContain("Diferencia no explicada");
    expect(markup).toContain("explican el total completo");
  });

  it("GEMELO: con delta null NO hay rótulo, y tampoco se lee como cero", () => {
    const markup = html(bridge({ unexplained_delta: null, data_state: "observations_only" }));
    expect(markup).not.toContain("Diferencia no explicada");
    expect(markup).not.toContain("explican el total completo");
    // No es un hueco: sigue habiendo el número completo de lo que falta por cubrir.
    expect(markup).toContain("7.450.761");
    expect(markup).toContain("todavía no se puede hacer");
  });
});

describe("F29BridgePanel — las TRES lecturas de la evidencia bancaria", () => {
  const unMovimiento = bridge({
    payment_state: "paid",
    payment: vinculo({
      bank_evidence: {
        applied_amount: "7450761",
        bank_movement_id: "mov-7f3a",
        linked_at: "2026-08-22T00:00:00Z",
      },
      applications: [cuota({ applied_amount: "7450761", bank_movement_id: "mov-7f3a" })],
      missing_requirements: [],
      evidence_declared: 1,
    }),
  });

  const ausencia = bridge({ payment: vinculo({ applications: [] }) });

  const enCuotas = bridge({
    payment_state: "paid",
    payment: vinculo({
      bank_evidence: { applied_amount: "7450761", bank_movement_id: null },
      applications: [cuota({ applied_amount: "4000000" }), cuota({ applied_amount: "3450761" })],
      missing_requirements: [],
    }),
  });

  it("un movimiento declarado se nombra como respaldo del pago", () => {
    expect(html(unMovimiento)).toContain("Un movimiento bancario declarado respalda este pago");
  });

  it("la ausencia explícita dice que NADIE declaró nada, con el monto sin respaldo", () => {
    const markup = html(ausencia);
    expect(markup).toContain("Nadie declaró todavía un movimiento ni un comprobante");
    expect(markup).toContain("7.450.761");
    expect(markup).toContain("declarar el movimiento bancario que pagó este F29");
  });

  it("pagado en cuotas dice que se pagó, y lista cuánto cubrió cada cuota", () => {
    const markup = html(enCuotas);
    expect(markup).toContain("se pagó en 2 cuotas");
    expect(markup).toContain("ningún movimiento único");
    expect(markup).toContain("4.000.000");
    expect(markup).toContain("3.450.761");
  });

  it("GEMELO: pagado en cuotas NO se renderiza como la ausencia explícita", () => {
    const enCuotasMarkup = html(enCuotas);
    expect(enCuotasMarkup).not.toContain("Nadie declaró todavía");
    // Y el residual es cero porque las cuotas cubren el total: no es el total completo.
    expect(enCuotasMarkup).not.toContain("siguen sin respaldo");
  });

  it("GEMELO: las tres lecturas producen tres markups distintos", () => {
    const tres = new Set([html(unMovimiento), html(ausencia), html(enCuotas)]);
    expect(tres.size).toBe(3);
  });

  it("una sola aplicación por comprobante es un pago, no una ausencia", () => {
    const markup = html(
      bridge({
        payment_state: "paid",
        payment: vinculo({
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
          missing_requirements: [],
        }),
      }),
    );
    expect(markup).toContain("se pagó en 1 aplicación");
    expect(markup).toContain("op-55120933");
    expect(markup).not.toContain("Nadie declaró todavía");
  });
});

describe("F29BridgePanel — payment_state sin enum en el contrato", () => {
  it("un estado declarado por el contrato recibe su título", () => {
    expect(html(bridge({ payment_state: "partial" }))).toContain("Pagado en parte");
    expect(html(bridge({ payment_state: "deferred" }))).toContain("Con el IVA postergado");
  });

  it("un valor fuera del contrato NO recibe título de contrato: muestra lo que queda por pagar", () => {
    const markup = html(bridge({ payment_state: "reconciliado_parcial_v2" }));
    expect(markup).toContain("Cuánto queda por pagar");
    expect(markup).not.toContain("Pagado en parte");
    expect(markup).not.toContain("Por pagar<");
    // El número no desaparece por no poder clasificar el estado.
    expect(markup).toContain("7.450.761");
  });

  it("GEMELO: el valor crudo tampoco se clasifica como `unknown` declarado", () => {
    const fuera = html(bridge({ payment_state: "reconciliado_parcial_v2" }));
    const declaradoUnknown = html(bridge({ payment_state: "unknown" }));
    expect(declaradoUnknown).toContain("Cuánto se pagó no está declarado");
    expect(fuera).not.toContain("Cuánto se pagó no está declarado");
    expect(fuera).not.toBe(declaradoUnknown);
  });

  it("sin el código 91 observado NO se pinta un residual de cero: dice qué falta para poder restarlo", () => {
    const markup = html(
      bridge({
        declaration_total: null,
        unexplained_delta: null,
        data_state: "no_observations",
        payment: vinculo({
          declaration_receipt: {
            folio: 9238206586,
            declaration_total: null,
            source: "sii_f29_pdf",
          },
          missing_requirements: ["declaration_total_observation"],
        }),
      }),
    );
    expect(markup).toContain("que el total oficial del F29 (código 91) quede observado");
    expect(markup).not.toContain("Es lo que falta para cubrir");
  });

  it("GEMELO: con el código 91 observado sí se pinta el residual con lo que cubre", () => {
    const markup = html(bridge());
    expect(markup).toContain("Es lo que falta para cubrir");
    expect(markup).toContain("Todavía no hay ninguna cuota declarada");
  });
});
