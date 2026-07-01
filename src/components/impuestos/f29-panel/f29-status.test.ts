import { describe, expect, it } from "vitest";
import { f29Status } from "./f29-status";
import type { F29Declaracion } from "./types";

/* El semáforo lo ve el dueño de la PYME para saber, de un vistazo, qué F29
   está OK y cuál lo va a meter en problemas con el SII. Cambios accidentales
   en el mapeo se notan al instante — anti-regresión. */

const NOW = new Date("2026-06-30T12:00:00Z");

function decl(over: Partial<F29Declaracion>): F29Declaracion {
  return {
    periodo: "2026-05",
    folio: 1,
    estado: "vigente",
    fecha_vencimiento: "2026-06-12",
    estado_pago: "pagado",
    total_a_pagar: 100000,
    monto_pagado: 100000,
    iva_postergado: null,
    observaciones: null,
    iva_debito_fiscal: null,
    iva_credito_fiscal: null,
    ppm: null,
    remanente_credito_fiscal: null,
    cuadratura_rcv: null,
    ...over,
  };
}

describe("f29Status — semáforo de la declaración", () => {
  it("pagada → 🟢 success", () => {
    expect(f29Status(decl({ estado_pago: "pagado" }), NOW)).toEqual({
      tone: "success",
      label: "Pagada",
    });
  });

  it("postergada (ProPyme) → 🟢 success 'Postergada'", () => {
    expect(f29Status(decl({ estado_pago: "postergado" }), NOW).tone).toBe("success");
  });

  it("con observaciones → 🟡 warning, aunque esté pagada", () => {
    expect(
      f29Status(decl({ estado: "con_observaciones", estado_pago: "pagado" }), NOW),
    ).toEqual({ tone: "warning", label: "Con observaciones" });
  });

  it("pago parcial → 🟡 warning", () => {
    expect(f29Status(decl({ estado_pago: "parcial" }), NOW).tone).toBe("warning");
  });

  it("estado_pago='vencido' → 🔴 danger", () => {
    expect(f29Status(decl({ estado_pago: "vencido" }), NOW).tone).toBe("danger");
  });

  it("pendiente y ya venció el plazo → 🔴 danger", () => {
    expect(
      f29Status(decl({ estado_pago: "pendiente", fecha_vencimiento: "2026-06-12" }), NOW).tone,
    ).toBe("danger");
  });

  it("pendiente pero aún NO vence → ⚪ neutral", () => {
    expect(
      f29Status(decl({ estado_pago: "pendiente", fecha_vencimiento: "2026-07-12" }), NOW),
    ).toEqual({ tone: "neutral", label: "Pendiente" });
  });

  it("no declarada y ya venció → 🔴 danger 'No declarada'", () => {
    expect(
      f29Status(decl({ estado: "no_declarada", fecha_vencimiento: "2026-06-12" }), NOW),
    ).toEqual({ tone: "danger", label: "No declarada" });
  });

  it("no declarada pero aún no vence → ⚪ neutral 'Por declarar'", () => {
    expect(
      f29Status(decl({ estado: "no_declarada", fecha_vencimiento: "2026-07-12" }), NOW).label,
    ).toBe("Por declarar");
  });
});
